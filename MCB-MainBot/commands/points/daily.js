const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Collect your daily points'),

    async execute(interaction, client, config) {
        try {
            // Check if command is used in the correct channel
            if (interaction.channelId !== '1288541679040729266') {
                return interaction.reply({
                    content: `❌ This command can only be used in <#1288541679040729266>!`,
                    ephemeral: true
                });
            }

            // Get or create user
            let user = await User.findOne({ 
                userId: interaction.user.id,
                guildId: interaction.guild.id 
            });

            if (!user) {
                user = new User({
                    userId: interaction.user.id,
                    guildId: interaction.guild.id,
                    points: 0,
                    dailyStreak: 0
                });
            }

            const now = new Date();
            const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;
            const isBooster = interaction.member.premiumSince !== null;

            // Calculate time since last daily
            const timeSinceLastDaily = lastDaily ? now - lastDaily : Infinity;
            const hoursRemaining = 24 - Math.floor(timeSinceLastDaily / (1000 * 60 * 60));

            // Check if user can claim daily
            if (lastDaily && timeSinceLastDaily < 24 * 60 * 60 * 1000) {
                return interaction.reply({
                    content: `You can claim your daily points again in ${hoursRemaining} hours!`,
                    ephemeral: true
                });
            }

            // Calculate base points (random amount from config)
            let pointsEarned = config.points.daily_amount;

            // Calculate streak bonus
            let streakBonus = 0;
            if (lastDaily && timeSinceLastDaily < 48 * 60 * 60 * 1000) {
                // Streak continues
                user.dailyStreak++;
                streakBonus = Math.floor(Math.random() * 
                    (config.points.streak_bonusMax - config.points.streak_bonusMin + 1)) + 
                    config.points.streak_bonusMin;
            } else {
                // Streak resets
                user.dailyStreak = 1;
            }

            // Calculate booster bonus
            let boosterBonus = 0;
            if (isBooster) {
                boosterBonus = Math.floor(Math.random() * 
                    (config.points.streakBoosterBonusMax - config.points.streakBoosterBonusMin + 1)) + 
                    config.points.streakBoosterBonusMin;
            }

            // Update user points and last daily
            const totalPoints = pointsEarned + streakBonus + boosterBonus;
            user.points += totalPoints;
            user.lastDaily = now;
            await user.save();

            // Create embed for response
            const embed = new EmbedBuilder()
                .setColor(config.embeds.mainColor)
                .setTitle('Daily Points Claimed! 🎉')
                .setDescription(`Base Points: \`${pointsEarned}\`\nBalance: \`${user.points}\`${boosterBonus > 0 ? `\n\n:tada: Since you're a booster you have gained an extra ${boosterBonus} points` : ''}`);

            if (!isBooster) {
                embed.setFooter({ 
                    text: '💡 Boost the server to earn bonus points with your daily command!' 
                });
            }

            // Send private response to user
            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

            // If user is a booster, announce it
            if (isBooster) {
                const boosterEmbed = new EmbedBuilder()
                    .setColor(config.embeds.mainColor)
                    .setTitle('🚀 Server Booster Reward!')
                    .setDescription(`${interaction.user} just claimed their daily points and got a bonus **${boosterBonus} points** for being an awesome Server Booster!`)
                    .setTimestamp();

                await interaction.channel.send({ embeds: [boosterEmbed] });
            }

            // If user has a streak of 2 or more, announce it to everyone
            if (user.dailyStreak >= 2) {
                const streakEmbed = new EmbedBuilder()
                    .setColor(config.embeds.mainColor)
                    .setDescription(`🔥 ${interaction.user} is on a ${user.dailyStreak} day streak! Do \`/daily\` to join them!`);

                await interaction.channel.send({ embeds: [streakEmbed] });
            }

        } catch (error) {
            console.error('Error in daily command:', error);
            await interaction.reply({ 
                content: 'There was an error processing your daily points!', 
                ephemeral: true 
            });
        }
    },
};