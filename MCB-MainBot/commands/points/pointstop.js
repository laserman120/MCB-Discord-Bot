// pointstop.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pointstop')
        .setDescription('View the top 10 users with the most points'),

    async execute(interaction, client) {
        try {
            const topUsers = await User.find({ guildId: interaction.guild.id })
                .sort({ points: -1 })
                .limit(client.config.leaderboard.display_limit);
            
            if (topUsers.length === 0) {
                return interaction.reply({
                    content: 'No users found in the leaderboard yet!',
                    ephemeral: true
                });
            }

            let description = '';
            for (let i = 0; i < topUsers.length; i++) {
                const user = await client.users.fetch(topUsers[i].userId).catch(() => null);
                if (user) {
                    description += `${i + 1}. ${user.tag} - ${topUsers[i].points} points\n`;
                } else {
                    description += `${i + 1}. Unknown User - ${topUsers[i].points} points\n`;
                }
            }

            const embed = new EmbedBuilder()
                .setColor(client.config.embeds.mainColor)
                .setTitle('🏆 Points Leaderboard')
                .setDescription(description || 'No valid users found in the leaderboard.')
                .setTimestamp();

            await interaction.reply({ 
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in pointstop command:', error);
            await interaction.reply({ 
                content: 'There was an error fetching the leaderboard.',
                ephemeral: true 
            });
        }
    }
};