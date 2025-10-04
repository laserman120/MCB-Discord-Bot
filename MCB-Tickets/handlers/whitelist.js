const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    /**
     * This function is called immediately after the ticket is created.
     * It sends an ephemeral select menu to ask for the account type.
     */
    async execute(interaction, channel, category) {

        const userId = channel.topic.split('|')[0].trim();

        const accountTypeQuestion = category.handlerQuestions.find(q => q.answerType === 'selectMenu');
        if (!accountTypeQuestion) return;

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('whitelist:set_account_type') // Structured customId
            .setPlaceholder(accountTypeQuestion.placeholder)
            .addOptions(accountTypeQuestion.options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // This interaction is the modal submission, so we can follow up ephemerally.
        await channel.send({
            content: `<@${userId}>  Please select your account type:`,
            components: [row],
        });
    },

    async handleInteraction(interaction, client) {
        const accountType = interaction.values[0];

        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const embedMessage = messages.find(m => m.embeds.length > 0 && m.author.id === client.user.id);

        if (!embedMessage) {
            return interaction.update({ content: 'Could not find the original ticket embed to update.', components: [] });
        }

        const oldEmbed = embedMessage.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed)
            .addFields({ name: 'Account Type', value: accountType, inline: true });

        await embedMessage.edit({ embeds: [newEmbed] });

        await interaction.update({ content: '✅ Your application has been updated with your account type!', components: [] });
    }
};