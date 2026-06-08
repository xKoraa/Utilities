const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    MessageFlags,
    Events
} = require('discord.js');
const api = require('../../imports/api');
const resolveSteamId = require('../../imports/steamUtils');

module.exports = {
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName('agree')
        .setDescription('Agree to the KZG staff terms and register your Steam account'),

    async execute(interaction) {
        // Only works in the onboarding channel
        if (interaction.channelId !== process.env.onboarding_terms) {
            return interaction.reply({
                content: '❌ This command can only be used in the onboarding channel.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Show modal immediately
        const modal = new ModalBuilder()
            .setCustomId(`onboarding_steamid_${interaction.user.id}`)
            .setTitle('KZG Staff Registration');

        const steamIdInput = new TextInputBuilder()
            .setCustomId('steamid')
            .setLabel('Steam ID or Profile URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('URL, SteamID64, STEAM_X:X:X or [U:1:X]')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(steamIdInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    },

    registerModalHandler(client) {
        client.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isModalSubmit()) return;
            console.log('[Modal] Received submission:', interaction.customId);
            if (!interaction.customId.startsWith('onboarding_steamid_')) return;

            const userId = interaction.customId.replace('onboarding_steamid_', '');
            if (interaction.user.id !== userId) return;

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const rawInput = interaction.fields.getTextInputValue('steamid');
            const member = interaction.member;

            // Resolve Steam ID
            let steamid64;
            try {
                steamid64 = await resolveSteamId(rawInput);
            } catch (err) {
                return await interaction.editReply(
                    `❌ ${err.message}\n\nPlease run \`/agree\` again and enter a valid Steam ID or profile URL.`
                );
            }

            let publicRoleName = 'Unknown Role';

            // Register with API
            try {
                await api.post('/api/admins', {
                    steamid: steamid64,
                    name: member.displayName,
                    flags: 'staff',
                    added_by_steamid: null
                });
                console.log(`[Onboarding] Registered ${member.displayName} (${steamid64}) as staff`);
            } catch (err) {
                console.error('[Onboarding] Failed to register with API:', err.message);
            }

            // Assign staff role
            try {
                await member.roles.add(process.env.agreed);
            } catch (err) {
                console.error('[Onboarding] Failed to assign staff role:', err.message);
                await sendErrorLog(client, interaction.user, 'Failed to assign staff role', err);
            }

            // Assign public server_staff role
            try {
                if (!process.env.public_guild) throw new Error('Missing public_guild in .env');

                const publicGuild = await client.guilds.fetch(process.env.public_guild);
                const publicMember = await publicGuild.members.fetch(interaction.user.id).catch(() => null);

                if (!publicMember) {
                    const warn = await interaction.channel.send({
                        content: `<@${interaction.user.id}> you need to join the public KZG server first to receive your public role.`
                    });
                    setTimeout(() => warn.delete().catch(() => {}), 10000);
                } else {
                    const role = await publicGuild.roles.fetch(process.env.server_staff);
                    if (!role) throw new Error('Public role not found');
                    publicRoleName = role.name;
                    await publicMember.roles.add(role);
                }
            } catch (err) {
                console.error('[Onboarding] Failed to assign public role:', err.message);
                await sendErrorLog(client, interaction.user, 'Failed to assign public server role', err);
            }

            // Send channel confirmation
            try {
                const confirmation = await interaction.channel.send(
                    `Welcome to the **KZG** team <@${interaction.user.id}>!\n` +
                    `You've been given your staff role.\n\n` +
                    `Please contact your respective Senior Staff to continue your onboarding process.`
                );
                setTimeout(() => confirmation.delete().catch(() => {}), 10000);
            } catch (err) {
                await sendErrorLog(client, interaction.user, 'Failed to send confirmation', err);
            }

            // Send audit log
            try {
                const logEmbed = new EmbedBuilder()
                    .addFields({
                        name: 'New staff onboarding',
                        value:
                            `<@${interaction.user.id}> has agreed to the onboarding terms.\n\n` +
                            `• SteamID: \`${steamid64}\`\n` +
                            `• Staff Role: <@&${process.env.agreed}> (Staff Server)\n` +
                            `• Public Role: ${publicRoleName} (ID: ${process.env.server_staff})\n\n` +
                            `Respective <@&${process.env.headadmin}> and/or <@&${process.env.manager}>, please continue onboarding.`
                    })
                    .setColor('Green')
                    .setTimestamp();

                const logChannel = await client.channels.fetch(process.env.agree_log);
                await logChannel.send({ embeds: [logEmbed] });
            } catch (err) {
                await sendErrorLog(client, interaction.user, 'Failed to send audit log', err);
            }

            await interaction.editReply('✅ Registration complete! Welcome to the KZG team.');
        });
    }
};

async function sendErrorLog(client, user, action, err) {
    try {
        const logChannel = await client.channels.fetch(process.env.agree_log);
        const errorEmbed = {
            title: 'Error in Onboarding',
            fields: [
                { name: 'User', value: `<@${user.id}>`, inline: true },
                { name: 'Action', value: action, inline: true },
                { name: 'Error', value: `\`\`\`${err}\`\`\`` }
            ],
            color: 0xFF0000,
            timestamp: new Date()
        };
        await logChannel.send({ embeds: [errorEmbed] });
    } catch (e) {
        console.error('Failed to send error log:', e);
    }
}