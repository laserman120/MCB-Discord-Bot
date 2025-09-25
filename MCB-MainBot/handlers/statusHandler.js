const { ActivityType } = require('discord.js');

function updateStatus(client, config) {
    // Validate config exists
    if (!config.botStatus) {
        console.error('Bot status configuration missing');
        return;
    }

    // Validate status text array exists and has content
    if (!Array.isArray(config.botStatus.statusText) || config.botStatus.statusText.length === 0) {
        console.error('No status messages configured in botStatus.statusText');
        return;
    }

    // Define valid status types and their mappings to ActivityType
    const statusMappings = {
        'PLAYING': ActivityType.Playing,
        'WATCHING': ActivityType.Watching,
        'LISTENING': ActivityType.Listening,
        'COMPETING': ActivityType.Competing,
        'STREAMING': ActivityType.Streaming
    };

    let statusType = (config.botStatus.status || 'PLAYING').toUpperCase();

    // Validate status type
    if (!statusMappings[statusType]) {
        console.warn(`Invalid status type "${statusType}", defaulting to PLAYING`);
        statusType = 'PLAYING';
    }

    // Get refresh time with default of 300 seconds (5 minutes)
    const refreshTime = config.botStatus.refreshTime || 300;

    let statusIndex = 0;
    
    // Initial status set
    updateBotStatus();

    // Set interval for status rotation
    setInterval(updateBotStatus, refreshTime * 1000);

    // Function to update the bot's status
    function updateBotStatus() {
        try {
            const guild = client.guilds.cache.get(config.bot.guildId);
            let text = config.botStatus.statusText[statusIndex];
            
            // Replace {users} placeholder if it exists
            if (text.includes('{users}') && guild) {
                text = text.replace('{users}', guild.memberCount);
            }

            client.user.setActivity(text, { 
                type: statusMappings[statusType]
            });

            // Move to next status or loop back to beginning
            statusIndex = (statusIndex + 1) % config.botStatus.statusText.length;

        } catch (error) {
            console.error('Error updating bot status:', error);
        }
    }
}

module.exports = { updateStatus };