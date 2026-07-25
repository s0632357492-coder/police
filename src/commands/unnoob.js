const { SlashCommandBuilder } = require('discord.js');
const { isBotAdmin } = require('../systems/permissions/permissions');
const noobService = require('../systems/vote/noobService');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unnoob')
    .setDescription('เอาสมาชิกออกจากรายชื่อ Noob Target (กลับสู่เกณฑ์โหวตปกติ)')
    .addUserOption((o) => o.setName('target').setDescription('สมาชิกเป้าหมาย').setRequired(true)),

  async execute(interaction) {
    if (!isBotAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่มีสิทธิ์', 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบบอทเท่านั้น')], ephemeral: true });
    }

    const target = interaction.options.getUser('target');
    await interaction.deferReply({ ephemeral: true });
    const result = await noobService.removeNoob(interaction.client, interaction.guild, target.id, interaction.user.id);

    if (!result.ok) {
      return interaction.editReply({ embeds: [errorEmbed('ไม่พบรายชื่อ', `<@${target.id}> ไม่ได้อยู่ในรายชื่อ Noob Target`)] });
    }

    await interaction.editReply({
      embeds: [successEmbed('ถอดออกจากรายชื่อ Noob Target สำเร็จ', `<@${target.id}> กลับสู่เกณฑ์การโหวตปกติแล้ว`)],
    });
  },
};
