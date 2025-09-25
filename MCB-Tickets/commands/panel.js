const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Display the ticket panel'),
  async execute(interaction, client) {
    const config = client.config;
    console.log("1")
    const embed = new EmbedBuilder()
      .setColor(config.panelColor)
      .setTitle(config.panelTitle)
      .setDescription(config.panelDescription);

    const dropdown = new StringSelectMenuBuilder()
      .setCustomId('create_ticket')
      .setPlaceholder(config.dropdownPlaceholder);
    console.log("2")
    config.ticketCategories.forEach(category => {
      dropdown.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(category.label)
          .setValue(category.value)
          .setDescription(category.description)
          .setEmoji(category.emoji)
      );
    });
    console.log("3")
    const component = new ActionRowBuilder().addComponents(dropdown);

    // Send the embed and dropdown to the channel
    await interaction.channel.send({ embeds: [embed], components: [component] });
    
    // Acknowledge the interaction without sending a visible response
    await interaction.reply({ content: 'Panel sent successfully.', ephemeral: true });
  },
};