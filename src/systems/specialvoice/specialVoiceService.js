const db = require('../../database/db');
const { logEvent } = require('../logger/logger');
const { isPrivileged } = require('../permissions/permissions');

const upsert = db.prepare(`
  INSERT INTO special_channels (guild_id, channel_id, role_id, created_by) VALUES (?, ?, ?, ?)
  ON CONFLICT(guild_id, channel_id) DO UPDATE SET role_id = excluded.role_id, created_by = excluded.created_by
`);
const removeRow = db.prepare(`DELETE FROM special_channels WHERE guild_id = ? AND channel_id = ?`);
const getRow = db.prepare(`SELECT * FROM special_channels WHERE guild_id = ? AND channel_id = ?`);
const getAllForGuild = db.prepare(`SELECT * FROM special_channels WHERE guild_id = ?`);

async function setSpecialChannel(client, guild, channel, role, createdBy) {
  upsert.run(guild.id, channel.id, role.id, createdBy);
  await logEvent(client, {
    guildId: guild.id,
    category: 'permission',
    event: 'ตั้งค่า Special Channel Permission',
    actorId: createdBy,
    channelId: channel.id,
    roleId: role.id,
    command: '/spch',
  });
}

async function removeSpecialChannel(client, guild, channel, removedBy) {
  const existed = getRow.get(guild.id, channel.id);
  removeRow.run(guild.id, channel.id);
  await logEvent(client, {
    guildId: guild.id,
    category: 'permission',
    event: 'ยกเลิก Special Channel Permission',
    actorId: removedBy,
    channelId: channel.id,
    roleId: existed?.role_id ?? null,
    command: '/delspch',
  });
}

/** true ถ้าสมาชิกคนนี้เป็น Special Moderator ในห้องเสียงที่ตนอยู่ตอนนี้ */
function isSpecialModeratorHere(member) {
  if (!member?.voice?.channelId) return false;
  const row = getRow.get(member.guild.id, member.voice.channelId);
  if (!row) return false;
  return member.roles.cache.has(row.role_id);
}

/** true ถ้าสมาชิกคนนี้ถือ Role พิเศษของห้องที่ตนอยู่ (ได้รับการป้องกัน mute/deaf/move) */
function isProtectedHere(member) {
  return isSpecialModeratorHere(member);
}

/** ตรวจว่า actor สามารถ mute/deaf/move target ได้หรือไม่ ตามกติกาการป้องกัน */
function canActOnTarget(actorMember, targetMember) {
  if (isPrivileged(actorMember)) return true;
  if (isSpecialModeratorHere(actorMember)) return true;
  if (isProtectedHere(targetMember)) return false;
  return true;
}

module.exports = {
  setSpecialChannel,
  removeSpecialChannel,
  isSpecialModeratorHere,
  isProtectedHere,
  canActOnTarget,
  getAllForGuild,
};
