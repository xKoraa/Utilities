const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const api = require('../../imports/api');
const { colors, getLogo, createEmbed } = require('../../imports/embed');

function formatTime(secs) {
    if (!secs) return '0m';
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatNum(num) {
    return (num ?? 0).toLocaleString();
}

async function buildServerEmbed(serverId) {
    const data = await api.get(`/api/server/${serverId}/activity`);

    const topPlayers = data.top_players
        .slice(0, 5)
        .map((p, i) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            return `${medals[i]} **[${p.name}](https://steamcommunity.com/profiles/${p.steamid})** — ${formatTime(p.playtime_secs)}`;
        }).join('\n') || 'No players yet';

    const topMaps = data.maps
        .slice(0, 3)
        .map((m, i) => `\`${i + 1}.\` ${m.map} — ${formatNum(m.times_played)} rounds`)
        .join('\n') || 'No map data yet';

    return createEmbed(colors.primary)
        .setTitle(`📊 ${serverId}`)
        .addFields(
            {
                name: '📈 Overview',
                value: [
                    `**Rounds Played:** ${formatNum(data.total_rounds)}`,
                    `**Unique Players:** ${formatNum(data.unique_players)}`,
                    `**Total Playtime:** ${formatTime(data.total_playtime_secs)}`
                ].join('\n'),
                inline: false
            },
            { name: '🗺️ Top Maps', value: topMaps, inline: true },
            { name: '👑 Top Players', value: topPlayers, inline: true }
        );
}

async function buildAllServersEmbed(servers) {
    let totalRounds = 0;
    let totalPlaytime = 0;
    const serverStats = [];

    for (const serverId of servers) {
        try {
            const data = await api.get(`/api/server/${serverId}/activity`);
            totalRounds += data.total_rounds ?? 0;
            totalPlaytime += data.total_playtime_secs ?? 0;
            serverStats.push({
                id: serverId,
                rounds: data.total_rounds ?? 0,
                players: data.unique_players ?? 0,
                playtime: data.total_playtime_secs ?? 0
            });
        } catch { }
    }

    serverStats.sort((a, b) => b.rounds - a.rounds);

    const serverList = serverStats.map(s =>
        `\`${s.id}\` — ${formatNum(s.rounds)} rounds • ${formatNum(s.players)} players • ${formatTime(s.playtime)}`
    ).join('\n') || 'No data yet';

    return createEmbed(colors.success)
        .setTitle('📊 KZG — All Servers')
        .addFields(
            {
                name: '📈 Network Overview',
                value: [
                    `**Total Rounds:** ${formatNum(totalRounds)}`,
                    `**Total Playtime:** ${formatTime(totalPlaytime)}`,
                    `**Servers:** ${servers.length}`
                ].join('\n'),
                inline: false
            },
            { name: '🖥️ Server Breakdown', value: serverList, inline: false }
        );
}

function buildDropdown(servers, selected) {
    const options = [
        new StringSelectMenuOptionBuilder()
            .setLabel('All Servers')
            .setDescription('View combined stats for all servers')
            .setValue('all')
            .setEmoji('🌐')
            .setDefault(selected === 'all')
    ];

    for (const serverId of servers) {
        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(serverId)
                .setDescription(`View stats for ${serverId}`)
                .setValue(serverId)
                .setEmoji('🖥️')
                .setDefault(selected === serverId)
        );
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('server_select')
            .setPlaceholder('Select a server...')
            .addOptions(options)
    );
}

module.exports = {
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('View KZG server activity stats'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const allActivity = await api.get('/api/server/all/activity');
            const servers = allActivity.servers ?? [];

            if (servers.length === 0) {
                return await interaction.editReply('❌ No server data found yet.');
            }

            const embed = await buildAllServersEmbed(servers);
            const dropdown = buildDropdown(servers, 'all');
            const logo = getLogo();

            const message = await interaction.editReply({
                embeds: [embed],
                files: [logo],
                components: [dropdown]
            });

            const collector = message.createMessageComponentCollector({
                time: 120000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: '❌ This menu belongs to someone else.',
                        ephemeral: true
                    });
                }

                await i.deferUpdate();

                const selected = i.values[0];
                let newEmbed;

                if (selected === 'all') {
                    newEmbed = await buildAllServersEmbed(servers);
                } else {
                    newEmbed = await buildServerEmbed(selected);
                }

                const newLogo = getLogo();

                await interaction.editReply({
                    embeds: [newEmbed],
                    files: [newLogo],
                    components: [buildDropdown(servers, selected)]
                });
            });

            collector.on('end', async () => {
                try {
                    await interaction.editReply({ components: [] });
                } catch { }
            });

        } catch (err) {
            console.error('[/server]', err.message);
            await interaction.editReply('❌ Something went wrong fetching server data.');
        }
    }
};