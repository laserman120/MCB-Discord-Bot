const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Create a role selection panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client, config) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor(config?.embeds?.mainColor || '#2B2D31')
                .setTitle('Role Selection')
                .setDescription('Click the buttons below to get or remove roles!')
                .addFields(
                    { 
                        name: '✅ Announcements', 
                        value: 'Get pinged for new announcements',
                        inline: false
                    },
                    { 
                        name: '✏️ Changelog', 
                        value: 'Get notified about changelogs',
                        inline: false
                    },
                    { 
                        name: '✨ Suggestions', 
                        value: 'Get pinged for new suggestions',
                        inline: false
                    }
                );

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('role-announcements')
                        .setLabel('Announcements')
                        .setEmoji('✅')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('role-changelog')
                        .setLabel('Changelog')
                        .setEmoji('✏️')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('role-suggestions')
                        .setLabel('Suggestions')
                        .setEmoji('✨')
                        .setStyle(ButtonStyle.Secondary)
                );

            const message = await interaction.channel.send({
                embeds: [embed],
                components: [buttons]
            });

            if (!message) {
                return await interaction.editReply({
                    content: 'Failed to create the role selection panel.',
                });
            }

            await interaction.editReply({
                content: 'Role selection panel has been created!'
            });

        } catch (error) {
            console.error('Error in roles command:', error);
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: 'There was an error creating the role selection panel!'
                    });
                } else {
                    await interaction.reply({
                        content: 'There was an error creating the role selection panel!',
                        ephemeral: true
                    });
                }
            } catch (e) {
                console.error('Error sending error message:', e);
            }
        }
    },
}; 