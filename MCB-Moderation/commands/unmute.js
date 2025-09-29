const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// Create the slash command
const data = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to unmute')
            .setRequired(true));

// Create the context menu command
const contextMenu = new ContextMenuCommandBuilder()
    .setName('Unmute User')
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

    try {
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        const muteRole = interaction.guild.roles.cache.get(client.config.roles.muteRoleId);

        if (!muteRole) {
            return interaction.reply({
                content: 'Mute role not found. Please check your configuration.',
                ephemeral: true
            });
        }

        // Check if user is actually muted
        if (!targetMember.roles.cache.has(muteRole.id)) {
            return interaction.reply({
                content: `${targetUser.tag} is not muted.`,
                ephemeral: true
            });
        }

        // Remove mute role
        await targetMember.roles.remove(muteRole);

        // Create unmute log embed
        const logEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('User Unmuted')
            .setDescription(`User ${targetUser.tag} (${targetUser.id}) has been unmuted`)
            .addFields(
                { name: 'Unmuted by', value: interaction.user.tag },
                { name: 'Timestamp', value: new Date().toISOString() }
            );

        // Send to log thread
        const logThread = await interaction.guild.channels.fetch(client.config.threads.muteLogThreadId);
        await logThread.send({ embeds: [logEmbed] });

        // Send DM to unmuted user
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('You have been unmuted')
                .setDescription(`You have been unmuted in ${interaction.guild.name}`)
                .addFields(
                    { name: 'Unmuted by', value: interaction.user.tag }
                );

            await targetUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.error('Could not send DM to unmuted user:', dmError);
        }

        // Reply to command
        await interaction.reply({
            content: `Successfully unmuted ${targetUser.tag}`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error unmuting user:', error);
        await interaction.reply({
            content: 'There was an error unmuting the user. Please try again.',
            ephemeral: true
        });
    }
}

module.exports = {
    data,
    contextMenu,
    execute
}; 