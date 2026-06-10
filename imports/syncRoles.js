const api = require('./api');

// Staff roles ordered by seniority — lower priority number wins display
const ROLE_MAP = {
    [process.env.management]: { category: 'management', priority: 0 },
    [process.env.manager]:    { category: 'management', priority: 1 },
    [process.env.headadmin]:  { category: 'admin',      priority: 2 },
    [process.env.admin]:      { category: 'admin',      priority: 3 },
    [process.env.mod]:        { category: 'moderator',  priority: 4 },
    [process.env.trialmod]:   { category: 'moderator',  priority: 5 },
};

// Dynamic group map — loaded from ROLE_GROUPS env var
// Format: ROLE_GROUPS={"roleId":"GroupName","roleId2":"GroupName2"}
let GROUP_MAP = {};
try {
    if (process.env.ROLE_GROUPS) {
        GROUP_MAP = JSON.parse(process.env.ROLE_GROUPS);
        console.log(`[syncRoles] Loaded ${Object.keys(GROUP_MAP).length} server group(s):`, Object.values(GROUP_MAP).join(', '));
    } else {
        console.warn('[syncRoles] No ROLE_GROUPS defined in .env — server_group will always be null');
    }
} catch (err) {
    console.error('[syncRoles] Failed to parse ROLE_GROUPS from .env — must be valid JSON:', err.message);
}

const STAFF_ROLE_IDS = new Set(Object.keys(ROLE_MAP).filter(Boolean));
const GROUP_ROLE_IDS  = new Set(Object.keys(GROUP_MAP));

async function syncMember(member) {
    const staffRoles = member.roles.cache
        .filter(r => STAFF_ROLE_IDS.has(r.id))
        .sort((a, b) => (ROLE_MAP[a.id]?.priority ?? 99) - (ROLE_MAP[b.id]?.priority ?? 99));

    if (staffRoles.size === 0) {
        await api.patch(`/api/admins/discord/${member.id}`, { active: 0 });
        return;
    }

    const topRole      = staffRoles.first();
    const { category } = ROLE_MAP[topRole.id];
    const color        = topRole.hexColor !== '#000000' ? topRole.hexColor : '#ff2d3f';

    // Find all group roles the member has
    const memberGroupRoles = member.roles.cache
        .filter(r => GROUP_ROLE_IDS.has(r.id))
        .map(r => GROUP_MAP[r.id]);

    const server_group = memberGroupRoles.length > 0 ? memberGroupRoles[0] : null;

    await api.patch(`/api/admins/discord/${member.id}`, {
        discord_name: member.user.username,
        avatar_url:   member.user.displayAvatarURL({ extension: 'png', size: 256 }),
        role:         topRole.name,
        category,
        color,
        server_group,
        active:       1,
    });
}

async function syncAll(guild) {
    await guild.members.fetch();

    const staffMembers = guild.members.cache.filter(m =>
        m.roles.cache.some(r => STAFF_ROLE_IDS.has(r.id))
    );

    const results = await Promise.allSettled(staffMembers.map(m => syncMember(m)));
    const failed  = results.filter(r => r.status === 'rejected');

    if (failed.length > 0) {
        console.error(`[syncRoles] ${failed.length} failures:`);
        failed.forEach(r => console.error(' -', r.reason?.message || r.reason));
    }

    console.log(`[syncRoles] Synced ${staffMembers.size} staff${failed.length ? ` — ${failed.length} failed` : ''}`);
}

function init(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const oldIds = new Set(oldMember.roles.cache.keys());
        const newIds = new Set(newMember.roles.cache.keys());

        const relevantChange = [...STAFF_ROLE_IDS, ...GROUP_ROLE_IDS].some(
            id => oldIds.has(id) !== newIds.has(id)
        );
        if (!relevantChange) return;

        try {
            await syncMember(newMember);
            console.log(`[syncRoles] Updated ${newMember.user.tag}`);
        } catch (err) {
            console.error(`[syncRoles] Failed to update ${newMember.user.tag}:`, err.message);
        }
    });

    client.once('clientReady', () => {
        const guild = client.guilds.cache.get(process.env.staff_guild);
        if (!guild) {
            console.warn('[syncRoles] Guild not found — check staff_guild in .env');
            return;
        }

        syncAll(guild).catch(console.error);
        setInterval(() => syncAll(guild).catch(console.error), 60 * 60 * 1000);

        console.log(`[syncRoles] Watching role changes on ${guild.name}`);
    });
}

module.exports = { init, syncAll, syncMember };