const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const { addWarning, getUserWarnings, shouldMuteUser, getWarningCount, addMute } = require('../utils/database');
const path = require('path');

async function handleWarning(interaction, client, targetUser, reason) {
    const timestamp = Date.now();

    // Add warning to database
    await addWarning(targetUser.id, reason.title, interaction.user.id, timestamp, client);

    // Check if user should be muted after this warning
    const shouldMute = await shouldMuteUser(targetUser.id, client);
    const warningCount = await getWarningCount(targetUser.id);

    // Get message content if this is a context menu command
    let messageContent = '';
    if (interaction.isMessageContextMenuCommand() && interaction.targetMessage) {
        // Get the reference message if it exists
        const referencedMessage = interaction.targetMessage.reference ?
            await interaction.channel.messages.fetch(interaction.targetMessage.reference.messageId).catch(() => null) : null;

        // Add referenced message if it exists
        if (referencedMessage) {
            messageContent = `\nReplying to:\n\`\`\`\n${referencedMessage.content}\n\`\`\`\nMessage:\n\`\`\`\n${interaction.targetMessage.content}\n\`\`\``;
        } else {
            messageContent = `\nMessage:\n\`\`\`\n${interaction.targetMessage.content}\n\`\`\``;
        }
    }

    // Create warning embed that will be used for logging
    const warningEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Warning Issued')
        .addFields(
            { name: 'Warning given to:', value: `<@${targetUser.id}> (${targetUser.username})` },
            { name: 'Given by:', value: `<@${interaction.user.id}>` },
            { name: 'Warnings', value: `${warningCount}/${client.config.moderationSystem.warningSettings.maxWarnings}` },
            { name: 'Date Given', value: `<t:${Math.floor(timestamp / 1000)}:F>` },
            { name: 'Expire', value: `<t:${Math.floor((timestamp + (client.config.moderationSystem.warningSettings.warningExpirationDays * 24 * 60 * 60 * 1000)) / 1000)}:F>` },
            { name: 'Reason', value: `\`\`\`\n${reason.title}${reason.description ? `\n${reason.description}` : ''}\n\`\`\`` }
        );

    // Add message content if from context menu
    if (interaction.isMessageContextMenuCommand() && interaction.targetMessage) {
        warningEmbed.addFields({
            name: 'Message',
            value: `\`\`\`\n${interaction.targetMessage.content}\n\`\`\``
        });
    }

    // Create a copy of the embed for DMs with different format
    const dmEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`You got a warning in ${interaction.guild.name}`)
        .setDescription(`Warned By: <@${interaction.user.id}>
Reason:
\`\`\`
${reason.title}${reason.description ? `\n${reason.description}` : ''}
\`\`\`
Date: <t:${Math.floor(timestamp / 1000)}:F>
Expire: <t:${Math.floor((timestamp + (client.config.moderationSystem.warningSettings.warningExpirationDays * 24 * 60 * 60 * 1000)) / 1000)}:F>`)
        .setTimestamp();

    let dmSent = false;
    try {
        // Attempt to send DM to the warned user
        await targetUser.send({ embeds: [dmEmbed] });
        dmSent = true;
    } catch (error) {
        // Log DM failure but continue with other operations
        console.log(`Could not send warning DM to ${targetUser.tag}: ${error.message}`);
    }

    // If user should be muted, apply the mute
    if (shouldMute) {
        try {
            // Get the member object
            const member = await interaction.guild.members.fetch(targetUser.id);

            // Fetch the mute role first
            const muteRole = await interaction.guild.roles.fetch(client.config.roles.mutedRoleId);

            if (!muteRole) {
                throw new Error('Mute role not found');
            }

            // Add the muted role
            await member.roles.add(muteRole);

            // Add mute to database with default duration from config
            await addMute(
                targetUser.id,
                `Automatic mute after reaching ${client.config.moderationSystem.warningSettings.maxWarnings} warnings`,
                interaction.client.user.id,
                client.config.moderationSystem.warningSettings.autoMuteDurationHours,
                timestamp
            );

            // Add mute notification to the warning embed
            warningEmbed.addFields({
                name: '🔇 Auto-Mute Applied',
                value: `User has been muted for ${client.config.moderationSystem.warningSettings.autoMuteDurationHours} hours after reaching ${client.config.moderationSystem.warningSettings.maxWarnings} warnings`,
                inline: false
            });

            // Try to DM the user about the mute
            try {
                const muteEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🔇 You have been muted')
                    .setDescription(`You have been automatically muted in ${interaction.guild.name} for reaching ${client.config.moderationSystem.warningSettings.maxWarnings} warnings`)
                    .addFields({
                        name: 'Duration',
                        value: `${client.config.moderationSystem.warningSettings.autoMuteDurationHours} hours`,
                        inline: true
                    })
                    .setTimestamp();

                await targetUser.send({ embeds: [muteEmbed] });
            } catch (error) {
                // Ignore DM errors
            }
        } catch (error) {
            console.error('Error applying auto-mute:', error);
            warningEmbed.addFields({
                name: '❌ Auto-Mute Failed',
                value: 'Failed to apply automatic mute. Please mute user manually.',
                inline: false
            });
        }
    }

    try {
        // Send log to the warning thread
        let logThread;
        try {
            // First try to fetch the thread directly
            logThread = await interaction.guild.channels.fetch(client.config.threads.warningsLogThreadId.toString());

            if (!logThread) {
                // If direct fetch fails, try to fetch it as an active thread
                const activeThreads = await interaction.guild.channels.fetchActiveThreads();
                logThread = activeThreads.threads.get(client.config.threads.warningsLogThreadId);

                if (!logThread) {
                    // If still not found, try archived threads in all channels
                    const channels = await interaction.guild.channels.fetch();
                    for (const [, channel] of channels) {
                        if (channel.isTextBased()) {
                            const archivedThreads = await channel.threads.fetchArchived();
                            const thread = archivedThreads.threads.get(client.config.threads.warningsLogThreadId);
                            if (thread) {
                                logThread = thread;
                                // Unarchive the thread if found
                                if (thread.archived) {
                                    await thread.setArchived(false);
                                }
                                break;
                            }
                        }
                    }
                }
            }

            if (!logThread) {
                throw new Error('Thread not found in any channel (active or archived)');
            }

            if (!logThread.isThread()) {
                throw new Error('The specified ID is not a thread');
            }
        } catch (error) {
            console.error(`Error accessing warning log thread: ${error.message}`);
            throw new Error(`Failed to access warning log thread: ${error.message}. Thread ID: ${client.config.threads.warningsLogThreadId}`);
        }

        // Send the warning log without DM status
        await logThread.send({ embeds: [warningEmbed] });

        // Update the interaction with confirmation
        const confirmationEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Warning Issued')
            .setDescription(`${targetUser.tag} has been warned`)
            .addFields(
                { name: 'Reason', value: `${reason.emoji} ${reason.title}\n${reason.description}` },
                { name: 'Warned by', value: interaction.user.tag },
                { name: 'Warning Expiration', value: `${client.config.moderationSystem.warningSettings.warningExpirationDays} days` }
            )
            .setTimestamp();

        // Handle different interaction types
        if (interaction.isModalSubmit()) {
            // For modal submissions, reply to the interaction
            await interaction.reply({
                embeds: [confirmationEmbed],
                components: [],
                flags: 64 // EPHEMERAL flag
            });
        } else {
            // For select menu interactions, update the interaction
            await interaction.update({
                embeds: [confirmationEmbed],
                components: []
            });
        }
    } catch (error) {
        console.error('Error handling warning:', error);

        // Handle different interaction types for errors too
        if (interaction.isModalSubmit()) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'There was an error while processing the warning. The warning was recorded but some operations failed.',
                    flags: 64 // EPHEMERAL flag
                });
            }
        } else {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.update({
                    content: 'There was an error while processing the warning. The warning was recorded but some operations failed.',
                    embeds: [],
                    components: []
                });
            }
        }
    }
}

module.exports = {
    handleWarning
};