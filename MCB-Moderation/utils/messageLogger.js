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
    if (!client.config.logging.messageDeleted) return;

    try {
        const thread = await getLogThread(message.guild, client.config.threads.deletedLogThreadId);
        if (!thread) return;

        // Fetch audit logs to find who deleted the message
        const auditLogs = await message.guild.fetchAuditLogs({
            type: 72, // MESSAGE_DELETE
            limit: 1
        });
        const deletionLog = auditLogs.entries.first();

        const deletedBy = deletionLog?.executor &&
            deletionLog.target?.id === message.author?.id &&
            deletionLog.createdTimestamp > (Date.now() - 5000)
            ? deletionLog.executor
            : message.author;

        const embed = new EmbedBuilder()
            .setTitle('Message Deleted')
            .setColor(client.config.embeds.deniedEmbed)
            .addFields(
                { name: 'Author', value: `${message.author} (${message.author?.tag || 'Unknown'})`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Deleted By', value: `${deletedBy ? `${deletedBy} (${deletedBy.tag})` : 'Unknown'}`, inline: true },
                { name: 'Sent At', value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'Deleted At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        // Check if content is short enough for one embed field
        if (message.content && message.content.length <= 1024) {
            embed.addFields({ name: 'Content', value: message.content });
        } else if (message.content) {
            embed.addFields({ name: 'Content', value: '*Content is too long and is sent below.*' });
        } else {
            embed.addFields({ name: 'Content', value: '*No text content*' });
        }

        // Add attachment info
        if (message.attachments.size > 0) {
            const attachmentList = message.attachments.map(a => `• ${a.name} (${Math.round(a.size / 1024)} KB)`).join('\n');
            embed.addFields({ name: 'Attachments', value: attachmentList });
        }

        // Send the main embed
        await thread.send({ embeds: [embed] });

        // If the content was too long, split and send it now
        if (message.content && message.content.length > 1024) {
            const contentChunks = splitContent(message.content);
            for (const chunk of contentChunks) {
                await thread.send({ content: `\`\`\`\n${chunk}\n\`\`\`` });
            }
        }

    } catch (error) {
        console.error('Error in message delete logging:', error);
    }
}

async function handleMessageEdit(oldMessage, newMessage, client, config) {
    if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
    if (!client.config.logging.messageEdited) return;

    try {
        const thread = await getLogThread(newMessage.guild, client.config.threads.editedLogThreadId);
        if (!thread) return;

        const oldContent = oldMessage.content || '*No content*';
        const newContent = newMessage.content || '*No content*';

        const isOldContentLong = oldContent.length > 1012; // 1024 limit minus some buffer for formatting
        const isNewContentLong = newContent.length > 1012;

        const embed = new EmbedBuilder()
            .setTitle('Message Edited')
            .setColor(client.config.embeds.mainColor)
            .addFields(
                { name: 'Author', value: `${newMessage.author} (${newMessage.author.tag})`, inline: true },
                { name: 'Channel', value: `${newMessage.channel}`, inline: true },
                { name: 'Message Link', value: `[Jump to Message](${newMessage.url})`, inline: true },
                { name: 'Sent At', value: `<t:${Math.floor(oldMessage.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'Edited At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        // Handle content based on length
        if (!isOldContentLong && !isNewContentLong) {
            // Both are short, put them in the embed
            embed.addFields(
                { name: 'Before', value: `\`\`\`\n${oldContent}\n\`\`\`` },
                { name: 'After', value: `\`\`\`\n${newContent}\n\`\`\`` }
            );
            await thread.send({ embeds: [embed] });
        } else {
            // One or both are long, send separately
            await thread.send({ embeds: [embed] });

            // Send "Before" content
            await thread.send({ content: `**Before:**` });
            const oldChunks = splitContent(oldContent);
            for (const chunk of oldChunks) {
                await thread.send({ content: `\`\`\`\n${chunk}\n\`\`\`` });
            }

            // Send "After" content
            await thread.send({ content: `**After:**` });
            const newChunks = splitContent(newContent);
            for (const chunk of newChunks) {
                await thread.send({ content: `\`\`\`\n${chunk}\n\`\`\`` });
            }
        }

    } catch (error) {
        console.error('Error in message edit logging:', error);
    }
}

// A helper function to split long content into message-sized chunks
function splitContent(content, maxLength = 1980) { // 1980 to leave room for code block ticks
    if (content.length <= maxLength) {
        return [content];
    }

    const chunks = [];
    let currentChunk = '';

    const lines = content.split('\n');
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
        currentChunk += line + '\n';
    }
    chunks.push(currentChunk);

    return chunks;
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