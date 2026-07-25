const { Events } = require('discord.js');
const protectionService = require('../systems/protection/protectionService');

// ตรวจจับ Timeout ที่ถูกใส่ให้บอท (communicationDisabledUntil เปลี่ยนจาก null -> มีค่า)
module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    const client = newMember.client;
    if (newMember.id !== client.user.id) return;

    const wasTimedOut = oldMember.communicationDisabledUntilTimestamp;
    const isTimedOut = newMember.communicationDisabledUntilTimestamp;
    if (!wasTimedOut && isTimedOut) {
      await protectionService.handleMemberAction(client, newMember.guild, client.user.id, { type: 'timeout', targetId: newMember.id });
    }
  },
};
