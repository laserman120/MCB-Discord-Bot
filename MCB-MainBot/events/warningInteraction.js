const { Events, EmbedBuilder } = require('discord.js');
const Warning = require('../models/Warning');

const WARNINGS_THREAD_ID = '1346039399107919923';

async function getWarningsThread(guild) {
    try {
        const thread = await guild.channels.fetch(WARNINGS_THREAD_ID);
        if (!thread) {
            throw new Error('Warnings thread not found');
        }
        return thread;
    } catch (error) {
        console.error('Error fetching warnings thread:', error);
        return null;
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        // Only handle select menu interactions for warnings
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith('warn_reason_')) return;

        try {
            await interaction.deferUpdate();

            const [, , targetId, messageId] = interaction.customId.split('_');
            const reason = interaction.values[0];
            const target = await interaction.client.users.fetch(targetId);
            
            if (!target) {
                return interaction.editReply('User not found!');
            }

            // Calculate warning expiry time
            const expiryTime = new Date();
            expiryTime.setSeconds(expiryTime.getSeconds() + config.moderation.warning_expiry);

            // Create the warning
            const warning = new Warning({
                userId: target.id,
                guildId: interaction.guild.id,
                moderatorId: interaction.user.id,
                reason: reason,
                expires: expiryTime
            });

            await warning.save();

            // Get total active warnings
            const activeWarnings = await Warning.countDocuments({
                userId: target.id,
                guildId: interaction.guild.id,
                expires: { $gt: new Date() }
            });

            // Create warning embed
            const warningEmbed = new EmbedBuilder()
                .setColor(config.embeds.deniedEmbed)
                .setTitle('⚠️ Warning Issued')
                .setDescription(`${target} has been warned`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: interaction.user.tag },
                    { name: 'Active Warnings', value: `${activeWarnings}/${config.moderation.max_warnings}` },
                    { name: 'Expires', value: `<t:${Math.floor(expiryTime.getTime() / 1000)}:R>` }
                )
                .setTimestamp();

            // Send warning confirmation
            await interaction.editReply({
                embeds: [warningEmbed],
                components: []
            });

            // DM the warned user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.embeds.deniedEmbed)
                    .setTitle(`⚠️ Warning in ${interaction.guild.name}`)
                    .setDescription(config.messages.warning_issued
                        .replace('{reason}', reason)
                        .replace('{count}', activeWarnings)
                        .replace('{max}', config.moderation.max_warnings))
                    .addFields(
                        { name: 'Warned By', value: interaction.user.tag },
                        { name: 'Expires', value: `<t:${Math.floor(expiryTime.getTime() / 1000)}:R>` }
                    )
                    .setTimestamp();

                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM user ${target.tag}`);
            }

            // Log the warning to the warnings thread
            if (config.logging.warningIssued && config.logging.threads?.warnings) {
                try {
                    const warningsThread = await interaction.guild.channels.fetch(config.logging.threads.warnings);
                    if (warningsThread) {
                        await warningsThread.send({ embeds: [warningEmbed] });
                    }
                } catch (error) {
                    console.error('Error sending to warnings thread:', error);
                }
            }

            // Check if user should be muted
            if (activeWarnings >= config.moderation.max_warnings) {
                try {
                    const member = await interaction.guild.members.fetch(target.id);
                    const mutedRole = await interaction.guild.roles.fetch(config.moderation.muted_role_id);
                    
                    if (mutedRole) {
                        await member.roles.add(mutedRole);
                        
                        // Send mute notification
                        const muteEmbed = new EmbedBuilder()
                            .setColor(config.embeds.deniedEmbed)
                            .setTitle('🔇 User Muted')
                            .setDescription(`${target} has been muted for reaching ${config.moderation.max_warnings} warnings.`)
                            .setTimestamp();

                        // Log the mute to the warnings thread
                        if (config.logging.warningIssued && config.logging.threads?.warnings) {
                            try {
                                const warningsThread = await interaction.guild.channels.fetch(config.logging.threads.warnings);
                                if (warningsThread) {
                                    await warningsThread.send({ embeds: [muteEmbed] });
                                }
                            } catch (error) {
                                console.error('Error sending to warnings thread:', error);
                            }
                        }

                        // DM the user about the mute
                        try {
                            const muteDmEmbed = new EmbedBuilder()
                                .setColor(config.embeds.deniedEmbed)
                                .setTitle(`🔇 Muted in ${interaction.guild.name}`)
                                .setDescription(config.messages.muted.replace('{max}', config.moderation.max_warnings))
                                .setTimestamp();

                            await target.send({ embeds: [muteDmEmbed] });
                        } catch (error) {
                            console.log(`Could not DM user ${target.tag} about mute`);
                        }
                    }
                } catch (error) {
                    console.error('Error applying mute:', error);
                }
            }

        } catch (error) {
            console.error('Error in warning interaction:', error);
            await interaction.editReply({
                content: 'There was an error processing the warning.',
                components: []
            });
        }
    }
}; 