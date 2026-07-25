const { SlashCommandBuilder } = require('discord.js');
const config = require('../config/config');
const { isBotAdmin } = require('../systems/permissions/permissions');
const noobService = require('../systems/vote/noobService');
const voteService = require('../systems/vote/voteService');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('noob')
    .setDescription(`เพิ่มสมาชิกเข้ารายชื่อ Noob Target (สูงสุด ${config.NOOB_MAX_TARGETS} คน) — โหวตเห็นด้วยแค่ ${config.NOOB_VOTE_THRESHOLD} เสียงก็โดนลงโทษทันที`)
    .addUserOption((o) => o.setName('target').setDescription('สมาชิกเป้าหมาย').setRequired(true)),

  async execute(interaction) {
    if (!isBotAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('ไม่มีสิทธิ์', 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบบอทเท่านั้น')], ephemeral: true });
    }

    const target = interaction.options.getUser('target');
    if (target.bot) {
      return interaction.reply({ embeds: [errorEmbed('ทำไม่ได้', 'ไม่สามารถเพิ่มบอทเข้ารายชื่อ Noob ได้')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await noobService.addNoob(interaction.client, interaction.guild, target.id, interaction.user.id);

    if (!result.ok) {
      if (result.error === 'ALREADY_NOOB') {
        return interaction.editReply({ embeds: [errorEmbed('มีอยู่แล้ว', `<@${target.id}> อยู่ในรายชื่อ Noob Target อยู่แล้ว`)] });
      }
      if (result.error === 'LIMIT_REACHED') {
        const currentList = result.current.map((r) => `<@${r.user_id}>`).join(', ');
        return interaction.editReply({
          embeds: [errorEmbed('เต็มโควตาแล้ว', `รายชื่อ Noob Target เต็ม (${config.NOOB_MAX_TARGETS} คน) แล้ว\nรายชื่อปัจจุบัน: ${currentList}\nกรุณา \`/unnoob\` ใครสักคนก่อน`)],
        });
      }
      return interaction.editReply({ embeds: [errorEmbed('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่มรายชื่อได้')] });
    }

    await interaction.editReply({
      embeds: [successEmbed(
        'เพิ่มเข้ารายชื่อ Noob Target สำเร็จ',
        `<@${target.id}> ถูกเพิ่มเข้ารายชื่อ Noob Target แล้ว\n\n` +
        `เมื่อมีการเปิดโหวตลงโทษ (votekick/votetimeout/votemute/votedeaf) ต่อสมาชิกนี้ ` +
        `จะใช้เกณฑ์เพียง **${config.NOOB_VOTE_THRESHOLD} เสียงเห็นด้วย** ก็ดำเนินการลงโทษทันที (จากปกติ ${voteService.VOTE_THRESHOLD} เสียง)\n\n` +
        `ใช้ \`/unnoob\` เพื่อยกเลิก`,
      )],
    });
  },
};
