const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilderSlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
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
        .setTitle('Ban Process Initialized')
        .setDescription(`You are about to ban ${targetUser.tag} (${targetUser.id})`)
        .addFields(
            { name: 'Current Warnings', value: '0', inline: true },
            { name: 'Previous Bans', value: '0', inline: true }
        );

    // Create reason selection menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ban:reason_select:${targetUser.id}`) 
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

async function handleComponentInteraction(interaction, client) {
    // Parse the action from the customId (e.g., "ban:reason_select:123" -> "reason_select")
    const [command, action, ...args] = interaction.customId.split(':');

    // --- Ban Reason Select Menu ---
    if (action === "reason_select") {
        const targetUserId = args[0];
        const selectedReasonTitle = interaction.values[0];
        const reason = client.config.ban.reasons.find(r => r.title === selectedReasonTitle);

        const modal = new ModalBuilder()
            .setCustomId(`ban:confirm_ban:${targetUserId}`)
            .setTitle(`Banning ${targetUserId}`);

        const publicReasonInput = new TextInputBuilder()
            .setCustomId('public_reason')
            .setLabel("Public Reason (Sent to the User)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(reason.title) // Pre-fill with the selected reason
            .setRequired(true);

        const internalNotesInput = new TextInputBuilder()
            .setCustomId('internal_notes')
            .setLabel("Internal Notes (Staff Only)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Add any additional context, message links, or details here...")
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(publicReasonInput),
            new ActionRowBuilder().addComponents(internalNotesInput)
        );

        await interaction.showModal(modal);
    }

    // --- Ban Confirmation Modal ---
    if (action === 'confirm_ban') {
        const targetUserId = args[0];
        await interaction.deferReply({ ephemeral: true });
        const publicReason = interaction.fields.getTextInputValue('public_reason');
        const internalNotes = interaction.fields.getTextInputValue('internal_notes') || 'None provided.';

        try {
            const targetUser = await client.users.fetch(targetUserId);
            let userInformed = false;

            try {
                await targetUser.send(`You have been banned from the server for the following reason: ${publicReason}`);
                userInformed = true;
            }
            catch (dmError) {
                console.warn(`Could not send ban notification DM to ${targetUser.tag}. They may have DMs disabled.`);
            }

            try {
                await interaction.guild.members.ban(targetUser.id, { deleteMessageSeconds: 604800, reason: publicReason });
            catch (error) {
                console.warn(`Failed to ban user, check permissions`);
                await interaction.editReply({ content: `Failed to ban user, double check the bots permissions!` });
                }

            const addProofButton = new ButtonBuilder()
                .setCustomId('ban:add_proof')
                .setLabel('Add Proof')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('➕');

            const row = new ActionRowBuilder().addComponents(addProofButton);

            const logEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('User Banned')
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                    { name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                    { name: 'Public Reason', value: publicReason },
                    { name: 'Internal Notes', value: internalNotes },
                )
                .setTimestamp();

            if (!userInformed) {
                logEmbed.addFields({ name: 'User Notification', value: 'Failed to send DM to user. They may have DMs disabled.' });
            } else {
                logEmbed.addFields({ name: 'User Notification', value: 'User was informed of the ban via DM.' })
            }

            const logThread = await interaction.guild.channels.fetch(client.config.threads.banLogThreadId);
            await logThread.send({ embeds: [logEmbed], components: [row] });

            // ping the staff member who issued the ban to notify them of the log
            if (internalNotes == 'None provided.') {
                await logThread.send(`Please add additional proof if possible! <@${interaction.user.id}>`)
            }

            await interaction.editReply({ content: `Successfully banned ${targetUser.tag}.` });

        } catch (error) {
            console.error("Error in ban submission modal:", error);
            await interaction.editReply({ content: 'Failed to ban the user. They may not be in the server or an error occurred.' });
        }
    }

    // --- "Add Proof" Button ---
    if (action === "add_proof") {
        const originalMessage = interaction.message;
        const proofModal = new ModalBuilder()
            .setCustomId(`ban:submit_proof:${originalMessage.id}`)
            .setTitle('Add Proof to Ban Log');

        const proofInput = new TextInputBuilder()
            .setCustomId('proof_text')
            .setLabel("Proof (Message Links, Imgur URLs, etc.)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Paste evidence here. Each submission will be added as a new field.")
            .setRequired(true);

        proofModal.addComponents(new ActionRowBuilder().addComponents(proofInput));
        await interaction.showModal(proofModal);
    }

    // --- Proof Submission Modal ---
    if (action === 'submit_proof') {
        const messageId = args[0];
        const proofText = interaction.fields.getTextInputValue('proof_text');

        // The interaction comes from the "Add Proof" button's message
        const logChannel = interaction.channel;
        const logMessage = await logChannel.messages.fetch(messageId);

        if (!logMessage || logMessage.embeds.length === 0) {
            return interaction.reply({ content: 'Could not find the original log message to update.', ephemeral: true });
        }

        const originalEmbed = logMessage.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .addFields({
                name: `Proof Added by ${interaction.user.tag}`,
                value: proofText
            })
            .setTimestamp(); // Update the timestamp to show the last edit

        await logMessage.edit({ embeds: [updatedEmbed] });
        await interaction.reply({ content: 'Proof has been added to the log.', ephemeral: true });
    }
}

module.exports = {
    data,
    contextMenu,
    execute,
    handleComponentInteraction,
}; 