const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { scheduleTicketClosure } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finish')
        .setDescription('Marks the ticket as finished, scheduling it to close in 24 hours.'),

    async execute(interaction, client) {
        // Check if the channel is a ticket
        if (!interaction.channel.topic || !interaction.channel.topic.includes('|')) {
            return interaction.reply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
        }
        
        const closeTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
        
        try {
            // Add to database
            await scheduleTicketClosure(interaction.channel.id, interaction.guild.id, closeTime);

            const embed = new EmbedBuilder()
                .setColor('#2ECC71') // Green
                .setTitle('Ticket Finished')
                .setDescription(`This ticket has been marked as finished by ${interaction.user}. It will be automatically closed <t:${Math.floor(closeTime / 1000)}:R>.`)
                .setFooter({ text: 'You can use the buttons below to close it now or cancel the closure.' });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('finish:cancel')
                    .setLabel('Cancel Closure')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('finish:close_now')
                    .setLabel('Close Now')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.reply({ embeds: [embed], components: [buttons] });

        } catch (error) {
            console.error("Error in /finish command:", error);
            await interaction.reply({ content: 'An error occurred while scheduling the ticket closure.', ephemeral: true });
        }
    },
};