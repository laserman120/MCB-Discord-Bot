const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View server statistics'),

    async execute(interaction, client) {
        try {
            const guild = interaction.guild;

            // Get the owner
            const owner = await guild.fetchOwner();

            // Get member count
            const memberCount = guild.memberCount;

            // Get premium subscriber count (boosters)
            const boosterCount = guild.premiumSubscriptionCount;

            // Get newest member
            const members = await guild.members.fetch();
            const newestMember = members.sort((a, b) => b.joinedTimestamp - a.joinedTimestamp).first();

            // Create the stats embed
            const statsEmbed = new EmbedBuilder()
                .setColor(client.config.embeds.mainColor)
                .setTitle(`${guild.name} Statistics`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { 
                        name: '👑 Server Owner', 
                        value: `${owner}`, 
                        inline: true 
                    },
                    { 
                        name: '📅 Server Created', 
                        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, 
                        inline: true 
                    },
                    { 
                        name: '👥 Total Members', 
                        value: `${memberCount}`, 
                        inline: true 
                    },
                    { 
                        name: '🚀 Server Boosters', 
                        value: `${boosterCount}`, 
                        inline: true 
                    },
                    { 
                        name: '👋 Newest Member', 
                        value: `${newestMember}`, 
                        inline: true 
                    }
                )
                .setFooter({ text: `Server ID: ${guild.id}` })
                .setTimestamp();

            // Send stats embed as ephemeral message
            await interaction.reply({ 
                embeds: [statsEmbed],
                ephemeral: true
            });

            // Create and send log embed
            if (client.config.channels.loggingChannel) {
                const logChannel = await guild.channels.fetch(client.config.channels.loggingChannel);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(client.config.embeds.mainColor)
                        .setTitle('Command Used: /stats')
                        .addFields(
                            { 
                                name: 'User', 
                                value: `${interaction.user} (${interaction.user.tag})`, 
                                inline: true 
                            },
                            { 
                                name: 'Time', 
                                value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
                                inline: true 
                            }
                        )
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error('Error in stats command:', error);
            await interaction.reply({ 
                content: 'There was an error fetching server statistics.',
                ephemeral: true 
            });
        }
    },
};