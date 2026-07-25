const { Events } = require('discord.js');
const config = require('../config/config');
const voteService = require('../systems/vote/voteService');
const reasonService = require('../systems/reason/reasonService');
const { errorEmbed, warningEmbed } = require('../utils/embeds');
const { tryLock, unlock } = require('../utils/cooldown');
const { logEvent } = require('../systems/logger/logger');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) return handleSlashCommand(interaction);
    if (interaction.isButton() && interaction.customId.startsWith('vote:')) return handleVoteButton(interaction);
    if (interaction.isModalSubmit() && interaction.customId === 'reason:submit') return handleReasonModal(interaction);
  },
};

async function handleSlashCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
    interaction.client.botState.commandsExecuted += 1;
    await logEvent(interaction.client, {
      guildId: interaction.guild?.id,
      category: 'command',
      event: `ใช้คำสั่ง /${interaction.commandName}`,
      actorId: interaction.user.id,
      command: `/${interaction.commandName}`,
    });
  } catch (err) {
    console.error(`[Command:${interaction.commandName}]`, err);
    await logEvent(interaction.client, {
      guildId: interaction.guild?.id,
      category: 'error',
      event: `คำสั่ง /${interaction.commandName} ล้มเหลว`,
      actorId: interaction.user.id,
      command: `/${interaction.commandName}`,
      success: false,
      errorDetail: err.message,
    });
    const payload = { embeds: [errorEmbed('เกิดข้อผิดพลาด', 'มีบางอย่างผิดพลาดขณะประมวลผลคำสั่งนี้')], ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
}

async function handleVoteButton(interaction) {
  const [, action, sessionId] = interaction.customId.split(':');
  const lockKey = `vote-btn:${sessionId}:${interaction.user.id}`;

  // ป้องกันการกดปุ่มซ้ำในเสี้ยววินาที (race condition)
  if (!tryLock(lockKey)) {
    return interaction.reply({ embeds: [warningEmbed('กรุณารอสักครู่', 'กำลังประมวลผลคำขอก่อนหน้าของคุณ')], ephemeral: true });
  }

  try {
    const session = voteService.getSession(sessionId);
    if (!session) {
      return interaction.reply({ embeds: [errorEmbed('ไม่พบ Session', 'การโหวตนี้ไม่มีอยู่แล้ว')], ephemeral: true });
    }

    if (action === 'result') {
      const t = voteService.tally(sessionId);
      return interaction.reply({
        embeds: [warningEmbed('ผลโหวตปัจจุบัน', `👍 เห็นด้วย: **${t.up}**\n👎 ไม่เห็นด้วย: **${t.down}**\nผู้โหวตทั้งหมด: **${t.voterCount}** คน`)],
        ephemeral: true,
      });
    }

    if (action === 'cancel') {
      if (interaction.user.id !== session.starter_id) {
        return interaction.reply({ embeds: [errorEmbed('ทำไม่ได้', 'เฉพาะผู้เริ่มโหวตเท่านั้นที่ยกเลิกได้')], ephemeral: true });
      }
      if (session.status !== 'active') {
        return interaction.reply({ embeds: [errorEmbed('ปิดไปแล้ว', 'การโหวตนี้ปิดไปแล้ว')], ephemeral: true });
      }
      voteService.cancelSession(sessionId);
      const t = voteService.tally(sessionId);
      const embed = voteService.buildVoteEmbed(session, t).setTitle(`🚫 ${interaction.message.embeds[0].title} — ยกเลิกแล้ว`);
      await interaction.update({ embeds: [embed], components: [voteService.buildVoteRow(sessionId, true)] });
      await logEvent(interaction.client, {
        guildId: interaction.guild.id,
        category: 'vote',
        event: 'ยกเลิกการโหวต',
        actorId: interaction.user.id,
        targetId: session.target_id,
      });
      return;
    }

    if (action === 'up' || action === 'down') {
      const result = voteService.castVote(session, interaction.member, action);

      if (result.status === 'CANNOT_VOTE_SELF') {
        return interaction.reply({ embeds: [errorEmbed('ทำไม่ได้', 'คุณไม่สามารถโหวตในเซสชันที่ตัวเองเป็นเป้าหมาย')], ephemeral: true });
      }
      if (result.status === 'CLOSED' || result.status === 'EXPIRED') {
        return interaction.reply({ embeds: [errorEmbed('ปิดไปแล้ว', 'การโหวตนี้สิ้นสุดแล้ว')], ephemeral: true });
      }
      if (result.status === 'ALREADY_VOTED_SAME') {
        return interaction.reply({ embeds: [warningEmbed('โหวตซ้ำ', 'คุณโหวตตัวเลือกนี้ไปแล้ว')], ephemeral: true });
      }

      const embed = voteService.buildVoteEmbed(session, result.tally);
      await interaction.update({ embeds: [embed], components: [voteService.buildVoteRow(sessionId)] });

      if (result.status === 'PASSED') {
        voteService.passSession(sessionId);
        const passedEmbed = voteService.buildVoteEmbed(session, result.tally).setTitle(`✅ ${embed.data.title} — มติผ่าน`);
        await interaction.message.edit({ embeds: [passedEmbed], components: [voteService.buildVoteRow(sessionId, true)] }).catch(() => null);
        await voteService.executePunishment(interaction.client, interaction.guild, session);

        // นับเข้าระบบ Reason Control ด้วย (ผู้เริ่มโหวตถือเป็นผู้ใช้สิทธิ์)
        const actionMap = { votekick: 'move', votetimeout: 'timeout', votemute: 'mute', votedeaf: 'deaf' };
        await reasonService.recordAndCheckThreshold(
          interaction.client, interaction.guild, session.starter_id, actionMap[session.type], session.target_id, 'ผ่านมติโหวต',
        );
      }
      return;
    }
  } catch (err) {
    console.error('[VoteButton]', err);
    const payload = { embeds: [errorEmbed('เกิดข้อผิดพลาด', 'ไม่สามารถประมวลผลการโหวตได้')], ephemeral: true };
    if (!interaction.replied && !interaction.deferred) await interaction.reply(payload).catch(() => null);
  } finally {
    unlock(lockKey);
  }
}

async function handleReasonModal(interaction) {
  const reasonText = interaction.fields.getTextInputValue('reason_text');
  await interaction.deferReply({ ephemeral: true });

  const result = await reasonService.unlockMember(interaction.client, interaction.guild, interaction.user.id, reasonText, interaction.user.id);

  if (!result.ok) {
    return interaction.editReply({ embeds: [errorEmbed('ไม่สำเร็จ', result.message)] });
  }
  await interaction.editReply({ embeds: [warningEmbed('ส่งเหตุผลสำเร็จ', 'Role ของคุณถูกคืนกลับเรียบร้อยแล้ว').setColor(config.COLORS.SUCCESS)] });
}
