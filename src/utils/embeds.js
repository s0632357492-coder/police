const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

function baseEmbed({ title, description, color = config.COLORS.PRIMARY, footer = 'Voice Management System' }) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description ?? null)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: footer });
}

function successEmbed(title, description) {
  return baseEmbed({ title: `${config.EMOJI.SUCCESS} ${title}`, description, color: config.COLORS.SUCCESS });
}

function errorEmbed(title, description) {
  return baseEmbed({ title: `${config.EMOJI.ERROR} ${title}`, description, color: config.COLORS.DANGER });
}

function warningEmbed(title, description) {
  return baseEmbed({ title: `${config.EMOJI.WARNING} ${title}`, description, color: config.COLORS.WARNING });
}

module.exports = { baseEmbed, successEmbed, errorEmbed, warningEmbed };
