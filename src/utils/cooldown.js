const db = require('../database/db');
const config = require('../config/config');

const getCd = db.prepare(`SELECT expires_at FROM cooldowns WHERE user_id = ? AND command = ?`);
const upsertCd = db.prepare(`
  INSERT INTO cooldowns (user_id, command, expires_at) VALUES (?, ?, ?)
  ON CONFLICT(user_id, command) DO UPDATE SET expires_at = excluded.expires_at
`);

/** คืนค่า millis ที่เหลือถ้ายัง cooldown อยู่ มิฉะนั้นคืน 0 และตั้ง cooldown ใหม่ให้ */
function checkAndSetCooldown(userId, command, ms = config.DEFAULT_COMMAND_COOLDOWN_MS) {
  const now = Date.now();
  const row = getCd.get(userId, command);
  if (row && row.expires_at > now) {
    return row.expires_at - now;
  }
  upsertCd.run(userId, command, now + ms);
  return 0;
}

// ---------------------------------------------------------------------------
// ป้องกันการกดปุ่ม/กดโหวตซ้ำในเสี้ยววินาที (race condition) ด้วย in-memory lock
// เพียงพอสำหรับบอทที่รันเป็น process เดียว (ตามสเปก single instance)
// ---------------------------------------------------------------------------
const activeLocks = new Set();

/** พยายามล็อก key นี้ ถ้าล็อกไม่สำเร็จ (มีคนใช้อยู่) คืน false */
function tryLock(key) {
  if (activeLocks.has(key)) return false;
  activeLocks.add(key);
  return true;
}

function unlock(key) {
  activeLocks.delete(key);
}

module.exports = { checkAndSetCooldown, tryLock, unlock };
