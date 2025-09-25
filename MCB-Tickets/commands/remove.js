// commands/remove.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a user from the ticket')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to remove from the ticket')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction, client) {
    // Check if the channel is a ticket
    if (!interaction.channel.topic || !interaction.channel.topic.includes('|')) {
      return interaction.reply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    
    // Remove user from the ticket channel
    await interaction.channel.permissionOverwrites.delete(user);

    // Send the embed with the message from config
    const embed = {
      color: parseInt(client.config.panelColor.replace('#', ''), 16),
      description: client.config.messages.userRemoved.replace('{user}', user.toString()),
    };

    await interaction.reply({ embeds: [embed] });
  },
};