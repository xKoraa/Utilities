const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        if (message.channel.id !== process.env.onboarding_terms) return;
        if (message.content.toLowerCase() !== '.agree') return;

        if (!client.isReady()) return;

        try {
            await message.delete();
        } catch {}

        let publicRoleName = 'Unknown Role';

        try {
            await message.member.roles.add(process.env.agreed);
        } catch (err) {
            sendErrorLog(client, message.author, 'Failed to assign staff role', err);
        }
        try {
            if (!process.env.public_guild) {
                throw new Error("Missing public_guild in .env");
            }

            const publicGuild = await client.guilds.fetch(process.env.public_guild);

            const publicMember = await publicGuild.members
                .fetch(message.author.id)
                .catch(() => null);

            if (!publicMember) {
                const warn = await message.channel.send(
                    `<@${message.author.id}> you need to join the public server first to receive your server role.`
                );
                setTimeout(() => warn.delete().catch(() => {}), 10000);
            } else {
                const role = await publicGuild.roles.fetch(process.env.server_staff);

                if (!role) throw new Error("Public role not found");

                publicRoleName = role.name;

                await publicMember.roles.add(role);
            }

        } catch (err) {
            sendErrorLog(client, message.author, 'Failed to assign public server role', err);
        }

        try {
            const confirmation = await message.channel.send(
                `Welcome to the **KZG** team <@${message.author.id}>!\n` +
                `You’ve been given your staff role.\n\n` +
                `Please contact your respective Senior Staff to continue your onboarding process.`
            );

            setTimeout(() => confirmation.delete().catch(() => {}), 10000);

        } catch (err) {
            sendErrorLog(client, message.author, 'Failed to send confirmation', err);
        }

        try {
            const logEmbed = new EmbedBuilder()
                .addFields({
                    name: 'New staff onboarding',
                    value:
                        `<@${message.author.id}> has agreed to the onboarding terms.\n\n` +
                        `• Staff Role: <@&${process.env.agreed}> (Staff Server)\n` +
                        `• Public Role: ${publicRoleName} (ID: ${process.env.server_staff})\n\n` +
                        `Respective <@&${process.env.headadmin}> and/or <@&${process.env.manager}>, please continue onboarding.`
                })
                .setColor('Green')
                .setTimestamp();

            const logChannel = await client.channels.fetch(process.env.agree_log);
            await logChannel.send({ embeds: [logEmbed] });

        } catch (err) {
            sendErrorLog(client, message.author, 'Failed to send audit log', err);
        }
    });
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