const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { isBotAdmin } = require('../systems/permissions/permissions');
const specialVoiceService = require('../systems/specialvoice/specialVoiceService');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delspch')
    .setDescription('ยกเลิก Special Channel Permission ของห้องเสียง')
    .addChannelOption((o) => o.setName('channel').setDescription('ห้องเสียง').addChannelTypes(ChannelType.GuildVoice).setRequired(true)),

  async execute(interaction) {
    if (!isBotAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่มีสิทธิ์', 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบบอทเท่านั้น')], ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    await interaction.deferReply({ ephemeral: true });
    await specialVoiceService.removeSpecialChannel(interaction.client, interaction.guild, channel, interaction.user.id);

    await interaction.editReply({ embeds: [successEmbed('ยกเลิกสำเร็จ', `ยกเลิก Special Channel Permission ของ <#${channel.id}> แล้ว`)] });
  },
};
