const { SlashCommandBuilder } = require('discord.js');
const api = require('../../imports/api');
const { colors, getLogo, createEmbed } = require('../../imports/embed');
const {
    createWatchlistChannel,
    findWatchlistChannel,
    removeWatchlistChannel
} = require('../../imports/watchlist');

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
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName('watchlist')
        .setDescription('Manage the player watchlist')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a player to the watchlist')
                .addStringOption(opt =>
                    opt.setName('steamid').setDescription('SteamID64').setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('reason').setDescription('Reason for watching').setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a player from the watchlist')
                .addStringOption(opt =>
                    opt.setName('steamid').setDescription('SteamID64').setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all watched players')
        )
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('View details on a watched player')
                .addStringOption(opt =>
                    opt.setName('steamid').setDescription('SteamID64').setRequired(true)
                )
        ),

    async execute(interaction) {
        const member = interaction.member;
        const sub = interaction.options.getSubcommand();

        const isHeadAdmin = member.roles.cache.has(process.env.headadmin)
            || member.roles.cache.has(process.env.manager)
            || member.roles.cache.has(process.env.management);

        const isStaff = member.roles.cache.has(process.env.agreed) || isHeadAdmin;

        if ((sub === 'add' || sub === 'remove') && !isHeadAdmin) {
            return interaction.reply({
                content: '❌ You need to be Head Admin or above to manage the watchlist.',
                ephemeral: true
            });
        }

        if ((sub === 'list' || sub === 'info') && !isStaff) {
            return interaction.reply({
                content: '❌ You don\'t have permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const steamid = interaction.options.getString('steamid');
        const logo = getLogo();

        try {
            if (sub === 'add') {
                const reason = interaction.options.getString('reason');

                let player;
                try {
                    player = await api.get(`/api/player/${steamid}`);
                } catch {
                    return await interaction.editReply('❌ Player not found. Have they connected to a KZG server?');
                }

                await api.post('/api/watchlist', {
                    steamid,
                    name: player.name,
                    reason,
                    added_by_steamid: null
                });

                const existing = await findWatchlistChannel(interaction.client, steamid);
                if (!existing) {
                    const channel = await createWatchlistChannel(interaction.client, steamid, player.name);

                    const steam = await getSteamProfile(steamid);
                    const avatar = steam?.avatarfull ?? null;
                    const displayName = steam?.personaname ?? player.name;
                    const steamUrl = `https://steamcommunity.com/profiles/${steamid}`;
                    const firstSeen = Math.floor(new Date(player.first_seen).getTime() / 1000);
                    const lastSeen = Math.floor(new Date(player.last_seen).getTime() / 1000);

                    const kdr = player.deaths > 0
                        ? (player.kills / player.deaths).toFixed(2)
                        : player.kills?.toString() ?? '0';

                    const openingEmbed = createEmbed(colors.warning)
                        .setTitle('👁️ Player Added to Watchlist')
                        .setAuthor({
                            name: displayName,
                            url: steamUrl,
                            iconURL: avatar ?? undefined
                        })
                        .setThumbnail(avatar)
                        .addFields(
                            { name: '🆔 SteamID', value: `[${steamid}](${steamUrl})`, inline: false },
                            { name: '📋 Reason', value: reason, inline: false },
                            { name: '👤 Added By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '🕒 First Seen', value: `<t:${firstSeen}:R>`, inline: true },
                            { name: '🕒 Last Seen', value: `<t:${lastSeen}:R>`, inline: true },
                            { name: '🎯 KDR', value: kdr, inline: true },
                            { name: '💀 HS%', value: `${player.hs_percentage ?? 0}%`, inline: true },
                            { name: '💥 ADR', value: player.adr?.toString() ?? '0', inline: true }
                        );

                    await channel.send({ embeds: [openingEmbed], files: [getLogo()] });
                    await interaction.editReply(`✅ **${displayName}** added to watchlist. Channel created: <#${channel.id}>`);
                } else {
                    await interaction.editReply(`✅ **${player.name}** added to watchlist. Channel already exists: <#${existing.id}>`);
                }

            } else if (sub === 'remove') {
                let player;
                try {
                    player = await api.get(`/api/player/${steamid}`);
                } catch {
                    return await interaction.editReply('❌ Player not found.');
                }

                await api.del(`/api/watchlist/${steamid}`);
                await removeWatchlistChannel(interaction.client, steamid, player.name);
                await interaction.editReply(`✅ **${player.name}** removed from watchlist. Channel ${process.env.WATCHLIST_ARCHIVE === 'true' ? 'archived' : 'deleted'}.`);

            } else if (sub === 'list') {
                const watchlist = await api.get('/api/watchlist');

                if (!watchlist || watchlist.length === 0) {
                    return await interaction.editReply('✅ The watchlist is empty.');
                }

                const list = watchlist.map((w, i) => {
                    const addedAt = Math.floor(new Date(w.added_at).getTime() / 1000);
                    return `\`${String(i + 1).padStart(2, '0')}\` **[${w.name}](https://steamcommunity.com/profiles/${w.steamid})** — <t:${addedAt}:R>\n${w.reason ?? 'No reason provided'}`;
                }).join('\n\n');

                const embed = createEmbed(colors.warning)
                    .setTitle(`👁️ Watchlist — ${watchlist.length} player${watchlist.length !== 1 ? 's' : ''}`)
                    .setDescription(list);

                await interaction.editReply({ embeds: [embed], files: [logo] });

            } else if (sub === 'info') {
                const watchlist = await api.get('/api/watchlist');
                const entry = watchlist.find(w => w.steamid === steamid);

                if (!entry) {
                    return await interaction.editReply('❌ That player is not on the watchlist.');
                }

                const [player, steam] = await Promise.all([
                    api.get(`/api/player/${steamid}`),
                    getSteamProfile(steamid)
                ]);

                const avatar = steam?.avatarfull ?? null;
                const displayName = steam?.personaname ?? player.name;
                const steamUrl = `https://steamcommunity.com/profiles/${steamid}`;
                const addedAt = Math.floor(new Date(entry.added_at).getTime() / 1000);
                const lastSeen = Math.floor(new Date(player.last_seen).getTime() / 1000);
                const channel = await findWatchlistChannel(interaction.client, steamid);

                const embed = createEmbed(colors.warning)
                    .setAuthor({
                        name: displayName,
                        url: steamUrl,
                        iconURL: avatar ?? undefined
                    })
                    .setThumbnail(avatar)
                    .addFields(
                        { name: '🆔 SteamID', value: `[${steamid}](${steamUrl})`, inline: false },
                        { name: '📋 Reason', value: entry.reason ?? 'No reason provided', inline: false },
                        { name: '👤 Added By', value: entry.added_by_name ?? 'Unknown', inline: true },
                        { name: '📅 Added', value: `<t:${addedAt}:R>`, inline: true },
                        { name: '🕒 Last Seen', value: `<t:${lastSeen}:R>`, inline: true },
                        { name: '📺 Channel', value: channel ? `<#${channel.id}>` : 'Not found', inline: true }
                    );

                await interaction.editReply({ embeds: [embed], files: [logo] });
            }

        } catch (err) {
            console.error(`[/watchlist ${sub}]`, err.message);
            await interaction.editReply('❌ Something went wrong.');
        }
    }
};