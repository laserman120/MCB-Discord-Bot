const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    lastDaily: { type: Date },
    points: { type: Number, default: 0 },
    dailyStreak: { type: Number, default: 0 },
    lastRoll: { type: Date }
}, { collection: 'users' });

module.exports = mongoose.model('User', userSchema);