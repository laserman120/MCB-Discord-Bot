const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll for a chance to win points (40% chance to win 1-5 points)'),

    async execute(interaction, client) {
        try {
            // Get or create user
            let user = await User.findOne({ 
                userId: interaction.user.id,
                guildId: interaction.guild.id 
            });

            if (!user) {
                user = new User({
                    userId: interaction.user.id,
                    guildId: interaction.guild.id,
                    points: 0
                });
            }

            const now = new Date();
            const lastRoll = user.lastRoll ? new Date(user.lastRoll) : null;
            const isBooster = interaction.member.premiumSince !== null;
            const cooldownHours = isBooster ? 12 : 24;

            // Check cooldown
            if (lastRoll) {
                const timeSinceLastRoll = now - lastRoll;
                const cooldownMs = cooldownHours * 60 * 60 * 1000;
                
                if (timeSinceLastRoll < cooldownMs) {
                    const hoursRemaining = Math.ceil((cooldownMs - timeSinceLastRoll) / (1000 * 60 * 60));
                    return interaction.reply({
                        content: `You can roll again in ${hoursRemaining} hours!`,
                        ephemeral: true
                    });
                }
            }

            // Roll logic (40% chance to win)
            const roll = Math.random();
            const won = roll <= 0.4;
            let pointsWon = 0;

            if (won) {
                pointsWon = Math.floor(Math.random() * 5) + 1; // Random number between 1-5
                user.points += pointsWon;
            }

            // Update last roll time
            user.lastRoll = now;
            await user.save();

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(won ? client.config.embeds.acceptedEmbed : client.config.embeds.deniedEmbed)
                .setTitle('🎲 Roll Results')
                .setDescription(won ? 
                    `Congratulations! You won ${pointsWon} points!` : 
                    'Better luck next time!')
                .addFields(
                    { 
                        name: 'Result', 
                        value: won ? '🎉 Winner!' : '❌ No points', 
                        inline: true 
                    },
                    { 
                        name: 'Current Balance', 
                        value: `${user.points}`, 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: isBooster ? 
                        'Server Boosters can roll every 12 hours!' : 
                        'You can roll again in 24 hours!' 
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in roll command:', error);
            await interaction.reply({ 
                content: 'There was an error processing your roll!', 
                ephemeral: true 
            });
        }
    },
}; 