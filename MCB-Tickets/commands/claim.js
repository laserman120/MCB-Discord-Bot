const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim a ticket to show you\'re handling it'),
  async execute(interaction, client) {
    if (!interaction.member.roles.cache.has(client.config.roles.supportRole))
    {
        return interaction.reply({ content: client.config.messages.noPermission, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(client.config.panelColor)
      .setDescription(`Ticket claimed by ${interaction.user}`)
      .setTimestamp();

    // Store claimer in channel topic
    await interaction.channel.setTopic(`${interaction.channel.topic} | claimed: ${interaction.user.username}`);
    
    await interaction.reply({ embeds: [embed] });
  }
}; 