const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelistaccept')
    .setDescription('Accept a whitelist application'),
  async execute(interaction, client) {
    // Check if user has staff role
      if (!interaction.member.roles.cache.has(client.config.roles.supportRole)) {
      return interaction.reply({ content: client.config.messages.noPermission, ephemeral: true });
    }

    // Check if in a ticket channel
    if (!interaction.channel.topic || !interaction.channel.topic.includes('|')) {
      return interaction.reply({ content: 'This command can only be used in whitelist ticket channels.', ephemeral: true });
    }

    // Get ticket creator ID
    const userId = interaction.channel.topic.split('|')[0].trim();
    const member = await interaction.guild.members.fetch(userId);

    // Get their Minecraft username from the first message
    const firstMessage = (await interaction.channel.messages.fetch({ limit: 1, after: 1 })).first();
    const minecraftUsername = firstMessage.embeds[0]?.fields?.find(f => f.name === 'Minecraft Username')?.value;

    if (!minecraftUsername) {
      return interaction.reply({ content: 'Could not find Minecraft username in ticket.', ephemeral: true });
    }

    // Add role and set nickname
      await member.roles.add(client.config.roles.whitelistRole);

      // Fail gracefully if nickname change fails
      try {
          await member.setNickname(minecraftUsername);
      } catch (error) { }
    

    // Send DM to user
    const dmEmbed = new EmbedBuilder()
      .setColor(client.config.panelColor)
      .setTitle('Whitelist Application Accepted!')
      .setDescription(client.config.messages.whitelistAccepted);

    await member.send({ embeds: [dmEmbed] }).catch(() => {
      interaction.channel.send('Note: Unable to DM user about acceptance.');
    });

    // Create embed for ticket message
    const ticketEmbed = new EmbedBuilder()
      .setColor(client.config.panelColor)
      .setDescription(`Hey ${member}, welcome! :pray:\n
I have edited your perms and a new channel should have opened up for you.\n
<#1296131648949063701> - this one has all the info you need to be able to connect to the server.\n
Once you log in, you'll have another bunch of channels open up.\n
One of them is the <#1302309514946678816> channel, which has a list of useful resources like:
- Public farm information and user guides
- The blue map
- A list of the data packs and plugins we use which slightly modify the base game\n
Feel free to leave this ticket open until you're safely on the server, and you're welcome to ping us here if you run into any issues.\n
Have fun! Look forward to seeing you online! 🎮`);

      // Add user to whitelist
      // First fetch the console channel

      const consoleChannel = await interaction.guild.channels.fetch(client.config.channels.serverConsoleChannel)
      if (consoleChannel != null) {
          consoleChannel.send(client.config.messages.whitelistAcceotedServerCommand + minecraftUsername);
      } else {
          interaction.channel.send("Note: Unable to add user to server whitelist - console channel not found. Please add them manually.")
      }

    // Send message in ticket
    await interaction.channel.send({ embeds: [ticketEmbed] });

    await interaction.reply({ content: 'Whitelist application accepted successfully!', ephemeral: true });
  },
};