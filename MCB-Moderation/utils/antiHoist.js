const fs = require('fs');
const yaml = require('js-yaml');
const { EmbedBuilder } = require('discord.js');
const { addWarning, addHoistLog } = require('./database');
const path = require('path');

// Characters that typically cause hoisting
const HOIST_CHARS = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+', '[', ']', '{', '}', '\\', '|', ';', ':', '"', "'", '<', '>', ',', '.', '?', '/', '`', '~'];

function isHoistedName(name) {
    return HOIST_CHARS.includes(name.charAt(0));
}

async function handleHoistedName(member, client) {
    if (!client.config.antiHoist.enabled) return false;

    // Check if member has exempt role
    const hasExemptRole = member.roles.cache.some(role => 
        client.config.antiHoist.exemptRoles.includes(role.id)
    );
    if (hasExemptRole) return false;

    const currentName = member.displayName;
    if (!isHoistedName(currentName)) return false;

    // Create new name with prefix
    const newName = client.config.antiHoist.prefix + currentName;

    try {
        // Change nickname
        await member.setNickname(newName);

        // Create log embed
        const logEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('Name Hoisting Detected')
            .setDescription(`User ${member.user.tag} (${member.id}) had their name modified`)
            .addFields(
                { name: 'Original Name', value: currentName },
                { name: 'New Name', value: newName },
                { name: 'Modified by', value: 'Anti-Hoist System' },
                { name: 'Timestamp', value: new Date().toISOString() }
            );

        // Send to log thread
        const logThread = await member.guild.channels.fetch(client.config.threads.antiHoistLogThreadId);
        await logThread.send({ embeds: [logEmbed] });

        // Store hoist log in database
        await addHoistLog(member.id, currentName, newName, Date.now());

        // Take action based on configuration
        if (client.config.antiHoist.action === 'warn') {
            // Add warning to database
            await addWarning(
                member.id,
                'Name Hoisting',
                'Anti-Hoist System',
                Date.now()
            );

            // Send warning DM to user
            try {
                const warningEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⚠️ Warning Received')
                    .setDescription(`You have received a warning in ${member.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: 'Name Hoisting - Your name was modified to prevent hoisting' },
                        { name: 'Original Name', value: currentName },
                        { name: 'New Name', value: newName },
                        { name: 'Warning Expiration', value: `${client.config.warnings.warningExpirationDays} days` }
                    )
                    .setTimestamp();

                await member.user.send({ embeds: [warningEmbed] });
            } catch (dmError) {
                console.error('Could not send warning DM:', dmError);
            }
        } else if (client.config.antiHoist.action === 'mute') {
            const muteRole = member.guild.roles.cache.get(client.config.mute.roleId);
            if (muteRole) {
                await member.roles.add(muteRole);
                // Set timeout to remove mute role after default duration
                setTimeout(async () => {
                    try {
                        await member.roles.remove(muteRole);
                    } catch (error) {
                        console.error('Error removing mute role:', error);
                    }
                }, client.config.mute.defaultDuration * 60 * 60 * 1000);

                // Send mute DM to user
                try {
                    const muteEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🔇 You have been muted')
                        .setDescription(`You have been muted in ${member.guild.name}`)
                        .addFields(
                            { name: 'Reason', value: 'Name Hoisting - Your name was modified to prevent hoisting' },
                            { name: 'Original Name', value: currentName },
                            { name: 'New Name', value: newName },
                            { name: 'Duration', value: `${client.config.mute.defaultDuration} hours` }
                        )
                        .setTimestamp();

                    await member.user.send({ embeds: [muteEmbed] });
                } catch (dmError) {
                    console.error('Could not send mute DM:', dmError);
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Error handling hoisted name:', error);
        return false;
    }
}

module.exports = {
    isHoistedName,
    handleHoistedName
}; 