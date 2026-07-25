const { SlashCommandBuilder } = require('discord.js');
const config = require('../config/config');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('ดูคู่มือคำสั่งทั้งหมดที่สมาชิกทั่วไปใช้ได้'),

  async execute(interaction) {
    const publicCommands = [...interaction.client.commands.values()]
      .filter((cmd) => !config.ADMIN_ONLY_COMMANDS.includes(cmd.data.name))
      .sort((a, b) => a.data.name.localeCompare(b.data.name));

    const embed = baseEmbed({
      title: '📖 คู่มือคำสั่ง (สำหรับสมาชิกทั่วไป)',
      description: 'คำสั่งของผู้ดูแลระบบไม่ได้แสดงในนี้ เนื่องจากใช้ได้เฉพาะผู้ถือยศที่กำหนดเท่านั้น',
      color: config.COLORS.PRIMARY,
    });

    for (const cmd of publicCommands) {
      const options = cmd.data.options?.length
        ? ' `' + cmd.data.options.map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(' ') + '`'
        : '';
      embed.addFields({
        name: `/${cmd.data.name}${options}`,
        value: cmd.data.description || 'ไม่มีคำอธิบาย',
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
