const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const pool = require('../../imports/database');

const SUPPORT_ROLE_ID = process.env.support_role;
const PREMIUM_ROLE_ID = process.env.premium_role;
const VIP_UPDATES_CHANNEL = process.env.vip_updates;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addvip')
        .setDescription('Adds a VIP to a user')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The Discord user to add as VIP')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('steamid')
                .setDescription('The Steam ID of the user')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('length')
                .setDescription('Select VIP duration')
                .setRequired(true)
                .addChoices(
                    { name: '1 Minute', value: '1 minute' },
                    { name: '1 Month', value: '1 month' },
                    { name: '6 Months', value: '6 months' },
                    { name: '12 Months', value: '12 months' },
                    { name: 'Lifetime', value: 'Lifetime' }
                )
        ),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(SUPPORT_ROLE_ID) &&
            interaction.member.roles.highest.position <= supportRolePosition &&
            !interaction.member.permissions.has('Administrator')) 
            
        {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('target');
        const steamId = interaction.options.getString('steamid');
        const lengthInput = interaction.options.getString('length');
        const givenBy = interaction.user.id;

        let durationText = lengthInput;
        let expiryDate = null;
        let expiryTimestamp = null;
        let expiryText = 'Never';

        if (lengthInput !== 'Lifetime') {
            const [amount, unitRaw] = lengthInput.split(' ');
            const value = parseInt(amount, 10);
            const unit = unitRaw.toLowerCase();

            switch (true) {
                case unit.startsWith('minute'):
                    expiryDate = DateTime.now().plus({ minutes: value });
                    break;
                case unit.startsWith('hour'):
                    expiryDate = DateTime.now().plus({ hours: value });
                    break;
                case unit.startsWith('day'):
                    expiryDate = DateTime.now().plus({ days: value });
                    break;
                case unit.startsWith('month'):
                    expiryDate = DateTime.now().plus({ months: value });
                    break;
                default:
                    expiryDate = null;
                    break;
            }

            if (expiryDate) {
                expiryTimestamp = Math.floor(expiryDate.toSeconds());
                expiryText = `<t:${expiryTimestamp}:F>`;
            }
        }

        try {
            await pool.execute(
                `INSERT INTO vip (discord_id, steamid, length, expires_at, given_by, status)
                 VALUES (?, ?, ?, ?, ?, 'active')`,
                [user.id, steamId, durationText, expiryDate ? expiryDate.toSQL({ includeOffset: false }) : null, givenBy]
            );
        } catch (err) {
            console.error('MySQL error:', err);
            return interaction.reply({
                content: 'Failed to save VIP info to the database.',
                ephemeral: true,
            });
        }

        try {
            const member = await interaction.guild.members.fetch(user.id);
            if (member && PREMIUM_ROLE_ID) {
                await member.roles.add(PREMIUM_ROLE_ID, `VIP granted by ${interaction.user.tag}`);
            }
        } catch (err) {
            console.error(`Failed to assign premium role to ${user.id}:`, err);
        }

        // LIFETIME confirmation embed
        const customerLifetimeEmbed = new EmbedBuilder()
            .setTitle('🎉 Lifetime VIP Activated!')
            .setThumbnail(user.displayAvatarURL({ size: 1024 }))
            .setColor(0x00cc66)
            .setDescription(
                `Hey <@${user.id}>! Thank you for your **Lifetime VIP** purchase!\n` +
                `You have been permanently granted <@&${PREMIUM_ROLE_ID}>! 🚀\n`+
                `Your perks have been assigned to your account and will be active on map change.\n\n`+
                `While CS2 features are currently more limited compared to CS:GO, as a Premium user, you have these perks on our Surf servers:\n\n`+
                `**Begin a vote to extend the map:**\n`+
                `> !ve in chat or css_ve in console \n\n`+
                `**Custom Tag:** Personalise your "Tag Name" with your favourite colours:\n`+
                `> css_customtag "{colour}[tag]"\n\n`+
                `**Custom name colour** Change your name colour to your favourite colour\n`+
                `> css_namecolour colour in console\n\n`+
                `Currently, the only feature we have implemented on our AIM servers is **priority queue**\n\n`+
                `If you have any ideas for future features, please reach out and let us know!`
            )
            .setTimestamp();

        // TIMED confirmation embed
        const customerTimedEmbed = new EmbedBuilder()
            .setTitle('🎉 VIP Activated!')
            .setThumbnail(user.displayAvatarURL({ size: 1024 }))
            .setColor(0x00cc66)
            .setDescription(
                `Hey <@${user.id}>! Thank you for your VIP purchase of **${durationText}**!\n` +
                `This is set to expire at ${expiryText}.\n` +
                `You have been given <@&${PREMIUM_ROLE_ID}>!\n`+
                `Your perks have been assigned to your account and will be active on map change.\n\n`+
                `While CS2 features are currently more limited compared to CS:GO, as a Premium user, you have these perks on our Surf servers:\n\n`+
                `**Begin a vote to extend the map:**\n`+
                `> !ve in chat or css_ve in console \n\n`+
                `**Custom Tag:** Personalise your "Tag Name" with your favourite colours:\n`+
                `> css_customtag "{colour}[tag]"\n\n`+
                `**Custom name colour** Change your name colour to your favourite colour\n`+
                `> css_namecolour colour in console\n\n`+
                `Currently, the only feature we have implemented on our AIM servers is **priority queue**\n\n`+
                `If you have any ideas for future features, please reach out and let us know!`
            )
            .setTimestamp();

        // send the appropriate embed
        await interaction.reply({
            embeds: [lengthInput === 'Lifetime' ? customerLifetimeEmbed : customerTimedEmbed]
        });

        // staff audit embed
        if (VIP_UPDATES_CHANNEL) {
            try {
                const auditChannel = await interaction.client.channels.fetch(VIP_UPDATES_CHANNEL);
                if (auditChannel && auditChannel.isTextBased()) {
                    const staffEmbed = new EmbedBuilder()
                        .setTitle('📝 VIP Added')
                        .setColor(0x00ff00)
                        .addFields(
                            { name: 'User', value: `<@${user.id}>`, inline: true },
                            { name: 'Steam ID', value: steamId, inline: true },
                            { name: 'VIP Duration', value: durationText, inline: true },
                            { name: 'Expires On', value: expiryText, inline: true },
                            { name: 'Given By', value: `<@${givenBy}>`, inline: true },
                            { name: 'Status', value: 'active', inline: true }
                        )
                        .setTimestamp();

                    await auditChannel.send({ embeds: [staffEmbed] });
                }
            } catch (err) {
                console.error(`Failed to send audit embed to channel ${VIP_UPDATES_CHANNEL}:`, err);
            }
        }
    },
};
