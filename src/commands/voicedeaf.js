const { SlashCommandBuilder } = require('discord.js');
const specialVoiceService = require('../systems/specialvoice/specialVoiceService');
const reasonService = require('../systems/reason/reasonService');
const { isPrivileged } = require('../systems/permissions/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voicedeaf')
    .setDescription('Server Deafen / Undeafen สมาชิกในห้องเสียง')
    .addUserOption((o) => o.setName('target').setDescription('สมาชิกเป้าหมาย').setRequired(true))
    .addBooleanOption((o) => o.setName('deaf').setDescription('true = deafen, false = undeafen').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('เหตุผล')),

  async execute(interaction) {
    const target = interaction.options.getMember('target');
    const shouldDeaf = interaction.options.getBoolean('deaf');
    const reason = interaction.options.getString('reason') ?? 'ไม่ระบุเหตุผล';

    if (!target?.voice?.channelId) {
      return interaction.reply({ embeds: [errorEmbed('ไม่พบเป้าหมาย', 'สมาชิกนี้ไม่ได้อยู่ในห้องเสียง')], ephemeral: true });
    }
    if (!isPrivileged(interaction.member) && !specialVoiceService.isSpecialModeratorHere(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ดำเนินการนี้ในห้องนี้')], ephemeral: true });
    }
    if (shouldDeaf && !specialVoiceService.canActOnTarget(interaction.member, target)) {
      return interaction.reply({ embeds: [errorEmbed('ทำไม่ได้', 'เป้าหมายได้รับการป้องกันจาก Special Channel Permission')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    await target.voice.setDeaf(shouldDeaf, reason);

    if (shouldDeaf) {
      await reasonService.recordAndCheckThreshold(interaction.client, interaction.guild, interaction.user.id, 'deaf', target.id, reason);
    }

    await interaction.editReply({ embeds: [successEmbed(shouldDeaf ? 'Deafen สำเร็จ' : 'Undeafen สำเร็จ', `<@${target.id}>\nเหตุผล: ${reason}`)] });
  },
};
