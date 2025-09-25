const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply to become a moderator'),
  async execute(interaction, client) {
    const config = client.config;

    // Check if the user has reached the ticket limit
    const ticketHandler = require('../ticketHandler');
    const openTickets = await ticketHandler.countOpenTickets(interaction.guild, interaction.user.id, config);
    if (openTickets >= config.ticketSystem.maxTicketsPerUser) {
      return interaction.reply({ 
          content: config.messages.ticketLimitReached || `You have reached the maximum number of open tickets (${config.ticketSystem.maxTicketsPerUser}). Please close some of your existing tickets before opening a new one.`, 
        ephemeral: true 
      });
    }

    // Create modal with moderator application questions
    const modal = new ModalBuilder()
      .setCustomId('ticket_modapplication')
      .setTitle('Moderator Application');

    // Minecraft Username
    const minecraftUsernameInput = new TextInputBuilder()
      .setCustomId('question_0')
      .setLabel('Minecraft Username')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your Minecraft username')
      .setRequired(true);

    // Why do you want to become a mod?
    const whyModInput = new TextInputBuilder()
      .setCustomId('question_1')
      .setLabel('Why do you want to become a mod?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Tell us why you want to become a moderator')
      .setRequired(true);

    // What makes you a good moderator?
    const goodModInput = new TextInputBuilder()
      .setCustomId('question_2')
      .setLabel('What makes you a good moderator?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Describe what qualities make you suitable for moderation')
      .setRequired(true);

    // Create action rows
    const row1 = new ActionRowBuilder().addComponents(minecraftUsernameInput);
    const row2 = new ActionRowBuilder().addComponents(whyModInput);
    const row3 = new ActionRowBuilder().addComponents(goodModInput);

    modal.addComponents(row1, row2, row3);

    await interaction.showModal(modal);
  },
}; 