const os = require('os');
const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../config/config');

const getRecentLogs = db.prepare(`
  SELECT * FROM logs ORDER BY created_at DESC LIMIT ?
`);

const CATEGORY_ICON = {
  voice: '🔊', vote: '🗳️', permission: '🔐', reason: '📝',
  protection: '🛡️', command: '⌨️', error: '❌', database: '🗄️', warning: '⚠️',
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function getDbStats() {
  const tables = ['users', 'vote_sessions', 'voice247', 'special_channels', 'punishment_history', 'logs'];
  const counts = {};
  for (const t of tables) {
    try {
      counts[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    } catch {
      counts[t] = 'N/A';
    }
  }
  return counts;
}

function buildDashboardEmbed(client, eventQueueSize = 0, commandsExecuted = 0) {
  const cpuLoad = os.loadavg()[0].toFixed(2);
  const memUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const memTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const ping = Math.round(client.ws.ping);
  const uptime = formatUptime(process.uptime());
  const dbStats = getDbStats();

  let voiceConnections = 0;
  try { voiceConnections = client.voice247Service?.connections?.size ?? 0; } catch { /* noop */ }

  const embed = new EmbedBuilder()
    .setTitle('🛠️ Dev Tool Dashboard — Cyber Dark')
    .setColor(config.COLORS.DARK)
    .setDescription('```ansi\n\u001b[35mLive system diagnostics — Voice Management Bot\u001b[0m\n```')
    .addFields(
      { name: '💻 CPU Load', value: `\`${cpuLoad}\``, inline: true },
      { name: '🧠 RAM', value: `\`${memUsed} MB / ${memTotal} GB\``, inline: true },
      { name: '📶 Ping', value: `\`${ping} ms\``, inline: true },
      { name: '⏱️ Uptime', value: `\`${uptime}\``, inline: true },
      { name: '🏰 Guilds', value: `\`${client.guilds.cache.size}\``, inline: true },
      { name: '🔊 Voice247 Active', value: `\`${voiceConnections}\``, inline: true },
      { name: '👥 Members Cached', value: `\`${client.users.cache.size}\``, inline: true },
      { name: '⌨️ Commands (session)', value: `\`${commandsExecuted}\``, inline: true },
      { name: '📥 Event Queue', value: `\`${eventQueueSize}\``, inline: true },
      {
        name: '🗄️ Database',
        value: Object.entries(dbStats).map(([k, v]) => `\`${k}\`: **${v}**`).join('  ·  '),
      },
    )
    .setFooter({ text: `อัปเดตทุก ${config.DASHBOARD_UPDATE_INTERVAL_MS / 60000} นาที` })
    .setTimestamp();

  const logs = getRecentLogs.all(config.DASHBOARD_LIVE_LOG_LIMIT);
  if (logs.length) {
    const liveLog = logs.map((l) => {
      const icon = CATEGORY_ICON[l.category] ?? (l.success ? '📘' : '⚠️');
      const time = `<t:${l.created_at}:T>`;
      return `${icon} ${time} — **${l.event}**${l.actor_id ? ` (<@${l.actor_id}>)` : ''}`;
    }).join('\n');
    embed.addFields({ name: '📡 Live Log', value: liveLog.slice(0, 1024) });
  }

  return embed;
}

/** เริ่มลูปอัปเดต Dashboard ด้วยการ Edit Message เดิม ไม่ส่งข้อความใหม่ */
function startDashboardLoop(client, message, state) {
  if (message._dashboardInterval) clearInterval(message._dashboardInterval);
  message._dashboardInterval = setInterval(async () => {
    try {
      const embed = buildDashboardEmbed(client, state.eventQueueSize ?? 0, state.commandsExecuted ?? 0);
      await message.edit({ embeds: [embed] });
    } catch (err) {
      console.error('[Dashboard] Failed to update:', err);
    }
  }, config.DASHBOARD_UPDATE_INTERVAL_MS);
  return message._dashboardInterval;
}

module.exports = { buildDashboardEmbed, startDashboardLoop };
