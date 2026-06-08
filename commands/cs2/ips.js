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
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName('ips')
        .setDescription('View IP history for a player')
        .addStringOption(option =>
            option
                .setName('steamid')
                .setDescription('The player\'s SteamID64')
                .setRequired(true)
        ),

    async execute(interaction) {
        const member = interaction.member;

        const isHeadAdmin = member.roles.cache.has(process.env.headadmin)
            || member.roles.cache.has(process.env.manager)
            || member.roles.cache.has(process.env.management);

        const isStaff = member.roles.cache.has(process.env.agreed) || isHeadAdmin;

        if (!isStaff) {
            return interaction.reply({
                content: '❌ You don\'t have permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: isHeadAdmin });

        const steamid = interaction.options.getString('steamid');

        try {
            const [ips, player, steam, alts] = await Promise.all([
                api.get(`/api/player/${steamid}/ips`),
                api.get(`/api/player/${steamid}`),
                getSteamProfile(steamid),
                api.get(`/api/player/${steamid}/alts`)
            ]);

            if (!ips || ips.length === 0) {
                return await interaction.editReply('❌ No IP records found for that player.');
            }

            const steamUrl = `https://steamcommunity.com/profiles/${steamid}`;
            const avatar = steam?.avatarfull ?? null;
            const displayName = steam?.personaname ?? player.name;

            const uniqueCountries = [...new Set(ips.map(ip => ip.country).filter(Boolean))];
            const vpnCount = ips.filter(ip => ip.is_vpn || ip.is_proxy || ip.is_hosting).length;
            const multipleCountries = uniqueCountries.length > 1;
            const hasAlts = alts && alts.length > 0;

            const countryDisplay = uniqueCountries.join(', ') || 'Unknown';

            const alerts = [
                vpnCount > 0 ? `⚠️ ${vpnCount} VPN/Proxy IP${vpnCount !== 1 ? 's' : ''} detected` : '',
                multipleCountries ? `⚠️ Multiple countries detected` : '',
                hasAlts ? `⚠️ ${alts.length} potential alt account${alts.length !== 1 ? 's' : ''} detected` : ''
            ].filter(Boolean);

            const alertDisplay = alerts.length > 0 ? alerts.join('\n') : '✅ No alerts';
            const embedColor = vpnCount > 0 || hasAlts ? colors.warning : colors.success;

            const embeds = [];
            const files = [];

            if (isHeadAdmin) {
                // Full IP list
                const ipList = ips.map(ip => {
                    const flags = [
                        ip.is_vpn ? '🔴 VPN' : '',
                        ip.is_proxy ? '🟠 Proxy' : '',
                        ip.is_hosting ? '🟡 Hosting' : ''
                    ].filter(Boolean).join(' ') || '✅ Clean';

                    const lastSeen = Math.floor(new Date(ip.last_seen).getTime() / 1000);
                    const firstSeen = Math.floor(new Date(ip.first_seen).getTime() / 1000);

                    return `\`${ip.ip}\` — ${ip.country ?? 'Unknown'} — ${flags}\nFirst: <t:${firstSeen}:R> • Last: <t:${lastSeen}:R>`;
                }).join('\n\n');

                const mainEmbed = createEmbed(embedColor)
                    .setAuthor({
                        name: displayName,
                        url: steamUrl,
                        iconURL: avatar ?? undefined
                    })
                    .setThumbnail(avatar)
                    .addFields(
                        { name: '🚨 Alerts', value: alertDisplay, inline: true },
                        { name: '🌍 Countries', value: countryDisplay, inline: true },
                        { name: '📋 IPs on Record', value: ips.length.toString(), inline: true },
                        { name: '🔍 IP List', value: ipList, inline: false }
                    );

                embeds.push(mainEmbed);
                files.push(getLogo());

                // Alt accounts embed — HA+ only
                if (hasAlts) {
                    const altList = alts.map((alt, i) => {
                        const lastSeen = Math.floor(new Date(alt.last_seen).getTime() / 1000);
                        const firstSeen = Math.floor(new Date(alt.first_seen).getTime() / 1000);
                        return `\`${String(i + 1).padStart(2, '0')}\` **[${alt.name}](https://steamcommunity.com/profiles/${alt.steamid})**\n🆔 \`${alt.steamid}\`\n🔗 Shared IP: \`${alt.shared_ip}\`\nFirst: <t:${firstSeen}:R> • Last: <t:${lastSeen}:R>`;
                    }).join('\n\n');

                    const altEmbed = createEmbed(colors.danger)
                        .setTitle(`⚠️ Duplicate Accounts Detected — ${alts.length} found`)
                        .setDescription(altList);

                    embeds.push(altEmbed);
                }

            } else {
                // Limited view — no IPs, no shared IPs on alts - Mod+
                const mainEmbed = createEmbed(embedColor)
                    .setAuthor({
                        name: displayName,
                        url: steamUrl,
                        iconURL: avatar ?? undefined
                    })
                    .setThumbnail(avatar)
                    .addFields(
                        { name: '🚨 Alerts', value: alertDisplay, inline: true },
                        { name: '🌍 Countries', value: countryDisplay, inline: true },
                        { name: '📋 IPs on Record', value: ips.length.toString(), inline: true }
                    );

                embeds.push(mainEmbed);
                files.push(getLogo());

                // Alt accounts embed — staff, no IPs shown
                if (hasAlts) {
                    const altList = alts.map((alt, i) => {
                        const lastSeen = Math.floor(new Date(alt.last_seen).getTime() / 1000);
                        const firstSeen = Math.floor(new Date(alt.first_seen).getTime() / 1000);
                        return `\`${String(i + 1).padStart(2, '0')}\` **[${alt.name}](https://steamcommunity.com/profiles/${alt.steamid})**\n🆔 \`${alt.steamid}\`\nFirst: <t:${firstSeen}:R> • Last: <t:${lastSeen}:R>`;
                    }).join('\n\n');

                    const altEmbed = createEmbed(colors.danger)
                        .setTitle(`⚠️ Duplicate Accounts Detected — ${alts.length} found`)
                        .setDescription(altList);

                    embeds.push(altEmbed);
                }
            }

            await interaction.editReply({ embeds, files });

        } catch (err) {
            if (err.message.includes('404')) {
                await interaction.editReply('❌ Player not found.');
            } else {
                console.error('[/ips]', err.message);
                await interaction.editReply('❌ Something went wrong fetching IP history.');
            }
        }
    }
};