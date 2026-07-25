const { SlashCommandBuilder, ChannelType } = require('discord.js');
const config = require('../config/config');
const { isBotAdmin } = require('../systems/permissions/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { checkAndSetCooldown } = require('../utils/cooldown');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('on247')
    .setDescription('ให้บอทเข้าห้องเสียงและอยู่ตลอด 24 ชั่วโมง (ใช้ในห้องเสียงที่ต้องการ)'),

  async execute(interaction) {
    if (!isBotAdmin(interaction.member)) {
      return interaction.reply({
        embeds: [errorEmbed('ไม่มีสิทธิ์', 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบบอทเท่านั้น')],
        ephemeral: true,
      });
    }

    const cd = checkAndSetCooldown(interaction.user.id, 'on247');
    if (cd > 0) {
      return interaction.reply({ embeds: [errorEmbed('Cooldown', `กรุณารอ ${Math.ceil(cd / 1000)} วินาที`)], ephemeral: true });
    }

    const voiceState = interaction.member.voice;
    if (!voiceState?.channelId || voiceState.channel?.type !== ChannelType.GuildVoice) {
      return interaction.reply({
        embeds: [errorEmbed('ต้องอยู่ในห้องเสียง', 'กรุณาเข้าห้องเสียงที่ต้องการก่อนใช้คำสั่งนี้')],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.client.voice247Service.enable(interaction.guild, voiceState.channel, interaction.user.id);
      await interaction.editReply({
        embeds: [successEmbed('เปิดใช้งาน Voice 24/7', `บอทจะอยู่ในห้อง <#${voiceState.channel.id}> ตลอดเวลา จนกว่าจะใช้ \`/stopon\``)],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('เกิดข้อผิดพลาด', err.message)] });
    }
  },
};
