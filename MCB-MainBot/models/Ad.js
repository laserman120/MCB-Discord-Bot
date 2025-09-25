
const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true,
        index: true // Add index for better query performance
    },
    guildId: { 
        type: String, 
        required: true,
        index: true // Add index for better query performance
    },
    content: { 
        type: String, 
        required: true 
    },
    messageIds: [{ 
        type: String,
        required: true
    }],
    timestamp: { 
        type: Date, 
        default: Date.now,
        index: true // Add index for time-based queries
    },
    cost: { 
        type: Number, 
        required: true 
    },
    channelsPostedIn: [{ 
        type: String,
        required: true
    }],
    status: {
        type: String,
        enum: ['active', 'deleted', 'expired'],
        default: 'active',
        index: true
    },
    title: {
        type: String,
        required: false // Optional if you want to add titles later
    },
    edited: {
        type: Boolean,
        default: false
    },
    lastEditedAt: {
        type: Date
    },
    wasBooster: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
});

// Add compound indexes for common query patterns
adSchema.index({ guildId: 1, timestamp: -1 });
adSchema.index({ userId: 1, guildId: 1, timestamp: -1 });

// Add instance methods if needed
adSchema.methods.isExpired = function() {
    const expiryTime = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    return Date.now() - this.timestamp > expiryTime;
};

// Add static methods if needed
adSchema.statics.getRecentAds = function(guildId, limit = 10) {
    return this.find({ 
        guildId: guildId,
        status: 'active'
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

// Add pre-save middleware
adSchema.pre('save', function(next) {
    if (this.isModified('content')) {
        this.edited = true;
        this.lastEditedAt = new Date();
    }
    next();
});

module.exports = mongoose.model('Ad', adSchema, 'ads');