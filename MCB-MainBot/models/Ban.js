const mongoose = require('mongoose');

const banSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    duration: { type: String, required: true }, // '0' for permanent, otherwise duration string
    timestamp: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Ban', banSchema, 'bans');