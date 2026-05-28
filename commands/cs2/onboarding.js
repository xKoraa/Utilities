const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'onboarding',
    description: 'Sends the staff onboarding embed.',
    execute: async (message) => {
        if (!message.guild) return;
        if (message.channel.id !== process.env.onboarding_terms) return;

        const onboardingEmbed = new EmbedBuilder()
            .setTitle('Staff Onboarding & Terms')
            .setThumbnail('https://cdn.discordapp.com/attachments/1442085726345760869/1442139626533027870/KZG-MAIN-LOGO-WTE-Padded-1024x1024_1.png?ex=692458b0&is=69230730&hm=e39b3fbe861d43a3dd2f392ecccbf52f6eb6911710525cb83bf82b47669cd8c7&')
            .setDescription(
                `Welcome to the **KZG Staff Team**! \n\n Before you gain access, please read and agree to the following terms and guidelines. ` +
                `To be a KZG staff member, alongside being a member of this Discord, you must agree to the [Terms and Conditions](https://kzg.gg/forum/terms) alongside the Staff guidelines that are set upon you.`
            )
            .addFields(
                {
                    name: '1️⃣ **Conduct**',
                    value: `> Carry yourself in a way that's fair, consistent, and aligned with the rules you're enforcing.\n`+
                            `> You're free to speak your mind and argue your case, but don't use staff powers as part of the argument, and don't break rules you're expected to uphold.`
                },
                {
                    name: '2️⃣ **Confidentiality**',
                    value: '> Sharing internal processes, staff-only channels, or sensitive information outside of authorized staff is strictly prohibited.\n'+  
                            '> This includes sending screenshots or messages to players.\n'+
                            '> Violations are treated with zero tolerance and will result in immediate removal from our services.'
                },
                {
                    name: '3️⃣ **Responsibilities**',
                    value: '> Check in regularly, assist other staff when needed, and manage your assigned areas responsibly.'
                },
                {
                    name: '4️⃣ **Communication**',
                    value: '> Use staff channels for all official communications and keep public chat separate.'
                },
                {
                    name: '**KZG rights**',
                    value: '> KZG senior staff reserves the right to remove you and disable all access you have on any of their services and/or platforms they operate on, at any time without any warning or reasoning.'
                },
                {
                    name: '**Agreement**',
                    value: `> Once you understand and accept these terms, type \`.agree\` in this channel to receive your staff role.`+
                    `\n\n If you have any questions or queries, please get in contact with your onboarding staff member, typically <@&${process.env.headadmin}> or <@&${process.env.manager}>`
                }
            )
            .setColor('Blue')
            .setFooter({ text: 'KZG Staff Onboarding' })
            .setTimestamp();

        try {
            await message.channel.send({ embeds: [onboardingEmbed] });
        } catch (err) {
            console.error('Failed to send onboarding embed:', err);
            const logChannel = await message.client.channels.fetch(process.env.agree_log);
            await logChannel.send({ content: `Failed to send onboarding embed in <#${message.channel.id}>: \`${err}\`` });
        }
    }
};
