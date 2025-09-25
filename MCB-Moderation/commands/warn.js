const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const { addWarning, getUserWarnings, shouldMuteUser, getWarningCount, addMute } = require('../utils/database');
const path = require('path');

// Create the slash command
const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user for breaking server rules')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to warn')
            .setRequired(true));

// Create the context menu commands
const userContextMenu = new ContextMenuCommandBuilder()
    .setName('Warn User')
    .setType(ApplicationCommandType.User)
    .setDMPermission(false)
    .setDefaultMemberPermissions('0');

const messageContextMenu = new ContextMenuCommandBuilder()
    .setName('Warn Message Author')
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false)
    .setDefaultMemberPermissions('0');

async function execute(interaction, client) {
    try {
        const member = interaction.member;
        const isOwner = member.id === interaction.guild.ownerId;
        const hasStaffRole = member.roles.cache.has(client.config.roles.staffRoleId.toString());

        if (!hasStaffRole && !isOwner) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true
            });
        }

        let targetUser;
        if (interaction.isUserContextMenuCommand()) {
            targetUser = interaction.targetUser;
        } else if (interaction.isMessageContextMenuCommand()) {
            targetUser = interaction.targetMessage.author;
        } else {
            targetUser = interaction.options.getUser('user');
        }

        // --- Store the targetUser ID in the select menu's custom ID ---
        const customId = `warn_reason_${targetUser.id}`;

        const warningCount = await getWarningCount(targetUser.id);
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('Warning Confirmation')
            .setDescription(`You are about to warn **${targetUser.tag}**`)
            .addFields(
                { name: 'User ID', value: targetUser.id, inline: true },
                { name: 'Current Warnings', value: `${warningCount}/${client.config.moderationSystem.warningSettings.maxWarnings}`, inline: true },
                { name: 'Warning Expiration', value: `${client.config.moderationSystem.warningSettings.warningExpirationDays} days`, inline: true }
            );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder('Select a reason for the warning')
            .addOptions(
                client.config.warnings.reasons.map(reason => ({
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

    } catch (error) {
        console.error('Error in warn command execution:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        }
    }
}



module.exports = {
    data,
    contextMenu: [userContextMenu, messageContextMenu],
    execute
};