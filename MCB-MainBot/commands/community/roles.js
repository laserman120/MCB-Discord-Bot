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

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const roleConfigs = client.config.roles.rolesSelector;

            if (!roleConfigs || !Array.isArray(roleConfigs) || roleConfigs.length === 0) {
                return interaction.editReply({ content: 'No roles are configured for the selection panel.' });
            }

            const embed = new EmbedBuilder()
                .setColor(client.config?.embeds?.mainColor || '#2B2D31')
                .setTitle('Role Selection')
                .setDescription('Click the buttons below to get or remove roles!');

            // Dynamically create embed fields from the config
            roleConfigs.forEach(role => {
                embed.addFields({
                    name: `${role.emoji} ${role.label}`,
                    value: role.description,
                    inline: false
                });
            });

            const buttons = new ActionRowBuilder();

            // Dynamically create buttons from the config
            roleConfigs.forEach(role => {
                buttons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`role_${role.id}`) // e.g., role_announcements
                        .setLabel(role.label)
                        .setEmoji(role.emoji)
                        .setStyle(ButtonStyle.Secondary)
                );
            });

            await interaction.channel.send({
                embeds: [embed],
                components: [buttons]
            });

            await interaction.editReply({
                content: 'Role selection panel has been created!'
            });

        } catch (error) {
            console.error('Error in roles command:', error);
        }
    },
};