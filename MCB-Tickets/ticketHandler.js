const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const path = require('path');

const ticketHandler = {
  async countOpenTickets(guild, userId, config) {
    const ticketCategory = await guild.channels.fetch(config.categories.ticketCategory);
    const ticketChannels = ticketCategory.children.cache.filter(channel => 
      channel.type === ChannelType.GuildText &&
      channel.topic &&
      channel.topic.split('|')[0].trim() === userId
    );
    return ticketChannels.size;
  },

  async handleTicketCreation(interaction, client) {
    const { customId, values } = interaction;
    const categoryValue = values[0];
    const config = client.config;

    // Check if the user has reached the ticket limit
    const openTickets = await ticketHandler.countOpenTickets(interaction.guild, interaction.user.id, config);
    if (openTickets >= config.ticketSystem.maxTicketsPerUser) {
      return interaction.reply({ 
        content: config.messages.ticketLimitReached || `You have reached the maximum number of open tickets (${config.ticketSystem.maxTicketsPerUser}). Please close some of your existing tickets before opening a new one.`, 
        ephemeral: true 
      });
    }

    const category = config.ticketCategories.find(cat => cat.value === categoryValue);
    if (!category) {
      return interaction.reply({ content: config.messages.invalidCategory, ephemeral: true });
    }

    // Create modal with questions
    const modal = new ModalBuilder()
      .setCustomId(`ticket_${categoryValue}`)
      .setTitle(`${category.label} Ticket`);

    category.questions.forEach((question, index) => {
      const textInput = new TextInputBuilder()
        .setCustomId(`question_${index}`)
        .setLabel(question.label)
        .setStyle(question.answerType === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setPlaceholder(question.placeholder)
        .setRequired(question.required);

      const actionRow = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(actionRow);
    });

    await interaction.showModal(modal);
  },

  async handleModalSubmit(interaction, client) {
    const { customId, fields } = interaction;
    const categoryValue = customId.split('_')[1];
    const config = client.config;

    const category = config.ticketCategories.find(cat => cat.value === categoryValue);
    if (!category) {
      return interaction.reply({ content: config.messages.invalidCategory, ephemeral: true });
    }

    // Generate the channel name
    let channelName = category.channelName.replace('<username>', interaction.user.username).replace(/\s+/g, '-').toLowerCase();

    // Create ticket channel
    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.categories.ticketCategory,
      topic: `${interaction.user.id} | ${Date.now()}`, // Store creator ID and creation time
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel, 
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ],
        },
        {
          id: category.pingRole || config.roles.supportRole,
          allow: [
            PermissionFlagsBits.ViewChannel, 
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ],
        },
      ],
    });

    // Create embed with questions and answers
    const embed = new EmbedBuilder()
      .setColor(config.panelColor)
      .setTitle(`${category.label} Ticket`)
      .setDescription(`Ticket opened by ${interaction.user}`);

    // Add fields for questions and answers
    embed.addFields(
      category.questions.map((question, index) => ({
        name: question.label,
        value: fields.getTextInputValue(`question_${index}`) || 'No answer provided',
      }))
    );

    // Create close button
    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    // Determine which role to ping
    const roleToPing = category.pingRole || config.roles.supportRole;
    await channel.send({ content: `<@&${roleToPing}> | ${interaction.user}`, embeds: [embed], components: [row] });

      if (category.handler) {
          try {
              const handlerPath = path.resolve(__dirname, category.handler); // Use absolute path

              const handler = require(handlerPath);

              if (handler && typeof handler.execute === 'function') {
                  // Pass the channel and the full category config to the handler
                  await handler.execute(interaction, channel, category);
              }
          } catch (error) {
              console.error(`[Ticket Handler] Error executing handler for category "${category.value}":`, error);
              await channel.send('An error occurred while trying to load the next step for this ticket. Please contact an administrator.');
          }
      }

    // Reply to the user
    await interaction.reply({ content: config.messages.ticketCreated, ephemeral: true });
  },

  async handleCloseTicket(interaction, client, reason = '') {
    const config = client.config;
    
    // Get the ticket creator and creation time
    const ticketCreator = interaction.channel.topic.split('|')[0].trim();
    const creationTime = parseInt(interaction.channel.topic.split('|')[1].trim());
  
    // Create transcript
    const transcript = await discordTranscripts.createTranscript(interaction.channel, {
      limit: -1,
      returnBuffer: false,
      fileName: `transcript-${interaction.channel.name}.html`,
      footerText: config.transcriptFooter,
    });
  
    // Try to send transcript to user
    let userNotified = false;
    try {
      const user = await client.users.fetch(ticketCreator);
      await user.send({
        content: config.messages.ticketClosedEmbed,
        files: [transcript],
      });
  
      // Create embed for user
      const userEmbed = new EmbedBuilder()
        .setColor(config.panelColor)
        .setTitle(`Ticket Closed: ${interaction.channel.name}`)
        .addFields(
          { name: 'Closed by', value: `${interaction.user}`, inline: true },
          { name: 'Opened at', value: `<t:${Math.floor(creationTime / 1000)}:F>`, inline: true },
          { name: 'Closed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        );
  
      await user.send({ embeds: [userEmbed] });
      userNotified = true;
    } catch (error) {
      console.error('Failed to send DM to user:', error);
      // We'll handle this in the transcript channel message
    }
  
    // Send transcript to transcript channel
    const transcriptChannel = await interaction.guild.channels.fetch(config.channels.transcriptChannel);
    
    const channelEmbed = new EmbedBuilder()
      .setColor(config.panelColor)
      .setTitle(`Ticket Closed: ${interaction.channel.name}`)
      .addFields(
        { name: 'Opened by', value: `<@${ticketCreator}>`, inline: true },
        { name: 'Closed by', value: `${interaction.user}`, inline: true },
        { name: 'Opened at', value: `<t:${Math.floor(creationTime / 1000)}:F>`, inline: true },
        { name: 'Closed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: 'User Notified', value: userNotified ? 'Yes' : 'No (Unable to send DM)', inline: true }
      );
  
    if (reason) {
      channelEmbed.addFields({ name: 'Reason', value: reason, inline: false });
    }
  
    await transcriptChannel.send({ embeds: [channelEmbed], files: [transcript] });
  
    // Close the ticket
    await interaction.channel.delete();
  
    // Log the ticket closure
    console.log(`Ticket closed by ${interaction.user.tag}`);
  }
};

module.exports = ticketHandler;