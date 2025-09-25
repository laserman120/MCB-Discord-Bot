// commands/misc/embed.js
const { 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create a custom embed message')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client, config) {
        // Create the modal
        const modal = new ModalBuilder()
            .setCustomId('embed-modal')
            .setTitle('Create Custom Embed');

        // Color input
        const colorInput = new TextInputBuilder()
            .setCustomId('embed-color')
            .setLabel('Color (Hex code)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Example: #ff0000')
            .setMaxLength(7)
            .setRequired(true);

        // Title input
        const titleInput = new TextInputBuilder()
            .setCustomId('embed-title')
            .setLabel('Embed Title')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the title for your embed')
            .setMaxLength(256)
            .setRequired(true);

        // Content input
        const contentInput = new TextInputBuilder()
            .setCustomId('embed-content')
            .setLabel('Embed Content')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter the content for your embed')
            .setMaxLength(4000)
            .setRequired(true);

        // Create action rows
        const firstActionRow = new ActionRowBuilder().addComponents(colorInput);
        const secondActionRow = new ActionRowBuilder().addComponents(titleInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(contentInput);

        // Add inputs to modal
        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        // Show the modal
        await interaction.showModal(modal);
    },
};