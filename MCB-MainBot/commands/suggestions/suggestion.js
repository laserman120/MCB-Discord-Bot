const { 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    EmbedBuilder
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggestion')
        .setDescription('Submit a suggestion for the server'),

    async execute(interaction, client, config) {
        // Create the modal
        const modal = new ModalBuilder()
            .setCustomId('suggestion-modal')
            .setTitle('Create a Suggestion');

        // Add the title input
        const titleInput = new TextInputBuilder()
            .setCustomId('suggestion-title')
            .setLabel('Suggestion Title')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter a brief title for your suggestion')
            .setMaxLength(100)
            .setRequired(true);

        // Add the suggestion input
        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestion-content')
            .setLabel('Suggestion')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe your suggestion in detail')
            .setMaxLength(1000)
            .setRequired(true);

        // Create action rows and add the inputs
        const firstRow = new ActionRowBuilder().addComponents(titleInput);
        const secondRow = new ActionRowBuilder().addComponents(suggestionInput);

        // Add the action rows to the modal
        modal.addComponents(firstRow, secondRow);

        // Show the modal
        await interaction.showModal(modal);
    }
};