const { getDb } = require('../../Utils/database.js'); // Assumes path to your central DB handler

/**
 * Schedules a ticket to be closed at a specific time.
 * @param {string} channelId The ID of the ticket channel.
 * @param {string} guildId The ID of the guild.
 * @param {number} closeAt The timestamp (in ms) when the ticket should be closed.
 */
async function scheduleTicketClosure(channelId, guildId, closeAt) {
    const db = getDb();
    const collection = db.collection('scheduledTicketClosures');
    await collection.updateOne(
        { channelId: channelId },
        { $set: { guildId, closeAt } },
        { upsert: true } // Creates a new entry if one doesn't exist
    );
}

/**
 * Cancels a scheduled ticket closure.
 * @param {string} channelId The ID of the ticket channel.
 */
async function cancelTicketClosure(channelId) {
    const db = getDb();
    const collection = db.collection('scheduledTicketClosures');
    await collection.deleteOne({ channelId: channelId });
}

/**
 * Gets all pending scheduled closures from the database.
 * @returns {Promise<Array>}
 */
async function getAllScheduledClosures() {
    const db = getDb();
    const collection = db.collection('scheduledTicketClosures');
    return await collection.find({}).toArray();
}

module.exports = {
    scheduleTicketClosure,
    cancelTicketClosure,
    getAllScheduledClosures,
};