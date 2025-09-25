const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const { handleCloseTicket } = require('../ticketHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelistdeny')
    .setDescription('Deny a whitelist application'),
  async execute(interaction, client) {
    // Check if user has staff role
    if (!interaction.member.roles.cache.has(client.config.roles.supportRole)) {
      return interaction.reply({ content: client.config.messages.noPermission, ephemeral: true });
    }

    // Check if in a ticket channel
    if (!interaction.channel.topic || !interaction.channel.topic.includes('|')) {
      return interaction.reply({ content: 'This command can only be used in whitelist ticket channels.', ephemeral: true });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('deny_reason')
      .setPlaceholder('Select denial reason')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Age')
          .setValue('age')
          .setDescription('User does not meet age requirements')
          .setEmoji('👶'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Immature')
          .setValue('immature')
          .setDescription('Application shows lack of maturity')
          .setEmoji('🤪'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Profile')
          .setValue('profile')
          .setDescription('Issues with user profile/history')
          .setEmoji('👤'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Username')
          .setValue('username')
          .setDescription('Incorrect username')
          .setEmoji('😭'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Other')
          .setValue('other')
          .setDescription('Other reason (custom)')
          .setEmoji('❓')
      );

    const row = new ActionRowBuilder().addComponents(select);

    const embed = new EmbedBuilder()
      .setColor(client.config.panelColor)
      .setTitle('Deny Whitelist Application')
      .setDescription('Why should this application be denied?');

    const reply = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

    // Create collector for the select menu
    const collector = interaction.channel.createMessageComponentCollector({ 
      filter: i => i.customId === 'deny_reason' && i.user.id === interaction.user.id,
      time: 60000,
      max: 1
    });

    collector.on('collect', async i => {
      const userId = interaction.channel.topic.split('|')[0].trim();

      if (i.values[0] === 'other') {
        const modal = new ModalBuilder()
          .setCustomId('deny_reason_modal')
          .setTitle('Custom Denial Reason');

        const reasonInput = new TextInputBuilder()
          .setCustomId('custom_reason')
          .setLabel('Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await i.showModal(modal);

        try {
          const modalSubmit = await i.awaitModalSubmit({ 
            filter: mi => mi.customId === 'deny_reason_modal' && mi.user.id === interaction.user.id,
            time: 60000 
          });

          const customReason = modalSubmit.fields.getTextInputValue('custom_reason');
          const reason = client.config.messages.whitelistDenied.other.replace('{reason}', customReason);
          
          const denyEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Application Denied')
            .setDescription(`<@${userId}> ${reason}`);

          const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger);

          const buttonRow = new ActionRowBuilder().addComponents(closeButton);

          await interaction.channel.send({ embeds: [denyEmbed], components: [buttonRow] });
          await modalSubmit.reply({ content: 'Application denied successfully!', ephemeral: true });
        } catch (error) {
          console.error('Modal submission error:', error);
        }
      } else {
        const reason = client.config.messages.whitelistDenied[i.values[0]];
        
        const denyEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Application Denied')
          .setDescription(`<@${userId}> ${reason}`);

        const closeButton = new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger);

        const buttonRow = new ActionRowBuilder().addComponents(closeButton);

        await interaction.channel.send({ embeds: [denyEmbed], components: [buttonRow] });
        await i.update({ content: 'Application denied successfully!', components: [], embeds: [] });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'Command timed out', components: [], embeds: [] });
      }
    });
  },
};