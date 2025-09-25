const mongoose = require('mongoose');

const serverSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    lastAdTime: { type: Date }
});

module.exports = mongoose.model('ServerSettings', serverSettingsSchema, 'serverSettings');