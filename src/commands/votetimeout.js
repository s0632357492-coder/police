const { SlashCommandBuilder } = require('discord.js');
const { startVoteCommand } = require('../utils/voteCommandShared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('votetimeout')
    .setDescription('เริ่มโหวต Timeout สมาชิก')
    .addUserOption((o) => o.setName('target').setDescription('สมาชิกเป้าหมาย').setRequired(true))
    .addIntegerOption((o) => o.setName('duration').setDescription('ระยะเวลาลงโทษ (นาที)').setRequired(true).setMinValue(1).setMaxValue(1440)),
  async execute(interaction) {
    await startVoteCommand(interaction, 'votetimeout');
  },
};
