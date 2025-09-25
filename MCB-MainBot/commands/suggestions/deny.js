// commands/suggestions/deny.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Suggestion = require('../../models/Suggestion');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deny')
        .setDescription('Deny a suggestion')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for denying the suggestion')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client, config) {
        // Defer the reply immediately
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.channel.isThread()) {
            return interaction.editReply({
                content: 'This command can only be used in suggestion threads!',
                ephemeral: true
            });
        }

        try {
            const suggestion = await Suggestion.findOne({
                threadId: interaction.channel.id
            });

            if (!suggestion) {
                return interaction.editReply({
                    content: 'Could not find associated suggestion!',
                    ephemeral: true
                });
            }

            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Get the original message and update its embed
            const suggestionChannel = await client.channels.fetch(config.suggestion.suggestionID);
            const originalMessage = await suggestionChannel.messages.fetch(suggestion.messageId);
            const originalEmbed = originalMessage.embeds[0];

            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setColor(config.embeds.deniedEmbed)
                .addFields({ 
                    name: 'Status', 
                    value: `❌ Denied by ${interaction.member.toString()}\nReason: ${reason}` 
                });

            await originalMessage.edit({ embeds: [updatedEmbed] });

            // DM the suggester
            const suggester = await client.users.fetch(suggestion.userId);
            const dmEmbed = new EmbedBuilder()
                .setColor(config.embeds.deniedEmbed)
                .setTitle('Suggestion Denied')
                .setDescription(`Your suggestion has been denied.`)
                .addFields(
                    { name: 'Suggestion', value: suggestion.content },
                    { name: 'Denied By', value: interaction.member.toString() },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await suggester.send({ embeds: [dmEmbed] }).catch(() => {
                console.log(`Could not DM user ${suggester.tag}`);
            });

            // Send success message first
            await interaction.editReply({
                content: 'Suggestion denied successfully!',
                ephemeral: true
            });

            // Lock and archive the thread last
            if (!interaction.channel.archived) {
                await interaction.channel.setLocked(true);
                await interaction.channel.setArchived(true);
            }

        } catch (error) {
            console.error('Error in deny command:', error);
            await interaction.editReply({
                content: 'There was an error while denying the suggestion.',
                ephemeral: true
            });
        }
    },
};