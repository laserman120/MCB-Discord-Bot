const { PermissionsBitField } = require('discord.js');

async function handleRoleButton(interaction, client, config) {
    // Check if the customId starts with our prefix
    if (!interaction.customId.startsWith('role_')) {
        return false;
    }

    const roleIdKey = interaction.customId.substring(5); // e.g., 'announcements'
    const roleConfig = config.roles.rolesSelector.find(r => r.id === roleIdKey);

    // If no matching role is found in the config, this button is not for us
    if (!roleConfig) {
        return false;
    }

    const roleId = roleConfig.roleId;

    try {
        const member = interaction.member;
        const role = await interaction.guild.roles.fetch(roleId);

        if (!role) {
            await interaction.reply({
                content: '❌ Role not found! It may have been deleted. Please contact an administrator.',
                ephemeral: true
            });
            return true;
        }

        // Check bot permissions
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await interaction.reply({
                content: '❌ I don\'t have permission to manage roles! Please contact an administrator.',
                ephemeral: true
            });
            return true;
        }

        // Check role hierarchy
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            await interaction.reply({
                content: '❌ I can\'t manage this role due to role hierarchy! Please contact an administrator.',
                ephemeral: true
            });
            return true;
        }

        // Toggle role
        const hasRole = member.roles.cache.has(roleId);

        if (hasRole) {
            await member.roles.remove(role);
            await interaction.reply({
                content: `✅ Removed the **${role.name}** role!`,
                ephemeral: true
            });
        } else {
            await member.roles.add(role);
            await interaction.reply({
                content: `✅ Added the **${role.name}** role!`,
                ephemeral: true
            });
        }
        return true;

    } catch (error) {
        console.error('[Role Button] Error:', error);
        // Your existing error handling
        return true;
    }
}

module.exports = { handleRoleButton }; 