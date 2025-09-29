const { Events, EmbedBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalBuilder, PermissionsBitField } = require('discord.js');
const { handleSuggestionSubmit } = require('../handlers/suggestionHandler');
const { handleIntroButton, handleIntroSubmit } = require('../handlers/introductionHandler');
const { handleRoleButton } = require('../handlers/roleButtonHandler');

const roleIds = {
    'role-announcements': '1338557091907899422',
    'role-changelog': '1302465289879031859',
    'role-suggestions': '1302465291816800318'
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        try {
            // Log all interactions for debugging
            console.log(`[Interaction] Type: ${interaction.type}, User: ${interaction.user.tag}`);
            if (interaction.isButton()) {
                console.log(`[Button Interaction] CustomId: ${interaction.customId}`);
            }

            // Handle introduction button
            if (interaction.isButton() && interaction.customId === 'create_intro') {
                console.log('Introduction button clicked by:', interaction.user.tag);
                await handleIntroButton(interaction, client, client.config);
                return;
            }

            // Handle introduction modal submit
            if (interaction.isModalSubmit() && interaction.customId === 'intro_modal') {
                console.log('Introduction modal submitted by:', interaction.user.tag);
                await handleIntroSubmit(interaction, client, client.config);
                return;
            }

            // Handle suggestion modal submit
            if (interaction.isModalSubmit() && interaction.customId === 'suggestion-modal') {
                await handleSuggestionSubmit(interaction, client, client.config);
                return;
            }

            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction, client, client.config);
                } catch (error) {
                    console.error('Error executing command:', error);
                    const reply = {
                        content: 'There was an error executing this command.',
                        ephemeral: true
                    };
                    
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply);
                    } else {
                        await interaction.reply(reply);
                    }
                }
                return;
            }

            // Handle buttons
            if (interaction.isButton()) {
                // Try to handle role button
                const handled = await handleRoleButton(interaction, client, config);
                if (handled) return;

                // Handle DM user button from advertisements
                if (interaction.customId.startsWith('dm_user_')) {
                    const targetUserId = interaction.customId.split('_')[2];
                    try {
                        const targetUser = await client.users.fetch(targetUserId);
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
                    return;
                }

                // Handle report ad button
                if (interaction.customId.startsWith('report_ad_')) {
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
                    return;
                }
            }

            // Handle modals
            else if (interaction.isModalSubmit()) {
                // Handle report modal
                if (interaction.customId.startsWith('report_modal_')) {
                    const targetUserId = interaction.customId.split('_')[2];
                    const reason = interaction.fields.getTextInputValue('report-reason');

                    try {
                        const modChannel = await interaction.guild.channels.fetch(client.config.channels.loggingChannel);
                        if (modChannel) {
                            await modChannel.send({
                                embeds: [{
                                    color: parseInt(client.config.embeds.deniedEmbed.replace('#', ''), 16),
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
                    return;
                }
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            if (interaction.isRepliable() && !interaction.replied) {
                await interaction.reply({
                    content: 'There was an error processing your request.',
                    ephemeral: true
                });
            }
        }
    }
};