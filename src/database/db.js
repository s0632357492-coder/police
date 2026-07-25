const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'bot.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema — ตารางแยกตามสเปก
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  first_seen INTEGER DEFAULT (strftime('%s','now')),
  last_seen INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS voice247 (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  enabled_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS vote_sessions (
  session_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  type TEXT NOT NULL,               -- votekick | votetimeout | votemute | votedeaf
  target_id TEXT NOT NULL,
  starter_id TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  threshold INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | passed | cancelled | expired
  created_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vote_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  choice TEXT NOT NULL,             -- up | down
  weight INTEGER NOT NULL DEFAULT 1,
  voted_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(session_id, voter_id)
);

CREATE TABLE IF NOT EXISTS special_channels (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, channel_id)
);

CREATE TABLE IF NOT EXISTS special_roles (
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, role_id, channel_id)
);

CREATE TABLE IF NOT EXISTS punishment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  actor_id TEXT,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,             -- kick | ban | mute | deaf | timeout | move
  reason TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS reason_storage (
  guild_id TEXT PRIMARY KEY,
  reason_channel_id TEXT NOT NULL,
  log_channel_id TEXT NOT NULL,
  lock_role_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS reason_locks (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  saved_roles TEXT NOT NULL,        -- JSON array of role IDs before lock
  locked_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  category TEXT NOT NULL,           -- voice | vote | permission | reason | protection | command | error | database
  event TEXT NOT NULL,
  actor_id TEXT,
  target_id TEXT,
  channel_id TEXT,
  role_id TEXT,
  reason TEXT,
  command TEXT,
  success INTEGER DEFAULT 1,
  error_detail TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS settings (
  guild_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (guild_id, key)
);

CREATE TABLE IF NOT EXISTS cooldowns (
  user_id TEXT NOT NULL,
  command TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, command)
);

CREATE TABLE IF NOT EXISTS noob_targets (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_logs_guild_created ON logs (guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_punishment_guild ON punishment_history (guild_id, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vote_sessions_guild_status ON vote_sessions (guild_id, status);
`);

module.exports = db;
