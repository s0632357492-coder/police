const { SlashCommandBuilder } = require('discord.js');
const specialVoiceService = require('../systems/specialvoice/specialVoiceService');
const reasonService = require('../systems/reason/reasonService');
const { isPrivileged } = require('../systems/permissions/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voicemute')
    .setDescription('Server Mute / Unmute สมาชิกในห้องเสียง')
    .addUserOption((o) => o.setName('target').setDescription('สมาชิกเป้าหมาย').setRequired(true))
    .addBooleanOption((o) => o.setName('mute').setDescription('true = mute, false = unmute').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('เหตุผล')),

  async execute(interaction) {
    const target = interaction.options.getMember('target');
    const shouldMute = interaction.options.getBoolean('mute');
    const reason = interaction.options.getString('reason') ?? 'ไม่ระบุเหตุผล';

    if (!target?.voice?.channelId) {
      return interaction.reply({ embeds: [errorEmbed('ไม่พบเป้าหมาย', 'สมาชิกนี้ไม่ได้อยู่ในห้องเสียง')], ephemeral: true });
    }
    if (!isPrivileged(interaction.member) && !specialVoiceService.isSpecialModeratorHere(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ดำเนินการนี้ในห้องนี้')], ephemeral: true });
    }
    if (shouldMute && !specialVoiceService.canActOnTarget(interaction.member, target)) {
      return interaction.reply({ embeds: [errorEmbed('ทำไม่ได้', 'เป้าหมายได้รับการป้องกันจาก Special Channel Permission')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    await target.voice.setMute(shouldMute, reason);

    if (shouldMute) {
      await reasonService.recordAndCheckThreshold(interaction.client, interaction.guild, interaction.user.id, 'mute', target.id, reason);
    }

    await interaction.editReply({ embeds: [successEmbed(shouldMute ? 'Mute สำเร็จ' : 'Unmute สำเร็จ', `<@${target.id}>\nเหตุผล: ${reason}`)] });
  },
};
