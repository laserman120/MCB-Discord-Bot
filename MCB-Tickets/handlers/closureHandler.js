const { getAllScheduledClosures } = require('../utils/database');
const ticketHandler = require('../ticketHandler');

// This function will be called for every scheduled closure on startup
async function scheduleClosure(client, closure) {
    const now = Date.now();
    
    // If the close time is in the past, close it immediately.
    if (closure.closeAt <= now) {
        console.log(`[Closure] Ticket ${closure.channelId} expired while offline. Closing now.`);
        await closeTicket(client, closure.channelId, client.user); // Close as the bot user
        return;
    }

    const delay = closure.closeAt - now;
    console.log(`[Closure] Scheduling ticket ${closure.channelId} to close in ${Math.round(delay / 1000 / 60)} minutes.`);
    setTimeout(() => closeTicket(client, closure.channelId, client.user), delay);
}

// A helper to find and close a ticket channel
async function closeTicket(client, channelId, closerUser) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            // We create a mock interaction object to pass to the existing handler
            const mockInteraction = {
                channel: channel,
                guild: channel.guild,
                user: closerUser,
            };
            await ticketHandler.handleCloseTicket(mockInteraction, client, "Ticket automatically closed after 24 hours.");
        }
    } catch (error) {
        // If channel is already deleted, it will throw an "Unknown Channel" error, which we can ignore.
        if (error.code !== 10003) {
            console.error(`[Closure] Failed to auto-close ticket ${channelId}:`, error);
        }
    }
}

// This is the main function we'll call on startup
async function initializeClosureHandler(client) {
    console.log('[Closure] Initializing handler...');
    const scheduledClosures = await getAllScheduledClosures();
    
    if (scheduledClosures.length > 0) {
        console.log(`[Closure] Found ${scheduledClosures.length} pending ticket closures.`);
        for (const closure of scheduledClosures) {
            scheduleClosure(client, closure);
        }
    }
}

module.exports = { initializeClosureHandler };