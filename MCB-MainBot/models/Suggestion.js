const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    status: { type: String, required: true, default: 'pending' },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    threadId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Suggestion', suggestionSchema, 'suggestions');