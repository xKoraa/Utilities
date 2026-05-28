const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../assets/KZG-White.png');
const FOOTER_TEXT = 'KZG';

const colors = {
    primary: 0xE3000B,    // KZG red
    dark: 0x1A1A1A,       // neutral/dark
    success: 0x57F287,    // green
    warning: 0xFF6B35,    // orange
    danger: 0xE3000B,     // red
    info: 0x5865F2,       // blue
    ct: 1752220,          // CT teal
    t: 15105570           // T orange
};

function getLogo() {
    return new AttachmentBuilder(LOGO_PATH, { name: 'logo.png' });
}

function createEmbed(color = colors.primary) {
    return new EmbedBuilder()
        .setColor(color)
        .setFooter({
            text: FOOTER_TEXT,
            iconURL: 'attachment://logo.png'
        })
        .setTimestamp();
}

module.exports = { colors, getLogo, createEmbed };