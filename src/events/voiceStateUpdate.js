const { Events } = require('discord.js');
const protectionService = require('../systems/protection/protectionService');
const voteService = require('../systems/vote/voteService');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const client = newState.client;
    const botUserId = client.user.id;
    const guild = newState.guild;
    const member = newState.member ?? oldState.member;

    // --- 1) บอทถูกดึงออก/ย้ายออกจากห้อง 24/7 ---
    if (member?.id === botUserId) {
      // ถูก disconnect ทั้งหมด (ออกจากห้องเสียงไปเลย)
      if (oldState.channelId && !newState.channelId) {
        await protectionService.handleVoiceInterference(client, guild, botUserId, { type: 'disconnect', targetId: botUserId });
      } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await protectionService.handleVoiceInterference(client, guild, botUserId, { type: 'move', targetId: botUserId });
      }
      // ในทุกกรณี ให้ voice247Service ตรวจสอบและกลับเข้าห้องเดิมถ้าจำเป็น
      await client.voice247Service.handleForcedMove(oldState, newState);
      return;
    }

    // --- 2) ตรวจสอบการฝ่าฝืนกลับเข้าห้องหลังโดน Vote Kick ---
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      await voteService.handleVoteKickReentry(client, guild, member).catch((err) =>
        console.error('[VoteKickReentry]', err),
      );
    }
  },
};
