require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const { loadCommands } = require('./utils/loadCommands');
const { loadEvents } = require('./utils/loadEvents');
const Voice247Service = require('./systems/voice247/voice247Service');
const recoveryService = require('./systems/recovery/recoveryService');
const { logEvent } = require('./systems/logger/logger');

const { DISCORD_TOKEN } = process.env;
if (!DISCORD_TOKEN) {
  console.error('❌ กรุณาตั้งค่า DISCORD_TOKEN ในไฟล์ .env (คัดลอกจาก .env.example)');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration, // bans
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember, Partials.User, Partials.Channel],
});

// ---------------------------------------------------------------------------
// Wire up services onto the client so commands/events can reach them
// ---------------------------------------------------------------------------
client.voice247Service = new Voice247Service(client);
client.botState = {
  commandsExecuted: 0,
  eventQueueSize: 0,
};

client.commands = loadCommands();
loadEvents(client);

// ---------------------------------------------------------------------------
// ความเสถียร 24 ชม.: ดักจับ error ระดับ process ไม่ให้บอทดับ
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err);
  logEvent(client, {
    category: 'error',
    event: 'Unhandled Promise Rejection',
    success: false,
    errorDetail: err?.stack ?? String(err),
  }).catch(() => null);
});

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
  logEvent(client, {
    category: 'error',
    event: 'Uncaught Exception',
    success: false,
    errorDetail: err?.stack ?? String(err),
  }).catch(() => null);
});

// สำรองฐานข้อมูลอัตโนมัติทุก 6 ชั่วโมง
setInterval(() => {
  recoveryService.backupDatabase()
    .then((file) => console.log(`[Backup] Database backed up -> ${file}`))
    .catch((err) => console.error('[Backup] Failed:', err));
}, 6 * 60 * 60 * 1000);

// Health check log ทุก 30 นาที (เงียบ ๆ ใน console เท่านั้น ไม่ spam ห้อง log)
setInterval(() => {
  const health = recoveryService.healthCheck(client);
  if (!health.ok) console.warn('[HealthCheck] Unhealthy:', health);
}, 30 * 60 * 1000);

client.login(DISCORD_TOKEN);
