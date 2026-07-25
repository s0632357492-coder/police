const { AuditLogEvent } = require('discord.js');
const { logEvent } = require('../logger/logger');
const config = require('../../config/config');

/** หา user ล่าสุดที่ทำ action นี้ต่อ target จาก Audit Log */
async function findActorFromAuditLog(guild, auditType, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type: auditType, limit: 5 });
    const entry = logs.entries.find((e) => e.target?.id === targetId || e.targetId === targetId);
    return entry?.executor ?? null;
  } catch (err) {
    console.error('[Protection] Failed to read audit log:', err);
    return null;
  }
}

/** ลงโทษผู้ที่แกล้งบอท: Timeout 5 นาที + DM + Log */
async function punishOffender(client, guild, offender, actionLabel) {
  if (!offender) return;
  try {
    const member = await guild.members.fetch(offender.id).catch(() => null);
    if (member && member.moderatable) {
      await member.timeout(config.BOT_PROTECTION_TIMEOUT_MS, `แกล้งบอท (${actionLabel})`);
    }
  } catch (err) {
    console.error('[Protection] Failed to timeout offender:', err);
  }

  try {
    await offender.send('พี่จ๋าอย่าแกล้งบอท 🥺');
  } catch {
    // ผู้ใช้ปิด DM — ข้ามได้ ไม่ถือเป็นความล้มเหลวของระบบ
  }

  await logEvent(client, {
    guildId: guild.id,
    category: 'protection',
    event: `ตรวจพบการแกล้งบอท (${actionLabel})`,
    actorId: offender.id,
    reason: `Timeout ${config.BOT_PROTECTION_TIMEOUT_MS / 60000} นาที`,
  });
}

/** เรียกจาก guildMemberUpdate/Remove เมื่อบอทถูก kick/ban/timeout */
async function handleMemberAction(client, guild, botUserId, { type, targetId }) {
  if (targetId !== botUserId) return;

  const auditTypeMap = {
    kick: AuditLogEvent.MemberKick,
    ban: AuditLogEvent.MemberBanAdd,
    timeout: AuditLogEvent.MemberUpdate,
  };
  const auditType = auditTypeMap[type];
  if (!auditType) return;

  const offender = await findActorFromAuditLog(guild, auditType, targetId);
  await punishOffender(client, guild, offender, type);
}

/** เรียกจาก voiceStateUpdate เมื่อบอทถูก disconnect/move ออกจากห้องเสียง (ไม่รวม forced-move ที่จัดการโดย voice247) */
async function handleVoiceInterference(client, guild, botUserId, { type, targetId }) {
  if (targetId !== botUserId) return;
  const auditType = type === 'disconnect'
    ? AuditLogEvent.MemberDisconnect
    : AuditLogEvent.MemberMove;

  const offender = await findActorFromAuditLog(guild, auditType, targetId);
  await punishOffender(client, guild, offender, type);
}

module.exports = { handleMemberAction, handleVoiceInterference, findActorFromAuditLog };
