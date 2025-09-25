const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { 
    getUserNotes, 
    getUserWarnings, 
    getUserReports,
    getUserMutes,
    isUserBanned
} = require('../utils/database');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('View information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view information about')
                .setRequired(true)),

    async execute(interaction, client) {
        // Check if user has staff role
        if (!interaction.member.roles.cache.has(client.config.roles.staffRoleId)) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Permission Denied')
                .setDescription('You do not have permission to use this command.')
                .setTimestamp();

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        // Fetch all user data
        const [notes, warnings, reports, mutes, isBanned] = await Promise.all([
            getUserNotes(user.id),
            getUserWarnings(user.id),
            getUserReports(user.id),
            getUserMutes(user.id),
            isUserBanned(user.id)
        ]);

        // Create main embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`User Information: ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'User ID', value: user.id, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:F>`, inline: true },
                { name: 'Joined Server', value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>` : 'Not in server', inline: true },
                { name: 'Roles', value: member?.roles.cache.map(r => r.toString()).join(' ') || 'None', inline: false }
            )
            .setTimestamp();

        // Add warnings section
        if (warnings.length > 0) {
            embed.addFields({
                name: `Warnings (${warnings.length})`,
                value: warnings.map((w, i) => 
                    `**#${i + 1}** - ${w.reason}\n*By: <@${w.warnedBy}> on <t:${Math.floor(w.timestamp / 1000)}:F>*`
                ).join('\n\n'),
                inline: false
            });
        }

        // Add notes section
        if (notes.length > 0) {
            embed.addFields({
                name: `Notes (${notes.length})`,
                value: notes.map((n, i) => 
                    `**#${i + 1}** - ${n.content}\n*By: <@${n.authorId}> on <t:${Math.floor(n.timestamp.getTime() / 1000)}:F>*`
                ).join('\n\n'),
                inline: false
            });
        }

        // Add reports section
        if (reports.length > 0) {
            embed.addFields({
                name: `Reports (${reports.length})`,
                value: reports.map((r, i) => 
                    `**#${i + 1}** - ${r.type}\n*Status: ${r.status}*\n${r.details}`
                ).join('\n\n'),
                inline: false
            });
        }

        // Add moderation status
        const moderationStatus = [];
        if (isBanned) moderationStatus.push('🔴 Banned');
        if (mutes.length > 0) moderationStatus.push('🟡 Muted');
        if (warnings.length > 0) moderationStatus.push(`⚠️ ${warnings.length} Warning(s)`);

        if (moderationStatus.length > 0) {
            embed.addFields({
                name: 'Moderation Status',
                value: moderationStatus.join('\n'),
                inline: false
            });
        }

        // Add footer with last updated time
        embed.setFooter({ text: 'Last updated' });

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
}; 