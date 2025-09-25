// commands/close.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { handleCloseTicket } = require('../ticketHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket'),
  async execute(interaction, client) {
    // Check if the channel is a ticket
    if (!interaction.channel.topic || !interaction.channel.topic.includes('|')) {
      return interaction.reply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
    }

    // Create and send the closing embed
    const closingEmbed = new EmbedBuilder()
      .setColor('#f91536')
      .setTitle('Ticket Closing')
      .setDescription(client.config.messages.ticketClosing);

    await interaction.reply({ embeds: [closingEmbed] });

    // Wait for 5 seconds
    setTimeout(async () => {
      await handleCloseTicket(interaction, client);
    }, 5000);
  },
};