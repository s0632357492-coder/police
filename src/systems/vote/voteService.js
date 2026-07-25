const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const config = require('../../config/config');
const { logEvent } = require('../logger/logger');
const { getVoteWeight } = require('../permissions/permissions');
const noobService = require('./noobService');

const VOTE_TYPES = ['votekick', 'votetimeout', 'votemute', 'votedeaf'];

// น้ำหนักโหวตขั้นต่ำที่ต้องถึงเพื่อดำเนินการ (ปรับได้ตามขนาดเซิร์ฟเวอร์)
const VOTE_THRESHOLD = 3;

const insertSession = db.prepare(`
  INSERT INTO vote_sessions (session_id, guild_id, type, target_id, starter_id, duration_minutes, channel_id, message_id, threshold, expires_at)
  VALUES (@session_id, @guild_id, @type, @target_id, @starter_id, @duration_minutes, @channel_id, @message_id, @threshold, @expires_at)
`);
const getSession = db.prepare(`SELECT * FROM vote_sessions WHERE session_id = ?`);
const updateSessionMessage = db.prepare(`UPDATE vote_sessions SET message_id = ? WHERE session_id = ?`);
const updateSessionStatus = db.prepare(`UPDATE vote_sessions SET status = ? WHERE session_id = ?`);
const getActiveSessionForTarget = db.prepare(`
  SELECT * FROM vote_sessions WHERE guild_id = ? AND target_id = ? AND type = ? AND status = 'active'
`);

const insertVote = db.prepare(`
  INSERT INTO vote_history (session_id, voter_id, choice, weight) VALUES (?, ?, ?, ?)
`);
const getExistingVote = db.prepare(`SELECT * FROM vote_history WHERE session_id = ? AND voter_id = ?`);
const deleteVote = db.prepare(`DELETE FROM vote_history WHERE session_id = ? AND voter_id = ?`);
const getVotesForSession = db.prepare(`SELECT * FROM vote_history WHERE session_id = ?`);

const insertPunishment = db.prepare(`
  INSERT INTO punishment_history (guild_id, actor_id, target_id, action, reason) VALUES (?, ?, ?, ?, ?)
`);

const VOTE_LABELS = {
  votekick: 'Vote Kick (ย้ายออกจากห้องเสียงชั่วคราว)',
  votetimeout: 'Vote Timeout',
  votemute: 'Vote Mute (Server Mute)',
  votedeaf: 'Vote Deaf (Server Deaf)',
};

function tally(sessionId) {
  const votes = getVotesForSession.all(sessionId);
  let up = 0;
  let down = 0;
  for (const v of votes) {
    if (v.choice === 'up') up += v.weight;
    else down += v.weight;
  }
  return { up, down, voterCount: votes.length };
}

function buildVoteEmbed(session, tallyResult) {
  const expiresUnix = Math.floor(session.expires_at / 1000);
  const isNoobTarget = session.threshold === config.NOOB_VOTE_THRESHOLD;
  return new EmbedBuilder()
    .setTitle(`${config.EMOJI.VOTE_UP} ${VOTE_LABELS[session.type]}${isNoobTarget ? '  🎯 [Noob Target]' : ''}`)
    .setColor(config.COLORS.WARNING)
    .addFields(
      { name: 'ผู้เริ่มโหวต', value: `<@${session.starter_id}>`, inline: true },
      { name: 'เป้าหมาย', value: `<@${session.target_id}>`, inline: true },
      { name: 'เวลาลงโทษ', value: `${session.duration_minutes} นาที`, inline: true },
      { name: 'คะแนนปัจจุบัน', value: `👍 ${tallyResult.up}  |  👎 ${tallyResult.down}  (ต้องการ ${session.threshold})`, inline: false },
      { name: 'จำนวนผู้โหวต', value: `${tallyResult.voterCount} คน`, inline: true },
      { name: 'เวลาหมดอายุ', value: `<t:${expiresUnix}:R>`, inline: true },
    )
    .setFooter({ text: `Session: ${session.session_id}` })
    .setTimestamp();
}

function buildVoteRow(sessionId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vote:up:${sessionId}`).setLabel('เห็นด้วย').setEmoji('👍').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`vote:down:${sessionId}`).setLabel('ไม่เห็นด้วย').setEmoji('👎').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`vote:result:${sessionId}`).setLabel('ดูผลโหวต').setEmoji('📊').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`vote:cancel:${sessionId}`).setLabel('ยกเลิก').setEmoji('❌').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
}

/** สร้าง session ใหม่ พร้อมกันการเปิดโหวตซ้ำต่อเป้าหมายเดิมประเภทเดียวกันที่ยัง active อยู่ */
function createSession({ guildId, type, targetId, starterId, durationMinutes, channelId }) {
  const existing = getActiveSessionForTarget.get(guildId, targetId, type);
  if (existing) {
    return { error: 'DUPLICATE_ACTIVE_VOTE', session: existing };
  }
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;
  const isNoobTarget = noobService.isNoob(guildId, targetId);
  const threshold = isNoobTarget ? config.NOOB_VOTE_THRESHOLD : VOTE_THRESHOLD;
  insertSession.run({
    session_id: sessionId,
    guild_id: guildId,
    type,
    target_id: targetId,
    starter_id: starterId,
    duration_minutes: durationMinutes,
    channel_id: channelId,
    message_id: null,
    threshold,
    expires_at: expiresAt,
  });
  return { session: getSession.get(sessionId), isNoobTarget };
}

function attachMessage(sessionId, messageId) {
  updateSessionMessage.run(messageId, sessionId);
}

/**
 * ลงคะแนน — ป้องกันโหวตซ้ำ (กดปุ่มเดิมซ้ำ = no-op), รองรับเปลี่ยนคะแนน (กดปุ่มตรงข้าม),
 * และคำนวณน้ำหนักตาม Role
 */
function castVote(session, voterMember, choice) {
  if (session.status !== 'active') return { status: 'CLOSED' };
  if (Date.now() > session.expires_at) return { status: 'EXPIRED' };
  if (voterMember.id === session.target_id) return { status: 'CANNOT_VOTE_SELF' };

  const weight = getVoteWeight(voterMember);
  const existing = getExistingVote.get(session.session_id, voterMember.id);

  if (existing && existing.choice === choice) {
    return { status: 'ALREADY_VOTED_SAME', tally: tally(session.session_id) };
  }
  if (existing) {
    deleteVote.run(session.session_id, voterMember.id);
  }
  insertVote.run(session.session_id, voterMember.id, choice, weight);

  const result = tally(session.session_id);
  const passed = choice === 'up' && result.up >= session.threshold;
  return { status: passed ? 'PASSED' : 'OK', tally: result };
}

function cancelSession(sessionId) {
  updateSessionStatus.run('cancelled', sessionId);
}

function passSession(sessionId) {
  updateSessionStatus.run('passed', sessionId);
}

function expireSession(sessionId) {
  updateSessionStatus.run('expired', sessionId);
}

function recordPunishment(guildId, actorId, targetId, action, reason) {
  insertPunishment.run(guildId, actorId, targetId, action, reason);
}

/** ดำเนินการลงโทษจริงตามประเภทของโหวต */
async function executePunishment(client, guild, session) {
  const member = await guild.members.fetch(session.target_id).catch(() => null);
  const durationMs = session.duration_minutes * 60 * 1000;

  try {
    if (session.type === 'votekick') {
      if (member?.voice?.channelId) {
        await member.voice.setChannel(config.VOTE_KICK_HOLDING_CHANNEL_ID, 'Vote Kick ผ่านมติ');
      }
      recordPunishment(session.guild_id, session.starter_id, session.target_id, 'move', `Vote Kick ${session.duration_minutes} นาที`);
      // ปล่อยกลับหลังครบเวลา
      setTimeout(async () => {
        try {
          const m = await guild.members.fetch(session.target_id).catch(() => null);
          if (m?.voice?.channelId === config.VOTE_KICK_HOLDING_CHANNEL_ID) {
            await m.voice.disconnect('พ้นระยะเวลา Vote Kick').catch(() => null);
          }
        } catch { /* member may have left */ }
      }, durationMs);
    } else if (session.type === 'votetimeout') {
      if (member?.moderatable) {
        await member.timeout(durationMs, 'ผ่านมติ Vote Timeout');
      }
      recordPunishment(session.guild_id, session.starter_id, session.target_id, 'timeout', `${session.duration_minutes} นาที`);
    } else if (session.type === 'votemute') {
      if (member?.voice?.channelId) {
        await member.voice.setMute(true, 'ผ่านมติ Vote Mute');
      }
      recordPunishment(session.guild_id, session.starter_id, session.target_id, 'mute', `${session.duration_minutes} นาที`);
      setTimeout(async () => {
        const m = await guild.members.fetch(session.target_id).catch(() => null);
        if (m?.voice?.channelId) await m.voice.setMute(false, 'พ้นระยะเวลา Vote Mute').catch(() => null);
      }, durationMs);
    } else if (session.type === 'votedeaf') {
      if (member?.voice?.channelId) {
        await member.voice.setDeaf(true, 'ผ่านมติ Vote Deaf');
      }
      recordPunishment(session.guild_id, session.starter_id, session.target_id, 'deaf', `${session.duration_minutes} นาที`);
      setTimeout(async () => {
        const m = await guild.members.fetch(session.target_id).catch(() => null);
        if (m?.voice?.channelId) await m.voice.setDeaf(false, 'พ้นระยะเวลา Vote Deaf').catch(() => null);
      }, durationMs);
    }

    await logEvent(client, {
      guildId: session.guild_id,
      category: 'vote',
      event: `${VOTE_LABELS[session.type]} — มติผ่าน`,
      actorId: session.starter_id,
      targetId: session.target_id,
      reason: `${session.duration_minutes} นาที`,
      command: `/${session.type}`,
    });
  } catch (err) {
    await logEvent(client, {
      guildId: session.guild_id,
      category: 'vote',
      event: `${VOTE_LABELS[session.type]} — ดำเนินการล้มเหลว`,
      targetId: session.target_id,
      success: false,
      errorDetail: err.message,
    });
  }
}

/** เรียกใน voiceStateUpdate: ถ้าผู้ถูก Vote Kick ฝืนกลับเข้าห้องเดิมภายในช่วงลงโทษ ให้ Timeout 1 นาที */
async function handleVoteKickReentry(client, guild, member) {
  // ถ้ากลับเข้าห้อง holding เอง ไม่ถือว่าฝ่าฝืน
  if (member.voice.channelId === config.VOTE_KICK_HOLDING_CHANNEL_ID) return;

  const recentKick = db.prepare(`
    SELECT * FROM punishment_history
    WHERE guild_id = ? AND target_id = ? AND action = 'move'
    ORDER BY created_at DESC LIMIT 1
  `).get(guild.id, member.id);

  if (!recentKick) return;
  // ถือว่ายังอยู่ในช่วงลงโทษถ้าผ่านมาไม่เกิน 24 ชม. (การตรวจเวลาจริงตาม duration ทำที่ setTimeout ตอน executePunishment)
  const withinWindow = Date.now() / 1000 - recentKick.created_at < 24 * 60 * 60;
  if (!withinWindow) return;

  if (member.moderatable) {
    await member.timeout(config.VOTE_KICK_REENTRY_TIMEOUT_MS, 'ฝ่าฝืนกลับเข้าห้องหลังโดน Vote Kick');
    await logEvent(client, {
      guildId: guild.id,
      category: 'vote',
      event: 'ฝ่าฝืนกลับเข้าห้องหลังโดน Vote Kick — Timeout 1 นาที',
      targetId: member.id,
    });
  }
}

module.exports = {
  VOTE_TYPES,
  VOTE_THRESHOLD,
  createSession,
  attachMessage,
  castVote,
  cancelSession,
  passSession,
  expireSession,
  executePunishment,
  handleVoteKickReentry,
  buildVoteEmbed,
  buildVoteRow,
  tally,
  getSession,
};
