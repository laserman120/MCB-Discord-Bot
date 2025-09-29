const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

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

        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        const muteRole = interaction.guild.roles.cache.get(client.config.roles.muteRoleId);

        if (!muteRole) {
            return interaction.editReply({
                content: 'Mute role not found. Please check your configuration.',
                embeds: [],
                components: []
            });
        }

        // Check if bot has permission to manage this role
        const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
        if (!botMember.permissions.has('ManageRoles')) {
            return interaction.editReply({
                content: 'I do not have permission to manage roles.',
                embeds: [],
                components: []
            });
        }

        // Check role hierarchy
        if (muteRole.position >= botMember.roles.highest.position) {
            return interaction.editReply({
                content: 'I cannot assign the mute role because it is higher than or equal to my highest role. Please move the mute role below my highest role.',
                embeds: [],
                components: []
            });
        }

        if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
            return interaction.editReply({
                content: 'I cannot mute this user because they have a role higher than or equal to my highest role.',
                embeds: [],
                components: []
            });
        }

        // Add mute role
        await targetMember.roles.add(muteRole);

        // Create mute log embed
        const logEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('User Muted')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
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

            await targetUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.error('Could not send DM to muted user:', dmError);
        }

        // Update interaction
        await interaction.editReply({
            content: `Successfully muted ${targetUser.tag} for ${duration} hours`,
            embeds: [],
            components: []
        });

        // Set timeout to remove mute role
        setTimeout(async () => {
            try {
                await targetMember.roles.remove(muteRole);
                
                // Send unmute DM
                try {
                    const unmuteEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Mute Expired')
                        .setDescription(`Your mute in ${interaction.guild.name} has expired`);

                    await targetUser.send({ embeds: [unmuteEmbed] });
                } catch (dmError) {
                    console.error('Could not send unmute DM:', dmError);
                }

                // Log unmute
                try {
                    const logThread = await interaction.guild.channels.fetch(client.config.threads.muteLogThreadId);
                    const unmuteLogEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('User has been unmuted')
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                        .setDescription(`<@${interaction.client.user.id}> has unmuted <@${targetUser.id}>`)
                        .addFields(
                            { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
                        );

                    await logThread.send({ embeds: [unmuteLogEmbed] });
                } catch (logError) {
                    console.error('Could not send unmute log:', logError);
                }
            } catch (unmuteError) {
                console.error('Error removing mute role:', unmuteError);
            }
        }, duration * 60 * 60 * 1000);

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