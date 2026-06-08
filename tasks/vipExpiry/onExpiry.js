const pool = require('../../imports/db-notes');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PREMIUM_ROLE_ID = process.env.premium_role;
const VIP_UPDATES_CHANNEL = process.env.vip_updates;
const VIP_NOTIFY = process.env.vip_notify;

async function checkExpiredVips(client) {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM vip WHERE expires_at <= NOW() AND expires_at IS NOT NULL AND status = 'active'`
        );

        if (rows.length === 0) return;

        const channel = VIP_UPDATES_CHANNEL ? await client.channels.fetch(VIP_UPDATES_CHANNEL) : null;

        for (const row of rows) {
            try {
                const user = await client.users.fetch(row.discord_id);

                let dmSent = false;
                if (row.expires_at) {
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('💎 VIP Expired')
                            .setDescription(`Hey <@${user.id}>! Your **${row.length}** VIP purchase has expired.`)
                            .addFields({
                                name: 'Renewal',
                                value: 'If you would like to have these perks renewed, please create a [support ticket](https://discord.com/channels/336784653346406406/563647399596130304) and our team will gladly sort this for you.'
                            })
                            .setFooter({ text: 'Thank you for choosing KZG!' })
                            .setColor(0xff0000)
                            .setTimestamp(new Date(row.expires_at));

                        await user.send({ embeds: [dmEmbed] });
                        dmSent = true;
                    } catch (err) {
                        console.warn(`Could not DM user ${user.id}:`, err);
                        dmSent = false;
                    }
                }

                const guild = client.guilds.cache.first();
                if (guild) {
                    const member = await guild.members.fetch(row.discord_id).catch(() => null);
                    if (member && PREMIUM_ROLE_ID) {
                        await member.roles.remove(PREMIUM_ROLE_ID, 'VIP expired');
                    }
                }

                let notifyMentions = '';
                if (VIP_NOTIFY) {
                    const ids = VIP_NOTIFY.split(',').map(id => id.trim()).filter(id => id);
                    if (ids.length > 0) notifyMentions = ids.map(id => `<@${id}>`).join(' ');
                }

                if (channel?.isTextBased()) {
                    if (notifyMentions) await channel.send({ content: notifyMentions });

                    const embed = new EmbedBuilder()
                        .setTitle(`💎 VIP expired`)
                        .setColor(0xff0000)
                        .addFields(
                            { name: 'User', value: `<@${user.id}>` },
                            { name: 'Steam ID', value: row.steamid || 'N/A' },
                            { name: 'VIP Duration', value: row.length },
                            { name: 'Expired On', value: `<t:${Math.floor(new Date(row.expires_at).getTime() / 1000)}:F>` },
                            { name: 'DM Sent', value: dmSent ? 'Yes' : 'Failed to send, DMs closed' },
                            { name: 'Status', value: 'review now' }
                        )
                        .setTimestamp(new Date());

                    const buttons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`vip_extend_${row.id}`)
                            .setLabel('Extend')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`vip_cancel_${row.id}`)
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Danger)
                    );

                    await channel.send({ embeds: [embed], components: [buttons] });
                }

                await pool.execute(`UPDATE vip SET status = 'on review' WHERE id = ?`, [row.id]);

            } catch (err) {
                console.error(`Failed to process expired VIP ${row.discord_id}:`, err);
            }
        }
    } catch (err) {
        console.error('Error querying expired VIPs:', err);
    }
}

module.exports = { checkExpiredVips };
