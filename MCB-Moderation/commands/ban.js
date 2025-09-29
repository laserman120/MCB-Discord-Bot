const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// Create the slash command
const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to ban')
            .setRequired(true));

// Create the context menu command
const contextMenu = new ContextMenuCommandBuilder()
    .setName('Ban User')
    .setType(ApplicationCommandType.Message);

async function execute(interaction, client) {
    // Check if user has staff role
    const member = interaction.member;
    if (!member.roles.cache.has(client.config.roles.staffRoleId)) {
        return interaction.reply({ 
            content: 'You do not have permission to use this command.', 
            ephemeral: true 
        });
    }

    let targetUser;
    if (interaction.isMessageContextMenuCommand()) {
        targetUser = interaction.targetMessage.author;
    } else {
        targetUser = interaction.options.getUser('user');
    }

    // Create embed showing ban information
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Ban Confirmation')
        .setDescription(`You are about to ban ${targetUser.tag} (${targetUser.id})`)
        .addFields(
            { name: 'Current Warnings', value: '0', inline: true },
            { name: 'Previous Bans', value: '0', inline: true }
        );

    // Create reason selection menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ban_reason_${targetUser.id}`) 
        .setPlaceholder('Select a reason for the ban')
        .addOptions(
            client.config.ban.reasons.map(reason => ({
                label: reason.title,
                description: reason.description,
                emoji: reason.emoji,
                value: reason.title
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

async function handleBan(interaction, client, targetUser, reason) {
    try {
        const targetUserTag = targetUser.tag;
        // Ban the user
        await interaction.guild.members.ban(targetUser.id, { reason: reason });

        // Create ban log embed
        const logEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('User Banned')
            .addFields(
                { name: 'User banned:', value: `<@${targetUser.id}> (${targetUserTag})` },
                { name: 'Banned by:', value: `<@${interaction.user.id}>` },
                { name: 'Reason', value: reason },
                { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
            );

        // If this is a context menu command, add the message content to the log
        if (interaction.isMessageContextMenuCommand()) {
            logEmbed.addFields({
                name: 'Message Content',
                value: `\`\`\`\n${interaction.targetMessage.content}\n\`\`\``,
                inline: false
            });
        }

        // Send to log thread
        const logThread = await interaction.guild.channels.fetch(client.config.threads.banLogThreadId);
        await logThread.send({ embeds: [logEmbed] });

        // Update interaction
        await interaction.reply({
            content: `Successfully banned ${targetUserTag}`,
            embeds: [],
            components: [],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error banning user:', error);
        await interaction.reply({
            content: 'There was an error banning the user. Please try again.',
            embeds: [],
            components: [],
            ephemeral: true
        });
    }
}

module.exports = {
    data,
    contextMenu,
    execute,
    handleBan
}; 