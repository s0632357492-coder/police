const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { isBotAdmin } = require('../systems/permissions/permissions');
const reasonService = require('../systems/reason/reasonService');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setreason')
    .setDescription('ตั้งค่าระบบ Reason Control: ห้องส่งเหตุผล และห้อง Log')
    .addChannelOption((o) => o.setName('reason_channel').setDescription('ห้องสำหรับส่งเหตุผล').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((o) => o.setName('log_channel').setDescription('ห้องสำหรับบันทึก Log').addChannelTypes(ChannelType.GuildText).setRequired(true)),

  async execute(interaction) {
    if (!isBotAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่มีสิทธิ์', 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบบอทเท่านั้น')], ephemeral: true });
    }

    const reasonChannel = interaction.options.getChannel('reason_channel');
    const logChannel = interaction.options.getChannel('log_channel');

    await interaction.deferReply({ ephemeral: true });

    try {
      const lockRole = await reasonService.setupReasonSystem(interaction.client, interaction.guild, reasonChannel, logChannel, interaction.user.id);
      await interaction.editReply({
        embeds: [successEmbed(
          'ตั้งค่า Reason Control สำเร็จ',
          `ห้องเหตุผล: <#${reasonChannel.id}>\nห้อง Log: <#${logChannel.id}>\nRole ที่สร้าง: <@&${lockRole.id}>\n\n` +
          `เมื่อ Moderator ใช้สิทธิ์ (Kick/Ban/Mute/Deaf/Timeout/Move) เกิน 5 ครั้งภายในเวลาที่กำหนด ระบบจะถอด Role ทั้งหมด ` +
          `และใส่ Role นี้แทน จนกว่าจะส่งเหตุผลผ่านห้องดังกล่าว`,
        )],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('เกิดข้อผิดพลาด', err.message)] });
    }
  },
};
