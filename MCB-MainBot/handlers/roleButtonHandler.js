const { PermissionsBitField } = require('discord.js');

// Role IDs mapping
const roleIds = {
    'role-announcements': '1338557091907899422',
    'role-changelog': '1302465289879031859',
    'role-suggestions': '1302465291816800318'
};

/**
 * Handle role button interactions
 * @param {ButtonInteraction} interaction The button interaction
 * @param {Client} client The Discord client
 * @param {Object} config The bot configuration
 * @returns {Promise<boolean>}
 */
async function handleRoleButton(interaction, client, config) {
    const roleId = roleIds[interaction.customId];
    if (!roleId) {
        console.log(`[Role Button] Not a role button: ${interaction.customId}`);
        return false;
    }

    console.log(`[Role Button] Processing role button: ${interaction.customId}, Role ID: ${roleId}`);

    try {
        // Get member and role
        const member = interaction.member;
        const role = await interaction.guild.roles.fetch(roleId);

        if (!role) {
            await interaction.reply({ 
                content: '❌ Role not found! Please contact an administrator.',
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
                content: `✅ Removed the ${role.name} role!`,
                ephemeral: true
            });
        } else {
            await member.roles.add(role);
            await interaction.reply({
                content: `✅ Added the ${role.name} role!`,
                ephemeral: true
            });
        }

        console.log(`[Role Button] ${hasRole ? 'Removed' : 'Added'} role ${role.name} ${hasRole ? 'from' : 'to'} ${member.user.tag}`);
        return true;

    } catch (error) {
        console.error('[Role Button] Error:', error);
        try {
            await interaction.reply({
                content: '❌ An error occurred while managing your role.',
                ephemeral: true
            });
        } catch (e) {
            console.error('[Role Button] Failed to send error message:', e);
        }
        return true;
    }
}

module.exports = { handleRoleButton, roleIds }; 