const { SlashCommandBuilder } = require('discord.js');
const { isBotAdmin } = require('../systems/permissions/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { checkAndSetCooldown } = require('../utils/cooldown');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stopon')
    .setDescription('ปิดระบบ Voice 24/7 และให้บอทออกจากห้องเสียง'),

  async execute(interaction) {
    if (!isBotAdmin(interaction.member)) {
      return interaction.reply({
        embeds: [errorEmbed('ไม่มีสิทธิ์', 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบบอทเท่านั้น')],
        ephemeral: true,
      });
    }

    const cd = checkAndSetCooldown(interaction.user.id, 'stopon');
    if (cd > 0) {
      return interaction.reply({ embeds: [errorEmbed('Cooldown', `กรุณารอ ${Math.ceil(cd / 1000)} วินาที`)], ephemeral: true });
    }

    if (!interaction.client.voice247Service.isEnabled(interaction.guild.id)) {
      return interaction.reply({ embeds: [errorEmbed('ยังไม่ได้เปิดใช้งาน', 'ระบบ Voice 24/7 ยังไม่ได้ถูกเปิดใช้งานในเซิร์ฟเวอร์นี้')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    await interaction.client.voice247Service.disable(interaction.guild, interaction.user.id);
    await interaction.editReply({ embeds: [successEmbed('ปิดใช้งาน Voice 24/7', 'บอทออกจากห้องเสียงเรียบร้อยแล้ว')] });
  },
};
