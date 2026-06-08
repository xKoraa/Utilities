const pool = require('../../imports/db-notes');

const PREMIUM_ROLE_ID = process.env.premium_role;

module.exports = (client) => {
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        console.log(`[BUTTON] Interaction triggered: ${interaction.customId}`);

        // Defer interaction to avoid timeout
        await interaction.deferReply({ ephemeral: true });

        const [action, vipId] = interaction.customId.split('_').slice(1);
        console.log(`[BUTTON] Action: ${action}, VIP ID: ${vipId}`);

        const [rows] = await pool.execute(`SELECT * FROM vip WHERE id = ?`, [vipId]);
        if (!rows[0]) {
            console.warn(`[BUTTON] VIP entry not found for ID ${vipId}`);
            return interaction.editReply({ content: 'VIP entry not found.' });
        }

        const vip = rows[0];
        console.log(`[BUTTON] VIP entry loaded for ${vip.discord_id} | Status: ${vip.status} | Length: ${vip.length}`);

        const guild = client.guilds.cache.first();
        const member = guild ? await guild.members.fetch(vip.discord_id).catch(() => null) : null;

        if (action === 'extend') {
            try {
                const now = new Date();
                const newExpiry = new Date(now);
                const match = vip.length.match(/(\d+)/);
                const months = match ? parseInt(match[1]) : 1;

                newExpiry.setMonth(newExpiry.getMonth() + months);
                console.log(`[BUTTON] New expiry date set to: ${newExpiry}`);

                await pool.execute(
                    `UPDATE vip SET status = 'active', expires_at = ? WHERE id = ?`,
                    [newExpiry, vipId]
                );
                console.log(`[BUTTON] Database updated -> status active, expires_at updated.`);

                if (member && PREMIUM_ROLE_ID) {
                    await member.roles.add(PREMIUM_ROLE_ID, 'VIP extended');
                    console.log(`[BUTTON] Premium role re-applied to ${vip.discord_id}`);
                } else {
                    console.log(`[BUTTON] Member not found or PREMIUM_ROLE_ID missing`);
                }

                return interaction.editReply({ content: `VIP extended by ${vip.length} for <@${vip.discord_id}>.` });

            } catch (err) {
                console.error(`[BUTTON] Error extending VIP:`, err);
                return interaction.editReply({ content: '⚠️ Failed to extend VIP, check logs.' });
            }
        }

        if (action === 'cancel') {
            try {
                await pool.execute(`UPDATE vip SET status = 'cancelled' WHERE id = ?`, [vipId]);
                console.log(`[BUTTON] VIP status changed to cancelled`);

                if (member && PREMIUM_ROLE_ID) {
                    await member.roles.remove(PREMIUM_ROLE_ID, 'VIP cancelled');
                    console.log(`[BUTTON] Premium role removed from ${vip.discord_id}`);
                }

                return interaction.editReply({ content: `VIP for <@${vip.discord_id}> has been cancelled.` });

            } catch (err) {
                console.error(`[BUTTON] Error cancelling VIP:`, err);
                return interaction.editReply({ content: '⚠️ Failed to cancel VIP, check logs.' });
            }
        }
    });
};
