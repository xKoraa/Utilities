const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const api = require('../../imports/api');

module.exports = {
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName('sessions')
        .setDescription('View session history for a player')
        .addStringOption(option =>
            option
                .setName('steamid')
                .setDescription('The player\'s SteamID64')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('limit')
                .setDescription('Number of sessions to show (default 10, max 20)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20)
        ),

    async execute(interaction) {
        const member = interaction.member;

        const isStaff = member.roles.cache.has(process.env.agreed)
            || member.roles.cache.has(process.env.headadmin)
            || member.roles.cache.has(process.env.manager)
            || member.roles.cache.has(process.env.managment);

        if (!isStaff) {
            return interaction.reply({
                content: '❌ You don\'t have permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const steamid = interaction.options.getString('steamid');
        const limit = interaction.options.getInteger('limit') ?? 10;

        try {
            const [sessions, player] = await Promise.all([
                api.get(`/api/player/${steamid}/sessions?limit=${limit}`),
                api.get(`/api/player/${steamid}`)
            ]);

            if (!sessions || sessions.length === 0) {
                return await interaction.editReply('❌ No sessions found for that player.');
            }

            const steamUrl = `https://steamcommunity.com/profiles/${steamid}`;

            // Calculate total playtime across returned sessions
            const totalSecs = sessions.reduce((acc, s) => acc + (s.duration_secs ?? 0), 0);
            const totalHours = Math.floor(totalSecs / 3600);
            const totalMins = Math.floor((totalSecs % 3600) / 60);
            const totalDisplay = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`;

            const sessionList = sessions.map((s, i) => {
                const connectedAt = Math.floor(new Date(s.connected_at).getTime() / 1000);
                const secs = s.duration_secs ?? 0;
                const hrs = Math.floor(secs / 3600);
                const mins = Math.floor((secs % 3600) / 60);
                const duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                const recovered = s.recovered ? ' ⚠️' : '';

                return `\`${String(i + 1).padStart(2, '0')}\` <t:${connectedAt}:R> — **${s.server_id}** — ${duration}${recovered}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({
                    name: `Sessions — ${player.name}`,
                    url: steamUrl
                })
                .setDescription(sessionList)
                .addFields(
                    {
                        name: '📊 Summary',
                        value: [
                            `**Sessions shown:** ${sessions.length}`,
                            `**Time across sessions:** ${totalDisplay}`,
                            `**All-time playtime:** ${Math.floor((player.playtime_secs ?? 0) / 3600)}h ${Math.floor(((player.playtime_secs ?? 0) % 3600) / 60)}m`
                        ].join('\n')
                    }
                )
                .setFooter({ text: `⚠️ = crash recovered session • ${steamid}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            if (err.message.includes('404')) {
                await interaction.editReply('❌ Player not found.');
            } else {
                console.error('[/sessions]', err.message);
                await interaction.editReply('❌ Something went wrong fetching sessions.');
            }
        }
    }
};