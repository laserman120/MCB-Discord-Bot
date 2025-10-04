const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { removeMute } = require('../utils/database'); 

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

    await interaction.deferReply({ ephemeral: true });

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

        if (!targetMember.isCommunicationDisabled() && !targetMember.roles.cache.has(muteRole.id)) {
            return interaction.editReply({ content: `${targetUser.tag} is not currently muted or timed out.` });
        }

        await Promise.all([
            targetMember.timeout(null, `Manually unmuted by ${interaction.user.tag}`),
            (muteRole && targetMember.roles.cache.has(muteRole.id))
                ? targetMember.roles.remove(muteRole, `Manually unmuted by ${interaction.user.tag}`)
                : Promise.resolve() // Do nothing if role is missing or user doesn't have it
        ]);

        // Remove the mute entry from the database
        await removeMute(targetUser.id);

        // Create unmute log embed
        const logEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('User Unmuted (Manual)')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(`<@${targetUser.id}> has been manually unmuted.`)
            .addFields(
                { name: 'Unmuted by', value: interaction.user.toString() },
                { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
            );

        // Send to log thread
        try {
            const logThread = await interaction.guild.channels.fetch(client.config.threads.muteLogThreadId);
            await logThread.send({ embeds: [logEmbed] });
        } catch (logError) {
            console.error('Could not send unmute log to thread:', logError);
        }

        // Send DM to unmuted user
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('You have been unmuted')
                .setDescription(`You have been manually unmuted in ${interaction.guild.name} by a staff member.`);
            await targetUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.error('Could not send DM to unmuted user...');
        }

        // Reply to command
        await interaction.editReply({
            content: `Successfully unmuted ${targetUser.tag}`
        });

    } catch (error) {
        console.error('Error in /unmute command:', error);
        // Handle cases where the user may have left the server
        if (error.code === 10007) { // Unknown Member
            await removeMute(targetUser.id); // Clean up DB if user is gone
            return interaction.editReply({ content: 'That user could not be found in this server. Their mute has been cleared from the database.' });
        }
        await interaction.editReply({ content: 'There was an error unmuting the user. Please try again.' });
    }
}

module.exports = {
    data,
    contextMenu,
    execute
}; 