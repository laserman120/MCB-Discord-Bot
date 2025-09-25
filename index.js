const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const db = require('./Utils/database.js');

// Load central configuration
let config = yaml.load(fs.readFileSync(path.join(__dirname, 'config.yml'), 'utf8'));
console.log('Loaded central config.yml.');

// 2. Iterate through bot directories to find and merge their specific configs
if (config.bot && config.bot.botNames) {
    const botDirectories = config.bot.botNames;

    for (const botDir of botDirectories) {
        const botConfigPath = path.join(__dirname, botDir, 'lang.yml');

        // Check if a lang.yml exists in the bot's folder
        if (fs.existsSync(botConfigPath)) {
            try {
                const botSpecificConfig = yaml.load(fs.readFileSync(botConfigPath, 'utf8'));
                
                // Merge the specific config into the main config object
                // Properties in botSpecificConfig will overwrite properties in the main config
                config = { ...config, ...botSpecificConfig };

                console.log(`✅ Merged clang from '${botDir}'.`);
            } catch (error) {
                console.error(`❌ Error loading or merging lang from '${botDir}':`, error);
            }
        }
    }
}
console.log('Configuration merging complete.');


// Verify configuration
if (!config.bot.token || !config.bot.clientId || !config.bot.guildId) {
    console.error('Missing bot configuration in config.yml');
    process.exit(1);
}

// Create a single Discord client for all bots
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ]
});

// Create command collections
client.config = config;
client.commands = new Collection();
client.contextMenus = new Collection();
client.tempWarnData = new Collection();

// List the bot subdirectories
const botDirectories = config.bot.botNames;
let allCommands = [];
const loadedModules = [];
let loadedCommandCount = 0;

console.log('--- Loading Commands ---');


function getCommandFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        if (item.isDirectory()) {
            // If it's a directory, recursively call the function and add its files
            files = [...files, ...getCommandFiles(path.join(dir, item.name))];
        } else if (item.isFile() && item.name.endsWith('.js')) {
            // If it's a .js file, add its full path
            files.push(path.join(dir, item.name));
        }
    }
    return files;
}

// --- INITIALIZE BOT ---
async function startBot() {
    console.log('Initializing bot...');

    // Connect to the database ONCE
    await db.connect(config);

    for (const botDir of botDirectories) {
        const commandsPath = path.join(__dirname, botDir, 'commands');
        if (!fs.existsSync(commandsPath)) {
            console.warn(`️ Warning: Command directory not found for ${botDir}: ${commandsPath}`);
            continue;
        }

        const commandFiles = getCommandFiles(commandsPath);
        if (commandFiles.length === 0) continue;

        console.log(`Loading ${commandFiles.length} commands from ${botDir}...`);

        for (const filePath of commandFiles) {
            try {
                const command = require(filePath);
                const commandName = filePath.split(path.sep).pop().slice(0, -3); // e.g., 'ping'

                // Check for and add slash commands
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    allCommands.push(command.data.toJSON());
                    console.log(`  - Loaded Slash Command: ${command.data.name}`);
                    loadedCommandCount++;
                }

                // Check for and add context menu commands
                if ('contextMenu' in command) {
                    const menus = Array.isArray(command.contextMenu) ? command.contextMenu : [command.contextMenu];
                    menus.forEach(ctx => {
                        client.contextMenus.set(ctx.name, command);
                        allCommands.push(ctx.toJSON());
                        console.log(`  - Loaded Context Menu: ${ctx.name}`);
                        loadedCommandCount++;
                    });
                }

            } catch (error) {
                console.error(`❌ Error loading command from ${filePath}:`, error);
            }
        }
    }

    console.log(`Total commands loaded: ${loadedCommandCount}`);
    console.log('------------------------\n');

    console.log('--- Loading Modules ---');
    for (const botDir of config.bot.botNames) {
        const modulePath = path.join(__dirname, botDir, 'index.js');
        if (fs.existsSync(modulePath)) {
            console.log(`Loading module: ${botDir}`);
            const module = require(modulePath);
            
            // Run the one-time setup for the module
            if (module.initialize) {
                module.initialize(client, config);
            }
            
            loadedModules.push(module);
        }
    }
    console.log('-----------------------\n');

    client.login(config.bot.token);
}

client.once('clientReady', async () => {
    console.log(`\nLogged in as ${client.user.tag}!`);

    // 1. First, register all application commands
    try {
        const rest = new REST({ version: '10' }).setToken(config.bot.token);
        console.log(`Started refreshing ${allCommands.length} application (/) commands.`);
        
        await rest.put(
            Routes.applicationGuildCommands(config.bot.clientId, config.bot.guildId),
            { body: allCommands }
        );

        console.log(`Successfully reloaded application (/) commands.`);
    } catch (error) {
        console.error('Error refreshing application commands:', error);
    }

    // 2. NOW, dispatch the 'ready' event to all loaded modules
    console.log('Dispatching ready event to modules...');
    for (const module of loadedModules) {
        if (module.eventHandlers && module.eventHandlers.ready) {
            // This calls the ready handler in each bot module that has one
            module.eventHandlers.ready(client, config);
        }
    }

    console.log("Finished loading modules and registering commands.")
    console.log("--- BOT IS READY ---")
});

client.on('interactionCreate', async interaction => {
    // Command handling is special and can stay here
    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        const commandCollection = interaction.isChatInputCommand() ? client.commands : client.contextMenus;
        const command = commandCollection.get(interaction.commandName);
        if (command) {
            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.log("An error occured during command handling...\n" + error)
            }
        }
        return;
    }

    // For all other interactions (buttons, modals, etc.), dispatch to modules
    for (const module of loadedModules) {
        if (module.handleInteraction) {
            // We await it in case a module's handler is async
            const wasHandled = await module.handleInteraction(interaction, client);
            // If the module handled it, we stop processing.
            if (wasHandled) break;
        }
    }
});

// Generic event dispatcher for other events
const eventsToDispatch = ['guildMemberAdd', 'guildMemberRemove', 'guildMemberUpdate', 'messageCreate'];

for (const event of eventsToDispatch) {
    client.on(event, (...args) => {
        for (const module of loadedModules) {
            // Check if the module has a handler for this specific event
            if (module.eventHandlers && module.eventHandlers[event]) {
                module.eventHandlers[event](...args, client);
            }
        }
    });
}

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await db.close(); // Uses the new close function
    console.log('Database connection closed.');
    process.exit(0);
});

startBot();