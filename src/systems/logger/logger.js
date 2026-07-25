const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../config/config');

const insertLog = db.prepare(`
  INSERT INTO logs (guild_id, category, event, actor_id, target_id, channel_id, role_id, reason, command, success, error_detail)
  VALUES (@guild_id, @category, @event, @actor_id, @target_id, @channel_id, @role_id, @reason, @command, @success, @error_detail)
`);

const getSetting = db.prepare(`SELECT value FROM settings WHERE guild_id = ? AND key = ?`);

/**
 * บันทึก Log ลงฐานข้อมูลเสมอ และส่งลงห้อง Log ของ guild นั้น ถ้ามีตั้งค่าไว้
 */
async function logEvent(client, {
  guildId,
  category,
  event,
  actorId = null,
  targetId = null,
  channelId = null,
  roleId = null,
  reason = null,
  command = null,
  success = true,
  errorDetail = null,
  extraFields = [],
}) {
  try {
    insertLog.run({
      guild_id: guildId ?? null,
      category,
      event,
      actor_id: actorId,
      target_id: targetId,
      channel_id: channelId,
      role_id: roleId,
      reason,
      command,
      success: success ? 1 : 0,
      error_detail: errorDetail,
    });
  } catch (err) {
    console.error('[Logger] Failed to write log to database:', err);
  }

  if (!guildId || !client) return;

  try {
    const row = getSetting.get(guildId, 'log_channel_id');
    // Reason system may also register its own log channel
    let logChannelId = row?.value;
    if (!logChannelId) {
      const reasonRow = db.prepare(`SELECT log_channel_id FROM reason_storage WHERE guild_id = ?`).get(guildId);
      logChannelId = reasonRow?.log_channel_id;
    }
    if (!logChannelId) return;

    const channel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`${success ? '📘' : '⚠️'} ${event}`)
      .setColor(success ? config.COLORS.INFO : config.COLORS.DANGER)
      .setTimestamp()
      .setFooter({ text: `Category: ${category}` });

    const fields = [];
    if (actorId) fields.push({ name: 'ผู้กระทำ', value: `<@${actorId}>`, inline: true });
    if (targetId) fields.push({ name: 'ผู้ถูกกระทำ', value: `<@${targetId}>`, inline: true });
    if (channelId) fields.push({ name: 'ห้อง', value: `<#${channelId}>`, inline: true });
    if (roleId) fields.push({ name: 'Role', value: `<@&${roleId}>`, inline: true });
    if (command) fields.push({ name: 'คำสั่ง', value: `\`${command}\``, inline: true });
    if (reason) fields.push({ name: 'เหตุผล', value: reason.slice(0, 1024) });
    if (errorDetail) fields.push({ name: 'Error Detail', value: `\`\`\`${String(errorDetail).slice(0, 1000)}\`\`\`` });
    fields.push(...extraFields);

    if (fields.length) embed.addFields(fields);

    await channel.send({ embeds: [embed] }).catch(() => null);
  } catch (err) {
    console.error('[Logger] Failed to send log embed:', err);
  }
}

module.exports = { logEvent };
