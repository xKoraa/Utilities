const express = require('express');
const { findWatchlistChannel } = require('./imports/watchlist');
const { colors, getLogo, createEmbed } = require('./imports/embed');

const BOT_SECRET = process.env.BOT_SECRET;

module.exports = (client) => {
    const app = express();
    app.use(express.json());

    app.use((req, res, next) => {
        if (req.headers['x-bot-secret'] !== BOT_SECRET) {
            return res.status(401).json({ error: 'Unauthorised' });
        }
        next();
    });

    // Player connect alert
    app.post('/watchlist/connect', async (req, res) => {
        res.json({ status: 'ok' });

        const { steamid, name, server_id, ip, country, is_vpn, connected_at } = req.body;

        try {
            const channel = await findWatchlistChannel(client, steamid);
            if (!channel) return;

            const steamUrl = `https://steamcommunity.com/profiles/${steamid}`;
            const vpnFlag = is_vpn ? '🔴 VPN/Proxy' : '✅ Clean';

            const embed = createEmbed(colors.success)
                .setAuthor({
                    name: `🟢 ${name} connected`,
                    url: steamUrl
                })
                .addFields(
                    { name: '🖥️ Server', value: server_id, inline: true },
                    { name: '🌍 Country', value: country ?? 'Unknown', inline: true },
                    { name: '🔒 IP Status', value: vpnFlag, inline: true }
                );

            await channel.send({ embeds: [embed], files: [getLogo()] });
        } catch (err) {
            console.error('[Bot/Connect Alert]', err.message);
        }
    });

    // Player chat alert
    app.post('/watchlist/chat', async (req, res) => {
        res.json({ status: 'ok' });

        const { steamid, name, server_id, message, message_type } = req.body;

        try {
            const channel = await findWatchlistChannel(client, steamid);
            if (!channel) return;

            const steamUrl = `https://steamcommunity.com/profiles/${steamid}`;
            const isTeam = message_type === 'team';
            const typeDisplay = isTeam ? '🔒 Team Chat' : '🌐 All Chat';
            const embedColor = isTeam ? colors.ct : colors.info;

            const embed = createEmbed(embedColor)
                .setAuthor({
                    name: `💬 ${name}`,
                    url: steamUrl
                })
                .setDescription(message)
                .addFields(
                    { name: '🖥️ Server', value: server_id, inline: true },
                    { name: '📢 Type', value: typeDisplay, inline: true }
                );

            await channel.send({ embeds: [embed], files: [getLogo()] });
        } catch (err) {
            console.error('[Bot/Chat Alert]', err.message);
        }
    });

    app.listen(3001, () => {
        console.log('[Bot] Internal listener running on port 3001');
    });
};