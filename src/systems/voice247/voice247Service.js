// @discordjs/voice ใช้สำหรับเข้าห้องเสียงจริง (join). เป็น optional dependency —
// ถ้ายังไม่ได้ npm install @discordjs/voice บอทจะยังทำงานได้ปกติ เพียงแต่จะไม่
// เชื่อมต่อเสียงจริง (state ใน DB / auto-recovery logic ยังทำงานครบ)
let voice;
try {
  voice = require('@discordjs/voice');
} catch {
  voice = null;
}

const db = require('../../database/db');
const { logEvent } = require('../logger/logger');
const config = require('../../config/config');

const getRow = db.prepare(`SELECT * FROM voice247 WHERE guild_id = ?`);
const upsertRow = db.prepare(`
  INSERT INTO voice247 (guild_id, channel_id, enabled_by) VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, enabled_by = excluded.enabled_by
`);
const deleteRow = db.prepare(`DELETE FROM voice247 WHERE guild_id = ?`);
const getAll = db.prepare(`SELECT * FROM voice247`);

class Voice247Service {
  constructor(client) {
    this.client = client;
    /** @type {Map<string, any>} guildId -> VoiceConnection */
    this.connections = new Map();
  }

  /** เข้าห้องเสียงและบันทึกลง DB */
  async enable(guild, channel, enabledBy) {
    upsertRow.run(guild.id, channel.id, enabledBy);
    await this._connect(guild, channel);
    await logEvent(this.client, {
      guildId: guild.id,
      category: 'voice',
      event: 'Voice247 Enabled',
      actorId: enabledBy,
      channelId: channel.id,
      command: '/on247',
    });
  }

  /** ออกจากห้องและลบออกจาก DB */
  async disable(guild, requestedBy) {
    const conn = this.connections.get(guild.id);
    if (conn) {
      try { conn.destroy(); } catch { /* ignore */ }
      this.connections.delete(guild.id);
    }
    const row = getRow.get(guild.id);
    deleteRow.run(guild.id);
    await logEvent(this.client, {
      guildId: guild.id,
      category: 'voice',
      event: 'Voice247 Disabled',
      actorId: requestedBy,
      channelId: row?.channel_id ?? null,
      command: '/stopon',
    });
  }

  isEnabled(guildId) {
    return !!getRow.get(guildId);
  }

  getConfiguredChannelId(guildId) {
    return getRow.get(guildId)?.channel_id ?? null;
  }

  /** เชื่อมต่อห้องเสียงจริง มิวท์/ปิดกล้อง/ไม่สตรีมตามสเปก */
  async _connect(guild, channel) {
    if (!voice) {
      console.warn('[Voice247] @discordjs/voice ไม่ได้ติดตั้ง — บอทจะไม่เข้าห้องเสียงจริง (ข้ามการเชื่อมต่อเสียง)');
      return null;
    }
    const existing = this.connections.get(guild.id);
    if (existing) {
      try { existing.destroy(); } catch { /* ignore */ }
    }
    const connection = voice.joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });
    this.connections.set(guild.id, connection);

    connection.on(voice.VoiceConnectionStatus.Disconnected, async () => {
      // ตรวจสอบว่ายังควรอยู่ในห้องนี้ไหม (ไม่ใช่ตอน /stopon)
      const stillEnabled = getRow.get(guild.id);
      if (!stillEnabled) return;
      try {
        await Promise.race([
          voice.entersState(connection, voice.VoiceConnectionStatus.Signalling, 5_000),
          voice.entersState(connection, voice.VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        // เชื่อมต่อไม่กลับมาเอง -> รีจอยด้วยตนเอง
        await this.rejoin(guild.id, 'disconnected');
      }
    });

    return connection;
  }

  /** กลับเข้าห้องเดิม ใช้ทั้งตอน auto-recovery หลังรีสตาร์ท และตอนถูกดึงออก */
  async rejoin(guildId, reasonTag = 'manual') {
    const row = getRow.get(guildId);
    if (!row) return;
    const guild = await this.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;
    const channel = await guild.channels.fetch(row.channel_id).catch(() => null);
    if (!channel) {
      await logEvent(this.client, {
        guildId,
        category: 'voice',
        event: 'Voice247 Rejoin Failed — Channel Not Found',
        success: false,
        errorDetail: `channel ${row.channel_id} missing`,
      });
      return;
    }
    await this._connect(guild, channel);
    await logEvent(this.client, {
      guildId,
      category: 'voice',
      event: `Voice247 Rejoined (${reasonTag})`,
      channelId: channel.id,
    });
  }

  /** เรียกตอนบอทเริ่มทำงาน: ตรวจ DB แล้วกลับเข้าห้องเดิมทุก guild */
  async recoverAll() {
    const rows = getAll.all();
    for (const row of rows) {
      await this.rejoin(row.guild_id, 'startup-recovery').catch((err) =>
        console.error(`[Voice247] recover failed for guild ${row.guild_id}:`, err),
      );
    }
  }

  /**
   * เรียกจาก voiceStateUpdate เมื่อบอทถูกย้าย/ดึงออกจากห้อง 24/7
   * ให้กลับเข้าห้องทันที และถ้าเป็นฝีมือคน ให้ลงโทษผ่าน protectionService
   */
  async handleForcedMove(oldState, newState) {
    const guildId = newState.guild.id;
    const row = getRow.get(guildId);
    if (!row) return;

    const wasInTargetChannel = oldState.channelId === row.channel_id;
    const movedAway = wasInTargetChannel && newState.channelId !== row.channel_id;
    if (!movedAway) return;

    await this.rejoin(guildId, 'forced-move');
  }
}

module.exports = Voice247Service;
