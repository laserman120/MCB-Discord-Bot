// handlers/messageReactionAdd.js
const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user, client, config) {
        if (user.bot) return;

        try {
            if (reaction.partial) {
                await reaction.fetch();
            }

            const isReactionRoleMessage = reaction.message.embeds.length > 0 && 
                reaction.message.embeds[0].title === client.config.reactionroles.embed.title;

            if (!isReactionRoleMessage) return;

            console.log('Reaction received:', {
                emoji: reaction.emoji.name,
                messageId: reaction.message.id,
                user: user.tag
            });

            // Remove the user's reaction immediately
            await reaction.users.remove(user);

            const roleConfig = client.config.reactionroles.roles.find(r => r.emoji === reaction.emoji.name);
            
            if (!roleConfig) {
                console.log('No matching role found for emoji:', reaction.emoji.name);
                return;
            }

            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id);
            const role = await guild.roles.fetch(roleConfig.role_id);

            if (!role) {
                console.error('Role not found:', roleConfig.role_id);
                return;
            }

            await member.roles.add(role);
            console.log(`Added role ${role.name} to user ${user.tag}`);

            // Send DM to user
            try {
                await user.send(`✅ Role **${role.name}** has been added to you in ${guild.name}!`);
            } catch (error) {
                console.log(`Could not DM user ${user.tag}`, error);
            }

            // Log the action with proper user mention
            if (client.config.channels.loggingChannel) {
                const logChannel = await guild.channels.fetch(client.config.channels.loggingChannel);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(client.config.embeds.acceptedEmbed)
                        .setTitle('Reaction Role Added')
                        .addFields(
                            { name: 'User', value: `<@${user.id}>`, inline: true },
                            { name: 'Role', value: role.name, inline: true },
                            { name: 'Emoji', value: roleConfig.emoji, inline: true }
                        )
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error('Error in reaction role handling:', error);
        }
    }
};