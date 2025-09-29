const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user, client, config) {
        // Don't respond to bot reactions
        if (user.bot) return;

        // Handle partial reactions
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Error fetching reaction:', error);
                return;
            }
        }

        // Get message ID from config if you're tracking specific messages
        if (!client.config.reactionroles.message_ids.includes(reaction.message.id)) {
            return;
        }

        // Handle both custom and unicode emojis
        const emojiIdentifier = reaction.emoji.id ? 
            `<:${reaction.emoji.name}:${reaction.emoji.id}>` : 
            reaction.emoji.name;

        console.log('Reaction removed:', {
            emoji: emojiIdentifier,
            user: user.tag,
            messageId: reaction.message.id
        });

        // Find the matching role configuration
        const roleConfig = client.config.reactionroles.roles.find(r => {
            const configEmoji = r.emoji;
            return configEmoji === emojiIdentifier || configEmoji === reaction.emoji.name;
        });

        if (!roleConfig) {
            console.log('No role config found for emoji:', emojiIdentifier);
            return;
        }

        try {
            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id);
            const role = await guild.roles.fetch(roleConfig.role_id);

            if (!role) {
                console.error('Role not found:', roleConfig.role_id);
                return;
            }

            if (!guild.members.me.permissions.has('ManageRoles')) {
                console.error('Bot missing ManageRoles permission');
                return;
            }

            if (role.position >= guild.members.me.roles.highest.position) {
                console.error('Bot role hierarchy too low to remove this role');
                return;
            }

            await member.roles.remove(role);
            console.log(`Removed role ${role.name} from user ${user.tag}`);

        } catch (error) {
            console.error('Error removing role:', error);
        }
    },
};