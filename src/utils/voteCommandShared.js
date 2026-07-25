const { ChannelType } = require('discord.js');
const voteService = require('../systems/vote/voteService');
const { errorEmbed } = require('./embeds');
const { checkAndSetCooldown } = require('./cooldown');

/**
 * ตรรกะร่วมสำหรับ /votekick /votetimeout /votemute /votedeaf
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {'votekick'|'votetimeout'|'votemute'|'votedeaf'} type
 */
async function startVoteCommand(interaction, type) {
  const target = interaction.options.getMember('target');
  const duration = interaction.options.getInteger('duration');

  if (!target) {
    return interaction.reply({ embeds: [errorEmbed('ไม่พบเป้าหมาย', 'กรุณาระบุสมาชิกที่ต้องการโหวต')], ephemeral: true });
  }
  if (target.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed('ทำไม่ได้', 'คุณไม่สามารถเริ่มโหวตเล่นงานตัวเองได้')], ephemeral: true });
  }
  if (target.user.bot) {
    return interaction.reply({ embeds: [errorEmbed('ทำไม่ได้', 'ไม่สามารถโหวตเล่นงานบอทได้')], ephemeral: true });
  }
  if (!duration || duration < 1 || duration > 1440) {
    return interaction.reply({ embeds: [errorEmbed('ระยะเวลาไม่ถูกต้อง', 'กรุณาระบุระยะเวลาระหว่าง 1–1440 นาที')], ephemeral: true });
  }

  const cd = checkAndSetCooldown(interaction.user.id, type, 10_000);
  if (cd > 0) {
    return interaction.reply({ embeds: [errorEmbed('Cooldown', `กรุณารอ ${Math.ceil(cd / 1000)} วินาทีก่อนเริ่มโหวตใหม่ (ป้องกัน Spam)`)], ephemeral: true });
  }

  if (interaction.channel.type !== ChannelType.GuildText && interaction.channel.type !== ChannelType.GuildAnnouncement) {
    return interaction.reply({ embeds: [errorEmbed('ห้องไม่รองรับ', 'กรุณาใช้คำสั่งนี้ในห้องข้อความ')], ephemeral: true });
  }

  const { session, error } = voteService.createSession({
    guildId: interaction.guild.id,
    type,
    targetId: target.id,
    starterId: interaction.user.id,
    durationMinutes: duration,
    channelId: interaction.channel.id,
  });

  if (error === 'DUPLICATE_ACTIVE_VOTE') {
    return interaction.reply({ embeds: [errorEmbed('มีโหวตค้างอยู่', `มีการโหวตประเภทนี้ต่อ <@${target.id}> ที่ยังไม่จบอยู่แล้ว`)], ephemeral: true });
  }

  const embed = voteService.buildVoteEmbed(session, voteService.tally(session.session_id));
  const row = voteService.buildVoteRow(session.session_id);

  await interaction.reply({ embeds: [embed], components: [row] });
  const message = await interaction.fetchReply();
  voteService.attachMessage(session.session_id, message.id);

  // ตั้งเวลาให้หมดอายุอัตโนมัติถ้าไม่ถึงเกณฑ์ทันเวลา
  setTimeout(async () => {
    const current = voteService.getSession(session.session_id);
    if (current.status !== 'active') return;
    voteService.expireSession(session.session_id);
    try {
      const finalTally = voteService.tally(session.session_id);
      const expiredEmbed = voteService.buildVoteEmbed({ ...current, status: 'expired' }, finalTally)
        .setTitle(`⌛ ${embed.data.title} — หมดเวลา`);
      await message.edit({ embeds: [expiredEmbed], components: [voteService.buildVoteRow(session.session_id, true)] });
    } catch { /* message may be deleted */ }
  }, duration * 60 * 1000);
}

module.exports = { startVoteCommand };
