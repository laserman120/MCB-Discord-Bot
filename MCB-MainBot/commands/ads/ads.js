const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ServerSettings = require('../../models/ServerSettings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ads')
        .setDescription('View information about the advertisement system'),

    async execute(interaction, client) {
        try {
            const serverSettings = await ServerSettings.findOne({ 
                guildId: interaction.guild.id 
            });

            const lastAdTime = serverSettings?.lastAdTime ? 
                `Last server ad: <t:${Math.floor(serverSettings.lastAdTime.getTime() / 1000)}:R>` : 
                'No ads posted yet';

            const embed = new EmbedBuilder()
                .setColor(client.config.embeds.mainColor)
                .setTitle('Advertisement System')
                .setDescription('Post your advertisements to promote your Minecraft content!')
                .addFields(
                    { name: 'Cost', value: `${client.config.ads.cost} points per advertisement` },
                    { name: 'Cooldown', value: `${client.config.ads.userCooldown / 3600} hour(s)` },
                    { name: 'Maximum Length', value: `${client.config.ads.max_length} characters` },
                    { name: 'Status', value: lastAdTime },
                    { name: 'Rules', value: client.config.ads.rules }
                )
                .setFooter({ text: 'Use /ad to create an advertisement' });

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in ads command:', error);
            await interaction.reply({ 
                content: 'There was an error fetching advertisement information.', 
                ephemeral: true 
            });
        }
    },
};