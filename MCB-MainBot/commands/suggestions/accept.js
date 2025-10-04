// commands/suggestions/accept.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Suggestion = require('../../models/Suggestion');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('accept')
        .setDescription('Accept a suggestion')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for accepting the suggestion')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client) {
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
            const originalMessage = await interaction.channel.fetchStarterMessage();
            const originalEmbed = originalMessage.embeds[0];

            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setColor(client.config.embeds.acceptedEmbed)
                .addFields({ 
                    name: 'Status', 
                    value: `✅ Accepted by ${interaction.member.toString()}\nReason: ${reason}` 
                });

            await originalMessage.edit({ embeds: [updatedEmbed] });

            // DM the suggester
            const suggester = await client.users.fetch(suggestion.userId);
            const dmEmbed = new EmbedBuilder()
                .setColor(client.config.embeds.acceptedEmbed)
                .setTitle('Suggestion Accepted!')
                .setDescription(`Your suggestion has been accepted!`)
                .addFields(
                    { name: 'Suggestion', value: suggestion.content },
                    { name: 'Accepted By', value: interaction.member.toString() },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await suggester.send({ embeds: [dmEmbed] }).catch(() => {
                console.log(`Could not DM user ${suggester.tag}`);
            });

            // Send success message first
            await interaction.editReply({
                content: 'Suggestion accepted successfully!',
                ephemeral: true
            });

            const acceptedTagId = client.config.suggestionSystem.tagIds.suggestionAcceptedId;
            if (acceptedTagId && interaction.channel.parent.availableTags.some(t => t.id === acceptedTagId)) {
                await interaction.channel.setAppliedTags([acceptedTagId]);
            }

            // Lock and archive the thread last
            if (!interaction.channel.archived) {
                await interaction.channel.setLocked(true);
                await interaction.channel.setArchived(true);
            }

        } catch (error) {
            console.error('Error in accept command:', error);
            await interaction.editReply({
                content: 'There was an error while accepting the suggestion.',
                ephemeral: true
            });
        }
    },
};