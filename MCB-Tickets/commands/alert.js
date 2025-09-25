// commands/alert.js
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { handleCloseTicket } = require('../ticketHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alert')
    .setDescription('Set an inactivity alert for the ticket'),
  async execute(interaction, client) {
    // Check if the channel is a ticket
    if (!interaction.channel.topic || !interaction.channel.topic.includes('|')) {
      return interaction.reply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
    }

    const config = client.config;
    const inactivityTime = config.ticketSystem.inactivityTimeout * 60 * 1000; // Convert minutes to milliseconds
    const closeTime = Math.floor((Date.now() + inactivityTime) / 1000);

    // Get ticket creator ID and fetch user
    const userId = interaction.channel.topic.split('|')[0].trim();
    const user = await client.users.fetch(userId);

    // Create and send DM to ticket creator
    const dmEmbed = new EmbedBuilder()
      .setColor(config.panelColor)
      .setTitle('Ticket Alert')
      .setDescription(`Your ticket in ${interaction.channel.name} may be resolved or has shown inactivity. If no response is received by <t:${closeTime}:R>, the ticket will be automatically closed.`);

    try {
      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error('Failed to send DM to user:', error);
    }

    // Create and send channel embed
    const channelEmbed = new EmbedBuilder()
      .setColor(config.panelColor)
      .setTitle('Inactivity Alert')
      .setDescription(`<@${userId}> If this ticket has no activity by <t:${closeTime}:R>, it will be automatically closed. If you're finished with this ticket, click the close button below.`);

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    // Send the message with both a ping and the embed
    const alertMessage = await interaction.reply({ 
      content: `<@${userId}>`,
      embeds: [channelEmbed], 
      components: [row], 
      fetchReply: true 
    });

    // Set up the inactivity check
    const checkInactivity = async () => {
      try {
        // Get all messages after the alert message
        const messages = await interaction.channel.messages.fetch({ 
          after: alertMessage.id 
        });

        if (messages.size === 0) {
          // No new messages, close the ticket
          await handleCloseTicket(
            { 
              channel: interaction.channel,
              guild: interaction.guild,
              user: interaction.user,
            }, 
            client, 
            `Automatically closed due to inactivity (/alert ran by ${interaction.user.tag})`
          );
        } else {
          // There was activity, remove the alert message
          await alertMessage.delete().catch(console.error);
        }
      } catch (error) {
        console.error('Error in checkInactivity:', error);
      }
    };

    // Create message collector to watch for new messages
    const collector = interaction.channel.createMessageCollector({
      time: inactivityTime
    });

    collector.on('collect', async () => {
      // New message received, delete alert and stop collector
      await alertMessage.delete().catch(console.error);
      collector.stop();
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // Timer expired, check for inactivity
        await checkInactivity();
      }
    });
  },
};