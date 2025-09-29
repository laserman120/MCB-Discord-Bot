// points.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('points')
        .setDescription('View your current points'),

    async execute(interaction, client) {
        try {
            const user = await User.findOne({ 
                userId: interaction.user.id,
                guildId: interaction.guild.id 
            }) || { points: 0, dailyStreak: 0 };

            const embed = new EmbedBuilder()
                .setColor(client.config.embeds.mainColor)
                .setAuthor({
                    name: interaction.user.tag,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .addFields(
                    { name: 'Points', value: `${user.points}`, inline: true },
                    { name: 'Daily Streak', value: `${user.dailyStreak}`, inline: true }
                )
                .setFooter({ text: 'Use /daily to earn more points!' })
                .setTimestamp();

            await interaction.reply({ 
                embeds: [embed],
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error in points command:', error);
            await interaction.reply({ 
                content: 'There was an error fetching your points.',
                ephemeral: true 
            });
        }
    },
};