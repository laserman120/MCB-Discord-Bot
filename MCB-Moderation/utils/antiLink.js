const fs = require('fs');
const yaml = require('js-yaml');
const { EmbedBuilder } = require('discord.js');
const { addWarning, addLinkLog } = require('./database');
const path = require('path');

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function containsBlockedLink(content) {
    if (!client.config.antiLink.enabled) return false;

    const urls = content.match(URL_REGEX);
    if (!urls) return false;

    return urls.some(url => 
        client.config.antiLink.blockedDomains.some(domain => 
            url.toLowerCase().includes(domain.toLowerCase())
        )
    );
}

async function handleBlockedLink(message, client) {
    if (!client.config.antiLink.enabled) return false;

    // Check if user has exempt role
    const hasExemptRole = message.member.roles.cache.some(role => 
        client.config.antiLink.exemptRoles.includes(role.id)
    );
    if (hasExemptRole) return false;

    // Check if channel is exempt
    if (client.config.antiLink.exemptChannels.includes(message.channel.id)) return false;

    const content = message.content;
    if (!containsBlockedLink(content)) return false;

    try {
        // Delete the message
        await message.delete();

        // Create log embed
        const logEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Blocked Link Detected')
            .setDescription(`User ${message.author.tag} (${message.author.id}) attempted to send a blocked link`)
            .addFields(
                { name: 'Channel', value: `<#${message.channel.id}>` },
                { name: 'Message Content', value: content },
                { name: 'Action Taken', value: 'Message deleted' },
                { name: 'Timestamp', value: new Date().toISOString() }
            );

        // Send to log thread
        const logThread = await message.guild.channels.fetch(client.config.threads.antiLinkLogThreadId);
        await logThread.send({ embeds: [logEmbed] });

        // Store link log in database
        await addLinkLog(message.author.id, message.channel.id, content, Date.now());

        // Take action based on configuration
        if (client.config.antiLink.action === 'warn') {
            // Add warning to database
            await addWarning(
                message.author.id,
                'Unauthorized Link',
                'Anti-Link System',
                Date.now()
            );

            // Send warning DM to user
            try {
                const warningEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⚠️ Warning Received')
                    .setDescription(`You have received a warning in ${message.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: 'Unauthorized Link - Your message was deleted because it contained a blocked link' },
                        { name: 'Channel', value: `<#${message.channel.id}>` },
                        { name: 'Warning Expiration', value: `${client.config.moderationSystem.warningSettings.warningExpirationDays} days` }
                    )
                    .setTimestamp();

                await message.author.send({ embeds: [warningEmbed] });
            } catch (dmError) {
                console.error('Could not send warning DM:', dmError);
            }
        } else if (client.config.antiLink.action === 'mute') {
            const muteRole = message.guild.roles.cache.get(client.config.roles.muteRoleId);
            if (muteRole) {
                await message.member.roles.add(muteRole);
                // Set timeout to remove mute role after default duration
                setTimeout(async () => {
                    try {
                        await message.member.roles.remove(muteRole);
                    } catch (error) {
                        console.error('Error removing mute role:', error);
                    }
                }, client.config.moderationSystem.muteSettings.defaultDuration * 60 * 60 * 1000);

                // Send mute DM to user
                try {
                    const muteEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🔇 You have been muted')
                        .setDescription(`You have been muted in ${message.guild.name}`)
                        .addFields(
                            { name: 'Reason', value: 'Unauthorized Link - Your message was deleted because it contained a blocked link' },
                            { name: 'Channel', value: `<#${message.channel.id}>` },
                            { name: 'Duration', value: `${client.config.moderationSystem.muteSettings.defaultDuration} hours` }
                        )
                        .setTimestamp();

                    await message.author.send({ embeds: [muteEmbed] });
                } catch (dmError) {
                    console.error('Could not send mute DM:', dmError);
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Error handling blocked link:', error);
        return false;
    }
}

module.exports = {
    containsBlockedLink,
    handleBlockedLink
}; 