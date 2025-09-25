const User = require('../models/User');

class PointsHandler {
    constructor(config) {
        this.config = config;
        this.userCooldowns = new Map();
    }

    async handleMessagePoints(message) {
        if (message.author.bot) return;

        try {
            // Check cooldown
            const now = Date.now();
            const lastMessageTime = this.userCooldowns.get(message.author.id) || 0;
            const cooldownMs = this.config.points.message_cooldown * 1000;

            if (now - lastMessageTime < cooldownMs) {
                return;
            }

            // Random chance to earn points
            const pointChance = Math.random();
            if (pointChance > this.config.points.message_chance) {
                return;
            }

            // Get or create user
            let user = await User.findOne({
                userId: message.author.id,
                guildId: message.guild.id
            });

            if (!user) {
                user = new User({
                    userId: message.author.id,
                    guildId: message.guild.id,
                    points: 0
                });
            }

            // Add point and save
            user.points += 1;
            await user.save();

            // Update cooldown
            this.userCooldowns.set(message.author.id, now);

        } catch (error) {
            console.error('Error handling message points:', error);
        }
    }

    // Clear old cooldowns periodically to prevent memory leaks
    startCooldownCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [userId, timestamp] of this.userCooldowns.entries()) {
                if (now - timestamp > this.config.points.message_cooldown * 1000) {
                    this.userCooldowns.delete(userId);
                }
            }
        }, 300000); // Clean up every 5 minutes
    }
}

module.exports = PointsHandler;
