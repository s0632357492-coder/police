const { Events, ActivityType } = require('discord.js');
const { logEvent } = require('../systems/logger/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setPresence({
      activities: [{ name: 'Voice Management System', type: ActivityType.Watching }],
      status: 'online',
    });

    // Auto Recovery: ตรวจสอบฐานข้อมูล voice247 แล้วกลับเข้าห้องเดิมทุกเซิร์ฟเวอร์
    try {
      await client.voice247Service.recoverAll();
      console.log('[Recovery] Voice247 auto-recovery completed');
    } catch (err) {
      console.error('[Recovery] Voice247 auto-recovery failed:', err);
    }

    await logEvent(client, {
      category: 'command',
      event: `บอทออนไลน์ — ${client.guilds.cache.size} เซิร์ฟเวอร์`,
    });
  },
};
