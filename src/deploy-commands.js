require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./utils/loadCommands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('กรุณาตั้งค่า DISCORD_TOKEN และ CLIENT_ID ใน .env ก่อน');
  process.exit(1);
}

const commands = loadCommands();
const body = [...commands.values()].map((c) => c.data.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`กำลังลงทะเบียน ${body.length} slash commands...`);
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    await rest.put(route, { body });

    console.log(`ลงทะเบียนสำเร็จ ${body.length} คำสั่ง ${GUILD_ID ? `(guild: ${GUILD_ID}, อัปเดตทันที)` : '(global, อาจใช้เวลาถึง 1 ชม.)'}`);
  } catch (err) {
    console.error('ลงทะเบียนคำสั่งล้มเหลว:', err);
    process.exit(1);
  }
})();
