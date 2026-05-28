const { SlashCommandBuilder } = require('discord.js');
const api = require('../../imports/api');
const { colors, getLogo, createEmbed } = require('../../imports/embed');

async function getSteamProfile(steamid) {
    try {
        const response = await fetch(
            `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API}&steamids=${steamid}`
        );
        const data = await response.json();
        return data.response.players[0] ?? null;
    } catch {
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player')
        .setDescription('Look up a CS2 player profile')
        .addStringOption(option =>
            option
                .setName('steamid')
                .setDescription('The player\'s SteamID64')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const steamid = interaction.options.getString('steamid');

        try {
            const [player, steam] = await Promise.all([
                api.get(`/api/player/${steamid}`),
                getSteamProfile(steamid)
            ]);

            const hours = Math.floor((player.playtime_secs ?? 0) / 3600);
            const minutes = Math.floor(((player.playtime_secs ?? 0) % 3600) / 60);
            const playtime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            const firstSeen = Math.floor(new Date(player.first_seen).getTime() / 1000);
            const lastSeen = Math.floor(new Date(player.last_seen).getTime() / 1000);

            const steamUrl = `https://steamcommunity.com/profiles/${steamid}`;
            const displayName = steam?.personaname ?? player.name;
            const avatar = steam?.avatarfull ?? null;

            const kdr = player.deaths > 0
                ? (player.kills / player.deaths).toFixed(2)
                : player.kills?.toString() ?? '0';

            const status = [
                player.is_watched ? '👁️ Watchlisted' : '',
                player.is_admin ? '🛡️ Admin' : ''
            ].filter(Boolean).join('\n') || '✅ Clean';

            const embedColor = player.is_watched ? colors.warning : colors.primary;
            const logo = getLogo();

            const embed = createEmbed(embedColor)
                .setAuthor({
                    name: displayName,
                    url: steamUrl,
                    iconURL: avatar ?? undefined
                })
                .setThumbnail(avatar)
                .addFields(
                    { name: '🆔 SteamID', value: `[${steamid}](${steamUrl})`, inline: false },
                    { name: '🕒 First Seen', value: `<t:${firstSeen}:R>`, inline: true },
                    { name: '🕒 Last Seen', value: `<t:${lastSeen}:R>`, inline: true },
                    { name: '⚡ Status', value: status, inline: true },
                    { name: '⏱️ Playtime', value: playtime, inline: true },
                    { name: '🎮 Rounds', value: player.rounds_played?.toString() ?? '0', inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: '🎯 KDR', value: kdr, inline: true },
                    { name: '💀 HS%', value: `${player.hs_percentage ?? 0}%`, inline: true },
                    { name: '💥 ADR', value: player.adr?.toString() ?? '0', inline: true }
                );

            await interaction.editReply({ embeds: [embed], files: [logo] });

        } catch (err) {
            if (err.message.includes('404')) {
                await interaction.editReply('❌ Player not found. Have they connected to a KZG server?');
            } else {
                console.error('[/player]', err.message);
                await interaction.editReply('❌ Something went wrong fetching that player.');
            }
        }
    }
};