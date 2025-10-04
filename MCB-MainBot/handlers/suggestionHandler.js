const { EmbedBuilder } = require('discord.js');
const Suggestion = require('../models/Suggestion');

async function handleSuggestionSubmit(interaction, client, config) {
    try {
        const title = interaction.fields.getTextInputValue('suggestion-title');
        const content = interaction.fields.getTextInputValue('suggestion-content');

        const channel = await client.channels.fetch(client.config.forums.suggestionForumId);

        // Create the suggestion embed
        const suggestionEmbed = new EmbedBuilder()
            .setColor('#5563ea')
            .setAuthor({
                name: `Suggestion from ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTitle(title)
            .setDescription(content)
            .setTimestamp();

        // Create a new post in the forum channel
        const thread = await channel.threads.create({
            name: title,
            message: {
                content: `<@&${client.config.roles.suggestionRoleId}>`,
                embeds: [suggestionEmbed]
            },
            appliedTags: [client.config.suggestionSystem.tagIds.underReviewId]
        });

        // Get the first message in the new post to add reactions to it
        const suggestionMsg = await thread.fetchStarterMessage();

        // Add reactions from config
        await suggestionMsg.react(client.config.suggestion.upvoteEmoji);
        await suggestionMsg.react(client.config.suggestion.downvoteEmoji);

        // Save to database
        const suggestion = new Suggestion({
            messageId: suggestionMsg.id,
            userId: interaction.user.id,
            guildId: interaction.guild.id,
            title: title,
            content: content,
            status: 'pending',
            threadId: thread.id // The thread IS the post
        });
        await suggestion.save();

        // Reply to the user with a link to their new post
        await interaction.reply({
            content: `Your suggestion has been posted successfully! You can view it here: ${thread.url}`,
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