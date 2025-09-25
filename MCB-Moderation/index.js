const { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { connect } = require('./utils/database');
const { handleHoistedName } = require('./utils/antiHoist');
const { handleBlockedLink } = require('./utils/antiLink');
const { handleWarning } = require('./utils/warningHandler');

function initialize(client, config) {
    process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
    process.on('uncaughtException', error => console.error('Uncaught exception:', error));


    console.log('Moderation-Bot module initialized');
}

async function handleInteraction(interaction, client) {
    // --- String Select Menu Interactions ---
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ban_reason') {
            const banCommand = client.commands.get('ban');
            if (banCommand && banCommand.handleBan && interaction.message?.embeds[0]?.description) {
                const match = interaction.message.embeds[0].description.match(/<@!?(\d+)>/);
                if (match && match[1]) {
                    const targetUser = { id: match[1] }; // Create a user-like object
                    await banCommand.handleBan(interaction, targetUser, interaction.values[0]);
                }
            }
            return true; // Signal that the interaction was handled
        }

        if (interaction.customId === 'mute_reason') {
            const muteCommand = client.commands.get('mute');
            if (muteCommand && muteCommand.handleMute && interaction.message?.embeds[0]?.description) {
                const match = interaction.message.embeds[0].description.match(/\((\d+)\)/);
                if (match && match[1]) {
                    const targetUser = await client.users.fetch(match[1]);
                    const durationField = interaction.message.embeds[0].fields.find(f => f.name === 'Duration');
                    // Ensure durationField exists before trying to parse
                    if (durationField) {
                        const duration = parseInt(durationField.value);
                        await muteCommand.handleMute(interaction, client, targetUser, interaction.values[0], duration);
                    }
                }
            }
            return true; // Signal that the interaction was handled
        }
    }

    // --- Select Menu Handler for Warnings ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('warn_reason_')) {
        const targetUserId = interaction.customId.split('_')[2];
        const targetUser = await client.users.fetch(targetUserId);
        const selectedValue = interaction.values[0];

        if (selectedValue === 'Other') {
            // Logic to show the modal
            const modal = new ModalBuilder()
                .setCustomId(`warn_custom_reason_${targetUserId}`) // Pass the ID to the modal
                .setTitle('Custom Warning Reason');

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Please specify the reason')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
            return true; // We've handled this
        } else {
            // Handle a predefined reason
            const reason = client.config.warnings.reasons.find(r => r.title === selectedValue);
            await handleWarning(interaction, client, targetUser, reason);
            return true; // We've handled this
        }
    }

    // --- Modal Submit Interactions ---
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('warn_custom_reason_')) {
            try {
                const targetUserId = interaction.customId.split('_')[3];
                const targetUser = await client.users.fetch(targetUserId);

                const customReason = {
                    title: interaction.fields.getTextInputValue('reason'),
                    description: '', // Custom reasons have no description
                    emoji: '❓'
                };

                await handleWarning(interaction, client, targetUser, customReason);
                return true; // We've handled this
            } catch (error) {
                console.error('Error handling custom warning modal:', error);
                await interaction.reply({ content: 'There was an error processing your custom warning. Please try again.', ephemeral: true });
            }
            return true; // Signal that the interaction was handled
        }

        if (interaction.customId === 'mute_custom_reason') {
            const muteCommand = client.commands.get('mute');
            if (muteCommand && muteCommand.handleModalSubmit) {
                await muteCommand.handleModalSubmit(interaction, client);
            }
            return true; // Signal that the interaction was handled
        }
    }

    // If the interaction customId didn't match anything above, it's not for this module.
    return false;
}

const eventHandlers = {
    guildMemberAdd: async (member, client) => {
        await handleHoistedName(member, client);
    },
    guildMemberUpdate: async (oldMember, newMember, client) => {
        if (oldMember.displayName !== newMember.displayName) {
            await handleHoistedName(newMember, client);
        }
    },
    messageCreate: async (message, client) => {
        if (message.author.bot) return;
        await handleBlockedLink(message, client);
    }
};

module.exports = {
    initialize,
    handleInteraction,
    eventHandlers,
};