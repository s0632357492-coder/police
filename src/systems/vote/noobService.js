const db = require('../../database/db');
const config = require('../../config/config');
const { logEvent } = require('../logger/logger');

const insertRow = db.prepare(`
  INSERT INTO noob_targets (guild_id, user_id, added_by) VALUES (?, ?, ?)
`);
const deleteRow = db.prepare(`DELETE FROM noob_targets WHERE guild_id = ? AND user_id = ?`);
const getRow = db.prepare(`SELECT * FROM noob_targets WHERE guild_id = ? AND user_id = ?`);
const countRows = db.prepare(`SELECT COUNT(*) AS c FROM noob_targets WHERE guild_id = ?`);
const listRows = db.prepare(`SELECT * FROM noob_targets WHERE guild_id = ? ORDER BY added_at ASC`);

function isNoob(guildId, userId) {
  return !!getRow.get(guildId, userId);
}

function list(guildId) {
  return listRows.all(guildId);
}

/** เพิ่มเป้าหมายเข้ารายชื่อ Noob — คืน error code ถ้าเต็มโควตาหรือซ้ำ */
async function addNoob(client, guild, targetId, addedBy) {
  if (isNoob(guild.id, targetId)) {
    return { ok: false, error: 'ALREADY_NOOB' };
  }
  const { c } = countRows.get(guild.id);
  if (c >= config.NOOB_MAX_TARGETS) {
    return { ok: false, error: 'LIMIT_REACHED', current: list(guild.id) };
  }

  insertRow.run(guild.id, targetId, addedBy);

  await logEvent(client, {
    guildId: guild.id,
    category: 'vote',
    event: 'เพิ่มเป้าหมายเข้ารายชื่อ Noob',
    actorId: addedBy,
    targetId,
    command: '/noob',
    reason: `โหวตเห็นด้วย ${config.NOOB_VOTE_THRESHOLD} คะแนนขึ้นไป = ลงโทษทันที`,
  });

  return { ok: true };
}

/** เอาเป้าหมายออกจากรายชื่อ Noob */
async function removeNoob(client, guild, targetId, removedBy) {
  if (!isNoob(guild.id, targetId)) {
    return { ok: false, error: 'NOT_NOOB' };
  }
  deleteRow.run(guild.id, targetId);

  await logEvent(client, {
    guildId: guild.id,
    category: 'vote',
    event: 'ถอดเป้าหมายออกจากรายชื่อ Noob',
    actorId: removedBy,
    targetId,
    command: '/unnoob',
  });

  return { ok: true };
}

module.exports = { isNoob, list, addNoob, removeNoob };
