const fs = require('fs');
const path = require('path');
const db = require('../../database/db');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** สำรองฐานข้อมูลเป็นไฟล์ .db พร้อม timestamp โดยใช้ SQLite online backup API */
async function backupDatabase() {
  ensureBackupDir();
  const filename = `bot-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  const dest = path.join(BACKUP_DIR, filename);
  await db.backup(dest);

  // เก็บแค่ 10 ไฟล์ล่าสุด ป้องกันดิสก์เต็ม
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort();
  while (files.length > 10) {
    fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }
  return dest;
}

/** คืนค่าไฟล์ backup ล่าสุด (path) หรือ null ถ้าไม่มี */
function getLatestBackup() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort();
  if (!files.length) return null;
  return path.join(BACKUP_DIR, files[files.length - 1]);
}

/** ตรวจสอบสถานะบอทเบื้องต้น: DB เขียน/อ่านได้, memory ปกติ */
function healthCheck(client) {
  const result = { ok: true, checks: {} };
  try {
    db.prepare('SELECT 1').get();
    result.checks.database = 'ok';
  } catch (err) {
    result.checks.database = `error: ${err.message}`;
    result.ok = false;
  }

  result.checks.wsStatus = client.ws.status; // 0 = READY
  result.checks.ping = client.ws.ping;
  result.checks.memoryMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  result.checks.uptimeSeconds = Math.floor(process.uptime());
  return result;
}

module.exports = { backupDatabase, getLatestBackup, healthCheck };
