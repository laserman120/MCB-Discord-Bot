const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { addMute } = require('../utils/database');

// Create the slash command
const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to mute')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('duration')
            .setDescription('Duration of mute in hours')
            .setRequired(false));

// Create the context menu command
const contextMenu = new ContextMenuCommandBuilder()
    .setName('Mute User')
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

    const duration = interaction.options.getInteger('duration') || client.config.moderationSystem.muteSettings.defaultDuration;

    // Create embed showing mute information
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('Mute Confirmation')
        .setDescription(`You are about to mute ${targetUser.tag} (${targetUser.id})`)
        .addFields(
            { name: 'Duration', value: `${duration} hours`, inline: true }
        );

    // Create reason selection menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mute_reason_${targetUser.id}_${duration}`)
        .setPlaceholder('Select a reason for the mute')
        .addOptions(
            client.config.mute.reasons.map(reason => ({
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

async function handleMute(interaction, client, targetUser, reason, duration) {
    try {
        // If reason is "Other", show modal
        if (reason === "Other") {
            const modal = new ModalBuilder()
                .setCustomId('mute_custom_reason')
                .setTitle('Custom Mute Reason');

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Please specify the reason for the mute')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const actionRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(actionRow);

            // Store the user and duration in a temporary object for the modal handler
            interaction.client.tempMuteData = {
                targetUser,
                duration
            };

            await interaction.showModal(modal);
            return;
        }

        // Defer the interaction first
        await interaction.deferUpdate();

        const muteRole = await interaction.guild.roles.fetch(client.config.roles.muteRoleId);

        if (!muteRole) {
            throw new Error("Mute role not found in config.");
        }

        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        const durationHours = parseInt(duration);
        const durationMs = durationHours * 60 * 60 * 1000;
        const timestamp = Date.now();
        const expiresAt = timestamp + durationMs;

        // Use the native timeout function instead of roles
        await targetMember.timeout(durationMs, reason);

        await targetMember.roles.add(muteRole, `Mute applied by ${interaction.user.tag}`);

        // Add the mute to the database
        await addMute(targetUser.id, reason, interaction.user.id, durationHours, timestamp, expiresAt);

        // Create mute log embed
        const logEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('User Muted')
            .setThumbnail(targetMember.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'User muted:', value: `<@${targetUser.id}> (${targetUser.username})` },
                { name: 'Muted by:', value: `<@${interaction.user.id}>` },
                { name: 'Duration', value: `${duration} hours`, inline: true },
                { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: 'Expire', value: `<t:${Math.floor((Date.now() + duration * 60 * 60 * 1000) / 1000)}:F>`, inline: true },
                { name: 'Reason', value: `\`\`\`\n${reason}\n\`\`\`` }
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
        try {
            const logThread = await interaction.guild.channels.fetch(client.config.threads.muteLogThreadId);
            await logThread.send({ embeds: [logEmbed] });
        } catch (logError) {
            console.error('Could not send to log thread:', logError);
        }

        // Send DM to muted user
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('You have been muted')
                .setDescription(`You have been muted in ${interaction.guild.name}`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Duration', value: `${duration} hours` },
                    { name: 'Muted by', value: interaction.user.tag }
                );

            await targetMember.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.error('Could not send DM to muted user');
        }

        // Update interaction
        await interaction.editReply({
            content: `Successfully muted ${targetUser.tag} for ${duration} hours`,
            embeds: [],
            components: []
        });
    } catch (error) {
        console.error('Error muting user:', error);
        // Ensure we have a valid interaction to respond to
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }
        await interaction.editReply({
            content: 'There was an error muting the user. Please try again.',
            embeds: [],
            components: []
        });
    }
}

// Add modal submit handler to module.exports
module.exports = {
    data,
    contextMenu,
    execute,
    handleMute,
    async handleModalSubmit(interaction, client) {
        if (interaction.customId === 'mute_custom_reason') {
            const { targetUser, duration } = interaction.client.tempMuteData;
            const customReason = interaction.fields.getTextInputValue('reason');
            
            // Clean up temporary data
            delete interaction.client.tempMuteData;
            
            // Call handleMute with the custom reason
            await handleMute(interaction, client, targetUser, customReason, duration);
        }
    }
}; 