/**
 * ค่ากำหนดกลางของบอท
 * แก้ไข Role ID / Channel ID ที่นี่ที่เดียว ไม่ต้องไปไล่แก้ในแต่ละไฟล์
 */
module.exports = {
  // Role ที่มีสิทธิ์ระดับ "ผู้ดูแลระบบบอท" (on247, spch, devtool)
  ADMIN_ROLE_IDS: [
    '1504879133920854056',
    '1460282155413278863',
  ],

  // Role ที่มีน้ำหนักเสียงโหวต 2 คะแนน (แทนที่จะเป็น 1)
  VOTE_WEIGHTED_ROLE_IDS: [
    '1480169542134272101',
    '1457398105371840584',
    '1528458114624524409',
  ],

  // ห้องเสียงที่ใช้ "กัก" สมาชิกที่โดน Vote Kick
  VOTE_KICK_HOLDING_CHANNEL_ID: '1475884464520560763',

  // ระยะเวลา Timeout เมื่อฝ่าฝืนกลับเข้าห้องหลังโดน Vote Kick (ms)
  VOTE_KICK_REENTRY_TIMEOUT_MS: 60 * 1000, // 1 นาที

  // ระยะเวลา Timeout เมื่อมีคนแกล้งบอท (ms)
  BOT_PROTECTION_TIMEOUT_MS: 5 * 60 * 1000, // 5 นาที

  // จำนวนครั้งการใช้สิทธิ์ก่อนถูกล็อกด้วย Reason Lock
  REASON_ACTION_THRESHOLD: 5,
  // ช่วงเวลานับจำนวนครั้ง (ms) - ปรับได้ตามต้องการ
  REASON_ACTION_WINDOW_MS: 60 * 60 * 1000, // 1 ชั่วโมง

  // จำนวนสมาชิกสูงสุดที่ตั้งเป็น "Noob Target" ได้พร้อมกันต่อเซิร์ฟเวอร์
  NOOB_MAX_TARGETS: 5,
  // จำนวนคะแนนเห็นด้วยขั้นต่ำที่ทำให้เป้าหมาย Noob โดนลงโทษทันที (ต่ำกว่า threshold ปกติ)
  NOOB_VOTE_THRESHOLD: 2,

  // Cooldown คำสั่งทั่วไป (ms)
  DEFAULT_COMMAND_COOLDOWN_MS: 3000,

  // รายชื่อคำสั่งที่ใช้ได้เฉพาะผู้ถือ ADMIN_ROLE_IDS เท่านั้น (ใช้กรองใน /help)
  ADMIN_ONLY_COMMANDS: [
    'on247', 'stopon', 'spch', 'delspch', 'setreason', 'devtool', 'noob', 'unnoob',
  ],

  // รอบอัปเดต Dashboard (ms)
  DASHBOARD_UPDATE_INTERVAL_MS: 5 * 60 * 1000, // 5 นาที

  // จำนวน log ล่าสุดที่แสดงใน Live Log ของ Dashboard
  DASHBOARD_LIVE_LOG_LIMIT: 12,

  // สี Embed ตามความหมาย (Cyber Dark / Glassmorphism)
  COLORS: {
    PRIMARY: 0x5865f2,
    SUCCESS: 0x2ecc71,
    DANGER: 0xe74c3c,
    WARNING: 0xf1c40f,
    INFO: 0x8e44ad,
    DARK: 0x1a1a2e,
  },

  EMOJI: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    VOICE: '🔊',
    VOTE_UP: '👍',
    VOTE_DOWN: '👎',
    RESULT: '📊',
    CANCEL: '❌',
    LOCK: '🔒',
    DEV: '🛠️',
  },
};
