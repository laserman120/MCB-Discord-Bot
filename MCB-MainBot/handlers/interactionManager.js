const {
    EmbedBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalBuilder
} = require('discord.js');

const { handleSuggestionSubmit } = require('./suggestionHandler');
const { handleIntroButton, handleIntroSubmit } = require('./introductionHandler');
const { handleRoleButton } = require('./roleButtonHandler');
const adModalSubmit = require('./adModalSubmit');

class InteractionManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    // This is now the core router for components ONLY
    async handleInteraction(interaction, client) {
        try {
            if (interaction.isButton()) {
                return await this.handleButtonInteraction(interaction);
            } else if (interaction.isModalSubmit()) {
                return await this.handleModalSubmit(interaction);
            }
        } catch (error) {
            console.error('Error handling component interaction:', error);
            await this.sendErrorResponse(interaction);
        }

        // If the interaction is not a component this manager handles, signal it
        return false;
    }

    async handleButtonInteraction(interaction) {
        // Handle introduction button
        if (interaction.customId === 'create_intro') {
            await handleIntroButton(interaction, this.client, this.config);
            return true;
        }

        // Handle role buttons
        if (await handleRoleButton(interaction, this.client, this.config)) {
            return true;
        }

        // Handle DM user button
        if (interaction.customId.startsWith('dm_user_')) {
            await this.handleDMUserButton(interaction);
            return true;
        }

        // Handle report ad button
        if (interaction.customId.startsWith('report_ad_')) {
            await this.handleReportAdButton(interaction);
            return true;
        }

        return false; // This button isn't for us
    }

    async handleModalSubmit(interaction) {
        if (interaction.customId === 'intro_modal') {
            await handleIntroSubmit(interaction, this.client, this.config);
            return true;
        }
        if (interaction.customId === 'suggestion-modal') {
            await handleSuggestionSubmit(interaction, this.client, this.config);
            return true;
        }
        if (interaction.customId === 'ad-modal') {
            await adModalSubmit.execute(interaction, this.client, this.config);
            return true;
        }
        if (interaction.customId.startsWith('report_modal_')) {
            await this.handleReportModal(interaction);
            return true;
        }
        if (interaction.customId === 'embed-modal') {
            await this.handleEmbedModal(interaction);
            return true;
        }

        return false; // This modal isn't for us
    }

    // Helper methods for specific interactions
    async handleDMUserButton(interaction) {
        const targetUserId = interaction.customId.split('_')[2];
        try {
            const targetUser = await this.client.users.fetch(targetUserId);
            await interaction.reply({
                content: `Click their name to DM them <@${targetUserId}> or add them as a friend (${targetUser.tag})`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error handling DM button:', error);
            await interaction.reply({
                content: 'There was an error fetching the user information.',
                ephemeral: true
            });
        }
    }

    async handleReportAdButton(interaction) {
        const targetUserId = interaction.customId.split('_')[2];
        const modal = new ModalBuilder()
            .setCustomId(`report_modal_${targetUserId}`)
            .setTitle('Report Advertisement');

        const reasonInput = new TextInputBuilder()
            .setCustomId('report-reason')
            .setLabel('Reason for Report')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Please explain why you are reporting this advertisement');

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }

    async handleReportModal(interaction) {
        const targetUserId = interaction.customId.split('_')[2];
        const reason = interaction.fields.getTextInputValue('report-reason');

        try {
            const modChannel = await interaction.guild.channels.fetch(this.config.channels.loggingChannel);
            if (modChannel) {
                await modChannel.send({
                    embeds: [{
                        color: parseInt(this.config.embeds.deniedEmbed.replace('#', ''), 16),
                        title: '🚨 Advertisement Reported',
                        fields: [
                            {
                                name: 'Reported User',
                                value: `<@${targetUserId}>`,
                                inline: true
                            },
                            {
                                name: 'Reported By',
                                value: interaction.user.toString(),
                                inline: true
                            },
                            {
                                name: 'Reason',
                                value: reason
                            }
                        ],
                        timestamp: new Date()
                    }]
                });
            }

            await interaction.reply({
                content: 'Report submitted successfully. Our moderators will review it.',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error handling report:', error);
            await interaction.reply({
                content: 'There was an error submitting your report.',
                ephemeral: true
            });
        }
    }

    async handleEmbedModal(interaction) {
        const color = interaction.fields.getTextInputValue('embed-color');
        const title = interaction.fields.getTextInputValue('embed-title');
        const content = interaction.fields.getTextInputValue('embed-content');

        // Validate hex color code
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!hexColorRegex.test(color)) {
            return interaction.reply({
                content: 'Please provide a valid hex color code (e.g., #ff0000)',
                ephemeral: true
            });
        }

        try {
            const customEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(content)
                .setTimestamp();

            const sentEmbed = await interaction.channel.send({
                embeds: [customEmbed]
            });

            // Create log embed
            if (this.config.channels.loggingChannel) {
                const logChannel = await interaction.guild.channels.fetch(this.config.channels.loggingChannel);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(this.config.embeds.mainColor)
                        .setTitle('Custom Embed Created')
                        .addFields({
                            name: 'Created By',
                            value: interaction.user.toString(),
                            inline: true
                        }, {
                            name: 'Channel',
                            value: interaction.channel.toString(),
                            inline: true
                        }, {
                            name: 'Message Link',
                            value: `[Jump to Message](${sentEmbed.url})`,
                            inline: true
                        })
                        .setTimestamp();

                    await logChannel.send({
                        embeds: [logEmbed]
                    });
                }
            }

            await interaction.reply({
                content: 'Embed created successfully!',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error handling embed modal:', error);
            await interaction.reply({
                content: 'There was an error creating the embed.',
                ephemeral: true
            });
        }
    }

    async sendErrorResponse(interaction) {
        const errorResponse = {
            content: 'There was an error processing your request.',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorResponse);
        } else {
            await interaction.reply(errorResponse);
        }
    }
}

module.exports = InteractionManager; 