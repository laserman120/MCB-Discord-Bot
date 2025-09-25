// commands/add.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user to the ticket')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to add to the ticket')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction, client) {
    // Check if the channel is a ticket
    if (!interaction.channel.topic || !interaction.channel.topic.includes('|')) {
      return interaction.reply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    
    // Add user to the ticket channel
    await interaction.channel.permissionOverwrites.edit(user, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    // Send the embed with the message from config
    const embed = {
      color: parseInt(client.config.panelColor.replace('#', ''), 16),
      description: client.config.messages.userAdded.replace('{user}', user.toString()),
    };

    await interaction.reply({ embeds: [embed] });
  },
};