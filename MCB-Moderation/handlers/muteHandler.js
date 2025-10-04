const { getAllActiveMutes, removeMute } = require('../utils/database');

async function scheduleUnmute(client, mute) {
    const now = Date.now();
    if (mute.expiresAt <= now) {
        // If mute already expired while bot was offline, unmute immediately
        await unmuteUser(client, mute);
        return;
    }

    const delay = mute.expiresAt - now;

    // Schedule the unmute for the future
    setTimeout(() => unmuteUser(client, mute), delay);
}

// This function contains the logic to actually remove the timeout/role
async function unmuteUser(client, mute) {
    console.log(` Mute expired for ${mute.userId}. Attempting to unmute...`);
    try {
        for (const guild of client.guilds.cache.values()) {
            try {
                const member = await guild.members.fetch(mute.userId);
                if (member) {
                    await member.timeout(null, 'Mute duration expired.');

                    if (muteRole && member.roles.cache.has(muteRole.id)) {
                        await member.roles.remove(muteRole, 'Mute duration expired');
                    }

                    console.log(` Unmuted user ${member.user.tag} in guild ${guild.name}.`);
                    break; // Stop searching once we find and unmute the member
                }
            } catch (err) {
                // This error means the member is not in this specific guild.
                if (err.code !== 10007) { // 10007 is "Unknown Member"
                    console.error(`Error fetching member ${mute.userId} in guild ${guild.name}:`, err);
                }
            }
        }
        // Whether the user was found or not, remove the expired mute from the DB
        await removeMute(mute.userId);
    } catch (error) {
        console.error(`Failed to process unmute for ${mute.userId}:`, error);
    }
}

// This is the main function we'll call on startup
async function initializeMuteHandler(client) {
    console.log(' Initializing Mute Handler...');
    const activeMutes = await getAllActiveMutes();
    if (activeMutes.length === 0) {
        console.log(' No active mutes to schedule.');
        return;
    }

    console.log(` Found ${activeMutes.length} active mutes. Scheduling unmutes...`);
    for (const mute of activeMutes) {
        scheduleUnmute(client, mute);
    }
}

module.exports = { initializeMuteHandler };