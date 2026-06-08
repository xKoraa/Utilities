require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes, Events } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PREFIX = '.';

const DEV_GUILD = process.env.dev_guild;
const STAFF_GUILD = process.env.staff_guild;
const PUBLIC_GUILD = process.env.public_guild;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.slashCommands = new Collection();
client.prefixCommands = new Collection();
client.tasks = {};

// --------------------- Load Commands ---------------------
const commandsPath = path.join(__dirname, 'commands');
const publicCommands = [];
const adminCommands = [];

function loadCommands(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = fs.statSync(entryPath);

        if (stat.isDirectory()) {
            loadCommands(entryPath);
        } else if (stat.isFile() && entry.endsWith('.js')) {
            try {
                const command = require(entryPath);

                if (command?.data && typeof command.data.toJSON === 'function' && typeof command.execute === 'function') {
                    client.slashCommands.set(command.data.name, command);

                    if (command.adminOnly) {
                        adminCommands.push(command.data.toJSON());
                    } else {
                        publicCommands.push(command.data.toJSON());
                    }

                } else if (command?.name && typeof command.execute === 'function') {
                    client.prefixCommands.set(command.name, command);
                } else {
                    console.log(`[SKIPPED] ${entryPath} is not a valid command`);
                }
            } catch (err) {
                console.error(`[ERROR] Failed to load command ${entryPath}:`, err);
            }
        }
    }
}

loadCommands(commandsPath);
console.log('[DEBUG] Loaded commands:', [...client.slashCommands.keys()]);

// --------------------- Register Slash Commands ---------------------
if (CLIENT_ID && TOKEN) {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    (async () => {
        try {
            const allGuilds = [DEV_GUILD, STAFF_GUILD, PUBLIC_GUILD].filter(Boolean);
            const staffGuilds = [DEV_GUILD, STAFF_GUILD].filter(Boolean);

            await Promise.all([
                ...allGuilds.map(guildId =>
                    rest.put(
                        Routes.applicationGuildCommands(CLIENT_ID, guildId),
                        { body: publicCommands }
                    ).then(data => console.log(`✅ Registered ${data.length} public commands to guild ${guildId}`))
                ),
                ...staffGuilds.map(guildId =>
                    rest.put(
                        Routes.applicationGuildCommands(CLIENT_ID, guildId),
                        { body: [...publicCommands, ...adminCommands] }
                    ).then(data => console.log(`✅ Registered ${data.length} admin commands to guild ${guildId}`))
                )
            ]);

        } catch (err) {
            console.error('❌ Failed to refresh slash commands:', err);
        }
    })();
}

// --------------------- Slash Command Handler ---------------------
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(err);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Error executing command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Error executing command!', ephemeral: true });
        }
    }
});

// --------------------- Prefix Command Handler ---------------------
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (err) {
        console.error(err);
        message.channel.send('Error executing command!');
    }
});

// --------------------- Load Tasks ---------------------
function loadTasks(tasksDir = path.join(__dirname, 'tasks')) {
    const entries = fs.readdirSync(tasksDir);

    for (const entry of entries) {
        const entryPath = path.join(tasksDir, entry);
        const stat = fs.statSync(entryPath);

        if (stat.isDirectory()) {
            loadTasks(entryPath);
        } else if (stat.isFile() && entry.endsWith('.js')) {
            try {
                const taskModule = require(entryPath);

                if (typeof taskModule === 'function') {
                    taskModule(client);
                    console.log(`[TASK LOADED] ${entryPath}`);
                } else {
                    const name = path.basename(entry, '.js');
                    client.tasks[name] = taskModule;
                    console.log(`[TASK MODULE LOADED] ${entryPath}`);
                }
            } catch (err) {
                console.error(`[ERROR] Failed to load task ${entryPath}:`, err);
            }
        }
    }
}

loadTasks();

// --------------------- Ready ---------------------
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Register modal handlers for all commands that have them
    for (const command of client.slashCommands.values()) {
        if (typeof command.registerModalHandler === 'function') {
            command.registerModalHandler(client);
            console.log(`[MODAL HANDLER] Registered for /${command.data.name}`);
        }
    }

    if (process.env.ENABLE_VIP_TASK === 'true' && client.tasks.onExpiry?.checkExpiredVips) {
        client.tasks.onExpiry.checkExpiredVips(client);
        setInterval(() => client.tasks.onExpiry.checkExpiredVips(client), 60 * 1000);
    }
});

// --------------------- Start Bot Listener ---------------------
require('./server')(client);

client.login(TOKEN);