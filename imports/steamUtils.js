const SteamID = require('steamid');

module.exports = async function resolveSteamId(input) {
    input = input.trim();

    // Strip profile URL → extract ID or vanity
    if (input.includes('steamcommunity.com')) {
        const profileMatch = input.match(/profiles\/(\d{17})/);
        if (profileMatch) {
            input = profileMatch[1];
        } else {
            const vanityMatch = input.match(/\/id\/([^\/]+)/);
            if (vanityMatch) {
                const vanity = vanityMatch[1];
                const resolved = await resolveVanityUrl(vanity);
                if (!resolved) throw new Error('Could not resolve Steam vanity URL. Make sure your profile is public.');
                input = resolved;
            }
        }
    }

    // Try parsing with steamid package
    try {
        const sid = new SteamID(input);
        if (sid.isValid()) {
            return sid.getSteamID64();
        }
    } catch {
        throw new Error('Invalid Steam ID format. Please use SteamID64, STEAM_X:X:X, [U:1:X] or your profile URL.');
    }

    throw new Error('Could not parse Steam ID. Please use SteamID64, STEAM_X:X:X, [U:1:X] or your profile URL.');
};

async function resolveVanityUrl(vanity) {
    try {
        const response = await fetch(
            `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${process.env.STEAM_API}&vanityurl=${vanity}`
        );
        const data = await response.json();
        if (data.response.success === 1) return data.response.steamid;
        return null;
    } catch {
        return null;
    }
}