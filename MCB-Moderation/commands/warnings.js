const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getUserWarnings, removeWarning } = require('../utils/database');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// Create the slash command
const data = new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View and manage user warnings (Staff only)')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to view warnings for')
            .setRequired(true));

function createWarningEmbed(targetUser, warnings, currentIndex) {
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(`Warnings for ${targetUser.tag}`)
        .setDescription(`Found ${warnings.length} warning(s)`);

    if (warnings.length > 0) {
        const warning = warnings[currentIndex];
        embed.addFields(
            {
                name: `Warning ${currentIndex + 1}:`,
                value: `\`\`\`\n${warning.reason}\n\`\`\``,
                inline: false
            },
            {
                name: 'Warning given by:',
                value: `<@${warning.warnedBy}>`,
                inline: false
            },
            {
                name: 'Warning given date:',
                value: `<t:${Math.floor(warning.timestamp / 1000)}:F>`,
                inline: false
            },
            {
                name: 'Expire date:',
                value: `<t:${Math.floor(warning.expiresAt / 1000)}:F>`,
                inline: false
            }
        );
    }

    return embed;
}

async function execute(interaction, client) {
    const isStaff = interaction.member.roles.cache.has(client.config.roles.staffRoleId);

    // Check if user has staff role
    if (!isStaff) {
        return interaction.reply({
            content: 'You do not have permission to use this command.',
            ephemeral: true
        });
    }

    let targetUser = interaction.options.getUser('user');
    if (!targetUser) {
        return interaction.reply({
            content: 'You must specify a user to view warnings for.',
            ephemeral: true
        });
    }

    const warnings = await getUserWarnings(targetUser.id);

    if (warnings.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`Warnings for ${targetUser.tag}`)
            .setDescription('No active warnings! 🎉');

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    let currentIndex = 0;

    // Create navigation buttons
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('remove')
            .setLabel('Remove')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(warnings.length <= 1)
    );

    const embed = createWarningEmbed(targetUser, warnings, currentIndex);
    const message = await interaction.reply({ 
        embeds: [embed], 
        components: [buttons],
        ephemeral: true 
    });

    if (warnings.length === 0) return;

    // Create button collector
    const collector = message.createMessageComponentCollector({ 
        time: 5 * 60 * 1000 // 5 minutes
    });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ 
                content: 'You cannot use these buttons.', 
                ephemeral: true 
            });
        }

        if (i.customId === 'remove') {
            try {
                // Get the warning to be removed
                const warningToRemove = warnings[currentIndex];
                
                // Remove the warning from the database
                await removeWarning(warningToRemove._id.toString());

                // Create and send log embed
                const logEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Warning Removed')
                    .addFields(
                        { name: 'Warning removed from:', value: `<@${targetUser.id}> (${targetUser.username})` },
                        { name: 'Removed by:', value: `<@${interaction.user.id}>` },
                        { name: 'Original Warning', value: `\`\`\`\n${warningToRemove.reason}\n\`\`\`` },
                        { name: 'Warning was given by', value: `<@${warningToRemove.warnedBy}>` },
                        { name: 'Warning was given on', value: `<t:${Math.floor(warningToRemove.timestamp / 1000)}:F>` }
                    )
                    .setTimestamp();

                // Send to warning log thread
                const logThread = await interaction.guild.channels.fetch(client.config.threads.warningsLogThreadId.toString());
                if (logThread && logThread.isThread()) {
                    await logThread.send({ embeds: [logEmbed] });
                }
                
                // Remove the warning from our local array
                warnings.splice(currentIndex, 1);
                
                // If no warnings left, update the embed to show no warnings
                if (warnings.length === 0) {
                    const noWarningsEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle(`Warnings for ${targetUser.tag}`)
                        .setDescription('No active warnings! 🎉');

                    await i.update({ 
                        embeds: [noWarningsEmbed], 
                        components: [] 
                    });
                    return;
                }

                // Adjust currentIndex if we removed the last warning in the list
                if (currentIndex >= warnings.length) {
                    currentIndex = warnings.length - 1;
                }

                // Update button states
                const row = ActionRowBuilder.from(i.message.components[0]);
                row.components[0].setDisabled(warnings.length <= 1);
                row.components[2].setDisabled(warnings.length <= 1);
                row.components[0].setDisabled(currentIndex === 0);
                row.components[2].setDisabled(currentIndex === warnings.length - 1);

                // Update embed
                const newEmbed = createWarningEmbed(targetUser, warnings, currentIndex);
                await i.update({ 
                    embeds: [newEmbed], 
                    components: [row]
                });
            } catch (error) {
                console.error('Error removing warning:', error);
                await i.reply({
                    content: 'There was an error removing the warning.',
                    ephemeral: true
                });
            }
            return;
        }

        if (i.customId === 'prev') {
            currentIndex--;
        } else if (i.customId === 'next') {
            currentIndex++;
        }

        // Update button states
        const row = ActionRowBuilder.from(i.message.components[0]);
        row.components[0].setDisabled(currentIndex === 0 || warnings.length <= 1);
        row.components[2].setDisabled(currentIndex === warnings.length - 1 || warnings.length <= 1);

        // Update embed
        const newEmbed = createWarningEmbed(targetUser, warnings, currentIndex);
        await i.update({ 
            embeds: [newEmbed], 
            components: [row]
        });
    });

    collector.on('end', () => {
        // Remove buttons after timeout
        interaction.editReply({
            components: []
        }).catch(() => {});
    });
}

module.exports = {
    data,
    execute
}; 