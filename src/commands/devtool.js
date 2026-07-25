const { SlashCommandBuilder } = require('discord.js');
const { isBotAdmin } = require('../systems/permissions/permissions');
const { buildDashboardEmbed, startDashboardLoop } = require('../systems/devtool/dashboardService');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devtool')
    .setDescription('เปิด Dashboard สำหรับตรวจสอบสถานะบอทแบบเรียลไทม์'),

  async execute(interaction) {
    if (!isBotAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่มีสิทธิ์', 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบบอทเท่านั้น')], ephemeral: true });
    }

    await interaction.deferReply();
    const state = interaction.client.botState;
    const embed = buildDashboardEmbed(interaction.client, 0, state.commandsExecuted);
    await interaction.editReply({ embeds: [embed] });

    const message = await interaction.fetchReply();
    startDashboardLoop(interaction.client, message, state);
  },
};
