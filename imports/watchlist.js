const { ChannelType, PermissionFlagsBits } = require('discord.js');

const CATEGORY_ID = process.env.WATCHLIST_CATEGORY;
const STAFF_GUILD_ID = process.env.staff_guild;
const ARCHIVE = process.env.WATCHLIST_ARCHIVE === 'true';


// Get the watchlist category in the staff guild
async function getCategory(client) {
    const guild = await client.guilds.fetch(STAFF_GUILD_ID);
    return guild.channels.cache.get(CATEGORY_ID);
}


// Watched player channel creation
async function createWatchlistChannel(client, steamid, playerName) {
    const guild = await client.guilds.fetch(STAFF_GUILD_ID);
    console.log('[Watchlist] Guild:', guild.name);
    console.log('[Watchlist] Category ID:', CATEGORY_ID);
    console.log('[Watchlist] Category found:', guild.channels.cache.get(CATEGORY_ID)?.name ?? 'NOT FOUND');
    const safeName = playerName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 20);
    const channelName = `${safeName}-${steamid.slice(-6)}`;

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,
        topic: `Watchlist channel for ${playerName} (${steamid})`
    });

    return channel;
}

// Find an existing watchlist channel by steamid suffix
async function findWatchlistChannel(client, steamid) {
    const guild = await client.guilds.fetch(STAFF_GUILD_ID);
    const suffix = steamid.slice(-6);
    return guild.channels.cache.find(c =>
        c.parentId === CATEGORY_ID && c.name.endsWith(suffix)
    ) ?? null;
}


// Archive or delete a watchlist channel - check .env for archive enable/disable
async function removeWatchlistChannel(client, steamid, playerName) {
    const channel = await findWatchlistChannel(client, steamid);
    console.log('[Watchlist] Remove - steamid:', steamid);
    console.log('[Watchlist] Remove - channel found:', channel?.name ?? 'NOT FOUND');
    console.log('[Watchlist] Remove - ARCHIVE:', ARCHIVE);
    if (!channel) return;

    if (ARCHIVE) {
        const safeName = playerName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 20);
        await channel.setName(`archived-${safeName}-${steamid.slice(-6)}`);
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            SendMessages: false
        });
        await channel.send('🔒 This player has been removed from the watchlist. Channel archived.');
    } else {
        await channel.delete();
    }
}

module.exports = {
    createWatchlistChannel,
    findWatchlistChannel,
    removeWatchlistChannel
};