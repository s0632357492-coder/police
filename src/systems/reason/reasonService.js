const { PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const config = require('../../config/config');
const { logEvent } = require('../logger/logger');

const upsertConfig = db.prepare(`
  INSERT INTO reason_storage (guild_id, reason_channel_id, log_channel_id, lock_role_id)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET reason_channel_id = excluded.reason_channel_id, log_channel_id = excluded.log_channel_id
`);
const setLockRole = db.prepare(`UPDATE reason_storage SET lock_role_id = ? WHERE guild_id = ?`);
const getConfig = db.prepare(`SELECT * FROM reason_storage WHERE guild_id = ?`);

const insertLock = db.prepare(`
  INSERT INTO reason_locks (guild_id, user_id, saved_roles) VALUES (?, ?, ?)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET saved_roles = excluded.saved_roles, locked_at = strftime('%s','now')
`);
const getLock = db.prepare(`SELECT * FROM reason_locks WHERE guild_id = ? AND user_id = ?`);
const deleteLock = db.prepare(`DELETE FROM reason_locks WHERE guild_id = ? AND user_id = ?`);

const TRACKED_ACTIONS = ['kick', 'ban', 'mute', 'deaf', 'timeout', 'move'];

const countActions = db.prepare(`
  SELECT COUNT(*) AS cnt FROM punishment_history
  WHERE guild_id = ? AND actor_id = ? AND action IN (${TRACKED_ACTIONS.map(() => '?').join(',')})
    AND created_at >= ?
`);

/** ตั้งค่าระบบครั้งแรก: สร้าง Role "Reason Lock" อัตโนมัติ + ตั้งห้องเหตุผล/ห้อง Log */
async function setupReasonSystem(client, guild, reasonChannel, logChannel, setBy) {
  let lockRole = guild.roles.cache.find((r) => r.name === 'Reason Lock');
  if (!lockRole) {
    lockRole = await guild.roles.create({
      name: 'Reason Lock',
      color: config.COLORS.DANGER,
      reason: 'สร้างอัตโนมัติโดยระบบ Reason Control',
      permissions: [],
    });
  }

  // ตั้งสิทธิ์ห้องเหตุผลให้เห็นเฉพาะผู้ถือ Reason Lock (+ @everyone มองไม่เห็น)
  await reasonChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => null);
  await reasonChannel.permissionOverwrites.edit(lockRole, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  }).catch(() => null);

  upsertConfig.run(guild.id, reasonChannel.id, logChannel.id, lockRole.id);
  setLockRole.run(lockRole.id, guild.id);

  await logEvent(client, {
    guildId: guild.id,
    category: 'reason',
    event: 'ตั้งค่าระบบ Reason Control',
    actorId: setBy,
    channelId: reasonChannel.id,
    roleId: lockRole.id,
    command: '/setreason',
  });

  return lockRole;
}

/** เรียกทุกครั้งหลังดำเนินการ kick/ban/mute/deaf/timeout/move สำเร็จ เพื่อนับจำนวนครั้งของ moderator */
async function recordAndCheckThreshold(client, guild, actorId, action, targetId, reason = null) {
  db.prepare(`INSERT INTO punishment_history (guild_id, actor_id, target_id, action, reason) VALUES (?, ?, ?, ?, ?)`)
    .run(guild.id, actorId, targetId, action, reason);

  const cfg = getConfig.get(guild.id);
  if (!cfg) return; // ระบบยังไม่ถูกตั้งค่าในเซิร์ฟเวอร์นี้

  const windowStart = Math.floor((Date.now() - config.REASON_ACTION_WINDOW_MS) / 1000);
  const { cnt } = countActions.get(guild.id, actorId, ...TRACKED_ACTIONS, windowStart);

  if (cnt >= config.REASON_ACTION_THRESHOLD) {
    await lockMember(client, guild, actorId);
  }
}

/** ถอด Role ทั้งหมด (เก็บไว้) แล้วใส่ Reason Lock */
async function lockMember(client, guild, userId) {
  const cfg = getConfig.get(guild.id);
  if (!cfg?.lock_role_id) return;
  if (getLock.get(guild.id, userId)) return; // ล็อกอยู่แล้ว

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const currentRoles = member.roles.cache
    .filter((r) => r.id !== guild.id && r.editable)
    .map((r) => r.id);

  insertLock.run(guild.id, userId, JSON.stringify(currentRoles));

  try {
    if (currentRoles.length) await member.roles.remove(currentRoles, 'ใช้สิทธิ์เกินกำหนด — ล็อกรอชี้แจงเหตุผล');
    await member.roles.add(cfg.lock_role_id, 'Reason Lock');
  } catch (err) {
    await logEvent(client, {
      guildId: guild.id,
      category: 'reason',
      event: 'ล็อก Role ล้มเหลว',
      targetId: userId,
      success: false,
      errorDetail: err.message,
    });
    return;
  }

  await logEvent(client, {
    guildId: guild.id,
    category: 'reason',
    event: 'ถอด Role และใส่ Reason Lock (ใช้สิทธิ์เกินกำหนด)',
    targetId: userId,
    roleId: cfg.lock_role_id,
    extraFields: [{ name: 'Role ที่ถูกถอด', value: currentRoles.map((id) => `<@&${id}>`).join(', ') || 'ไม่มี' }],
  });
}

/** เรียกหลังส่ง Modal ชี้แจงเหตุผลสำเร็จ: คืน Role เดิมทั้งหมด + ลบ Reason Lock */
async function unlockMember(client, guild, userId, reasonText, moderatorId = null) {
  const cfg = getConfig.get(guild.id);
  const lock = getLock.get(guild.id, userId);
  if (!lock) return { ok: false, message: 'ไม่พบข้อมูลการล็อกของสมาชิกนี้' };

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return { ok: false, message: 'ไม่พบสมาชิกในเซิร์ฟเวอร์' };

  const savedRoles = JSON.parse(lock.saved_roles);

  try {
    if (cfg?.lock_role_id) await member.roles.remove(cfg.lock_role_id, 'ชี้แจงเหตุผลแล้ว').catch(() => null);
    if (savedRoles.length) await member.roles.add(savedRoles, 'คืน Role หลังชี้แจงเหตุผล').catch(() => null);
  } finally {
    deleteLock.run(guild.id, userId);
  }

  await logEvent(client, {
    guildId: guild.id,
    category: 'reason',
    event: 'คืน Role หลังชี้แจงเหตุผลสำเร็จ',
    targetId: userId,
    actorId: moderatorId,
    reason: reasonText,
    extraFields: [{ name: 'Role ที่คืน', value: savedRoles.map((id) => `<@&${id}>`).join(', ') || 'ไม่มี' }],
  });

  return { ok: true };
}

function isLocked(guildId, userId) {
  return !!getLock.get(guildId, userId);
}

module.exports = {
  setupReasonSystem,
  recordAndCheckThreshold,
  lockMember,
  unlockMember,
  isLocked,
  getConfig,
  TRACKED_ACTIONS,
};
