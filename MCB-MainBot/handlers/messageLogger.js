const { EmbedBuilder } = require('discord.js');

async function getLogThread(guild, threadId) {
    try {
        // Get the logging channel
        const logChannel = await guild.channels.fetch(threadId);
        if (!logChannel) {
            throw new Error(`Thread ${threadId} not found`);
        }
        return logChannel;
    } catch (error) {
        console.error(`Error fetching thread ${threadId}:`, error);
        return null;
    }
}

async function handleMessageDelete(message, client, config) {
    // Ignore DMs and bot messages
    if (!message.guild || message.author?.bot) return;

    // Check if logging is enabled
    if (!config.logging.messageDeleted) return;

    try {
        const thread = await getLogThread(message.guild, config.logging.threads.deleted);
        if (!thread) return;

        // Try to get audit logs to find who deleted the message
        const auditLogs = await message.guild.fetchAuditLogs({
            type: 72, // MESSAGE_DELETE 
            limit: 1
        });
        const deletionLog = auditLogs.entries.first();
        
        // Determine if it was deleted by a moderator or the author
        const deletedBy = deletionLog?.executor && 
            deletionLog.target?.id === message.author?.id && 
            deletionLog.createdTimestamp > (Date.now() - 5000)
            ? deletionLog.executor
            : message.author;

        const embed = new EmbedBuilder()
            .setTitle('Message Deleted')
            .setColor(config.embeds.deniedEmbed)
            .addFields(
                { 
                    name: 'Author', 
                    value: `${message.author} (${message.author?.tag || 'Unknown'})`, 
                    inline: true 
                },
                { 
                    name: 'Channel', 
                    value: `${message.channel}`, 
                    inline: true 
                },
                {
                    name: 'Deleted By',
                    value: `${deletedBy ? `${deletedBy} (${deletedBy.tag})` : 'Unknown'}`,
                    inline: true
                },
                { 
                    name: 'Sent At', 
                    value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`, 
                    inline: true 
                },
                { 
                    name: 'Deleted At', 
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
                    inline: true 
                },
                {
                    name: 'Content',
                    value: message.content || '*No text content*'
                }
            )
            .setTimestamp();

        // Add attachment info if present
        if (message.attachments.size > 0) {
            const attachmentList = message.attachments.map(a => 
                `• ${a.name} (${Math.round(a.size / 1024)} KB)`
            ).join('\n');
            
            embed.addFields({
                name: 'Attachments',
                value: attachmentList
            });
        }

        await thread.send({ embeds: [embed] });

    } catch (error) {
        console.error('Error in message delete logging:', error);
    }
}

async function handleMessageEdit(oldMessage, newMessage, client, config) {
    // Ignore DMs, bot messages, and empty/unchanged messages
    if (!newMessage.guild || 
        newMessage.author?.bot || 
        oldMessage.content === newMessage.content) return;

    // Check if logging is enabled
    if (!config.logging.messageEdited) return;

    try {
        const thread = await getLogThread(newMessage.guild, config.logging.threads.edited);
        if (!thread) return;

        const embed = new EmbedBuilder()
            .setTitle('Message Edited')
            .setColor(config.embeds.mainColor)
            .addFields(
                { 
                    name: 'Author', 
                    value: `${newMessage.author} (${newMessage.author.tag})`, 
                    inline: true 
                },
                { 
                    name: 'Channel', 
                    value: `${newMessage.channel}`, 
                    inline: true 
                },
                {
                    name: 'Message Link',
                    value: `[Jump to Message](${newMessage.url})`,
                    inline: true
                },
                { 
                    name: 'Sent At', 
                    value: `<t:${Math.floor(oldMessage.createdTimestamp / 1000)}:F>`, 
                    inline: true 
                },
                { 
                    name: 'Edited At', 
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
                    inline: true 
                },
                { 
                    name: 'Before', 
                    value: `\`\`\`\n${oldMessage.content || '*No content*'}\n\`\`\``
                },
                { 
                    name: 'After', 
                    value: `\`\`\`\n${newMessage.content || '*No content*'}\n\`\`\``
                }
            )
            .setTimestamp();

        await thread.send({ embeds: [embed] });

    } catch (error) {
        console.error('Error in message edit logging:', error);
    }
}

module.exports = {
    getLogThread,
    execute: async function(event, ...args) {
        const [client, config] = args.slice(-2);
        
        switch(event) {
            case 'messageDelete':
                await handleMessageDelete(args[0], client, config);
                break;
            case 'messageUpdate':
                await handleMessageEdit(args[0], args[1], client, config);
                break;
        }
    }
};