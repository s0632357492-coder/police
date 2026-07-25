const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const reasonService = require('../systems/reason/reasonService');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reason')
    .setDescription('ส่งเหตุผลเพื่อขอคืน Role (ใช้เมื่อถูกล็อกโดยระบบ Reason Control)'),

  async execute(interaction) {
    const cfg = reasonService.getConfig.get(interaction.guild.id);
    if (!cfg) {
      return interaction.reply({ embeds: [errorEmbed('ยังไม่ได้ตั้งค่า', 'เซิร์ฟเวอร์นี้ยังไม่ได้ตั้งค่าระบบ Reason Control')], ephemeral: true });
    }
    if (!reasonService.isLocked(interaction.guild.id, interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่ได้ถูกล็อก', 'บัญชีของคุณไม่ได้อยู่ในสถานะ Reason Lock')], ephemeral: true });
    }
    if (interaction.channelId !== cfg.reason_channel_id) {
      return interaction.reply({ embeds: [errorEmbed('ผิดห้อง', `กรุณาใช้คำสั่งนี้ในห้อง <#${cfg.reason_channel_id}>`)], ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('reason:submit')
      .setTitle('ชี้แจงเหตุผลการใช้สิทธิ์')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason_text')
            .setLabel('อธิบายเหตุผลการใช้สิทธิ์ของคุณ')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(1000)
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  },
};
