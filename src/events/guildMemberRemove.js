const { Events } = require('discord.js');
const protectionService = require('../systems/protection/protectionService');

// สมาชิกออกจากเซิร์ฟเวอร์ — อาจเป็นการออกเอง หรือถูก Kick
// ใช้ audit log แยกแยะ: ถ้าเป็นบอทที่ถูก kick, protectionService จะตรวจสอบต่อ
module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const client = member.client;
    if (member.id !== client.user.id) return; // สนใจเฉพาะกรณีบอทถูกเตะ
    await protectionService.handleMemberAction(client, member.guild, client.user.id, { type: 'kick', targetId: member.id });
  },
};
