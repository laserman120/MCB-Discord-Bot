// pointsview.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pointsview')
        .setDescription('View points for a specific user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check points for')
                .setRequired(true)),

    async execute(interaction, client) {
        try {
            const target = interaction.options.getUser('user');
            const user = await User.findOne({ 
                userId: target.id,
                guildId: interaction.guild.id 
            }) || { points: 0, dailyStreak: 0 };

            const embed = new EmbedBuilder()
                .setColor(client.config.embeds.mainColor)
                .setAuthor({
                    name: target.tag,
                    iconURL: target.displayAvatarURL()
                })
                .addFields(
                    { name: 'Points', value: `${user.points}`, inline: true },
                    { name: 'Daily Streak', value: `${user.dailyStreak}`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ 
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in pointsview command:', error);
            await interaction.reply({ 
                content: 'There was an error fetching the points.',
                ephemeral: true 
            });
        }
    },
};
