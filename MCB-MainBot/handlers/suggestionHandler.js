const { EmbedBuilder } = require('discord.js');
const Suggestion = require('../models/Suggestion');

async function handleSuggestionSubmit(interaction, client, config) {
    try {
        const title = interaction.fields.getTextInputValue('suggestion-title');
        const content = interaction.fields.getTextInputValue('suggestion-content');

        // Get the suggestions channel
        const channel = await interaction.guild.channels.fetch(config.suggestion.suggestionID);
        if (!channel) {
            return await interaction.reply({
                content: 'Suggestion channel not found!',
                ephemeral: true
            });
        }

        // Create the suggestion embed
        const suggestionEmbed = new EmbedBuilder()
            .setColor('#5563ea')
            .setAuthor({
                name: 'New Suggestion',
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTitle(title)
            .setDescription(content)
            .setFooter({ text: `Suggestion by ${interaction.user.tag}` })
            .setTimestamp();

        // Send the embed with role ping and create a thread
        const suggestionMsg = await channel.send({ 
            content: `<@&${config.suggestion.suggestionRole}>`,
            embeds: [suggestionEmbed] 
        });
        
        // Create thread for discussion
        const thread = await suggestionMsg.startThread({
            name: `Discussion: ${title.substring(0, 50)}`,
            autoArchiveDuration: 1440 // 24 hours
        });

        // Add reactions from config
        await suggestionMsg.react(config.suggestion.upvoteEmoji);
        await suggestionMsg.react(config.suggestion.downvoteEmoji);

        // Save to database
        const suggestion = new Suggestion({
            messageId: suggestionMsg.id,
            userId: interaction.user.id,
            guildId: interaction.guild.id,
            title: title,
            content: content,
            status: 'pending',
            upvotes: 0,
            downvotes: 0,
            threadId: thread.id
        });

        await suggestion.save();

        // Reply to the user
        await interaction.reply({
            content: 'Your suggestion has been submitted successfully!',
            ephemeral: true
        });

    } catch (error) {
        console.error('Error handling suggestion:', error);
        await interaction.reply({
            content: 'There was an error submitting your suggestion.',
            ephemeral: true
        });
    }
}

module.exports = { handleSuggestionSubmit };