const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { isBotAdmin } = require('../systems/permissions/permissions');
const specialVoiceService = require('../systems/specialvoice/specialVoiceService');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spch')
    .setDescription('กำหนดห้องเสียงพิเศษ: สมาชิกที่ถือ Role นี้จะเป็น Special Moderator เมื่ออยู่ในห้องนี้')
    .addChannelOption((o) => o.setName('channel').setDescription('ห้องเสียง').addChannelTypes(ChannelType.GuildVoice).setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('Role ที่จะกลายเป็น Special Moderator').setRequired(true)),

  async execute(interaction) {
    if (!isBotAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่มีสิทธิ์', 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบบอทเท่านั้น')], ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');

    await interaction.deferReply({ ephemeral: true });
    await specialVoiceService.setSpecialChannel(interaction.client, interaction.guild, channel, role, interaction.user.id);

    await interaction.editReply({
      embeds: [successEmbed(
        'ตั้งค่า Special Channel Permission สำเร็จ',
        `สมาชิกที่ถือ <@&${role.id}> จะเป็น Special Moderator เมื่ออยู่ในห้อง <#${channel.id}>\n` +
        `สามารถ Kick Voice / Mute / Deaf ได้แม้ไม่ใช่ Moderator หลัก และจะได้รับการป้องกันจากสมาชิกทั่วไป`,
      )],
    });
  },
};
