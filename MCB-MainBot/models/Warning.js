const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    expires: { type: Date, required: true }
});

module.exports = mongoose.model('Warning', warningSchema, 'warnings');