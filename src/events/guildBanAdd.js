const { Events } = require('discord.js');
const protectionService = require('../systems/protection/protectionService');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    const client = ban.client;
    if (ban.user.id !== client.user.id) return;
    await protectionService.handleMemberAction(client, ban.guild, client.user.id, { type: 'ban', targetId: ban.user.id });
  },
};
