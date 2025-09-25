const { Events } = require('discord.js');
const { handleIntroButton, handleIntroSubmit } = require('../handlers/introductionHandler');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        try {
            // Handle introduction button
            if (interaction.isButton() && interaction.customId === 'create_intro') {
                console.log('Introduction button clicked by:', interaction.user.tag);
                await handleIntroButton(interaction, client, config);
                return;
            }

            // Handle introduction modal submit
            if (interaction.isModalSubmit() && interaction.customId === 'intro_modal') {
                console.log('Introduction modal submitted by:', interaction.user.tag);
                await handleIntroSubmit(interaction, client, config);
                return;
            }

        } catch (error) {
            console.error('Error in introduction interaction:', error);
            try {
                const errorResponse = {
                    content: 'There was an error processing your introduction.',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorResponse);
                } else {
                    await interaction.reply(errorResponse);
                }
            } catch (e) {
                console.error('Error sending error message:', e);
            }
        }
    }
};