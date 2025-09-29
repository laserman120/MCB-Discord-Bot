const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder 
} = require('discord.js');
const Ad = require('../models/Ad');
const User = require('../models/User');
const ServerSettings = require('../models/ServerSettings');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client, config) {
        if (!interaction.isModalSubmit()) return;
        if (interaction.customId !== 'ad-modal') return;

        try {
            // Check if user is a booster
            const isBooster = interaction.member.premiumSince !== null;
            const userCooldown = isBooster ? 43200 : 86400; // 12 hours for boosters, 24 hours for non-boosters

            // Double-check cooldowns (in case time passed between command and submission)
            const [lastUserAd, lastGlobalAd] = await Promise.all([
                Ad.findOne({
                    userId: interaction.user.id,
                    guildId: interaction.guild.id
                }).sort({ timestamp: -1 }),
                Ad.findOne({
                    guildId: interaction.guild.id
                }).sort({ timestamp: -1 })
            ]);

            // Check user cooldown again
            if (lastUserAd) {
                const timeSinceLastAd = Date.now() - lastUserAd.timestamp.getTime();
                if (timeSinceLastAd < (userCooldown * 1000)) {
                    const timeLeft = Math.ceil((userCooldown * 1000 - timeSinceLastAd) / 1000);
                    const embed = new EmbedBuilder()
                        .setColor(client.config.embeds.deniedEmbed)
                        .setDescription(`You can post another advertisement <t:${Math.floor(Date.now()/1000 + timeLeft)}:R>`)
                        .setFooter({ text: isBooster ? '✨ Server Boosters can post every 12 hours!' : '✨ Boost the server to post ads every 12 hours!' })
                        .setTimestamp();
                    
                    return interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });
                }
            }

            // Check global cooldown again
            if (lastGlobalAd) {
                const timeSinceLastGlobalAd = Date.now() - lastGlobalAd.timestamp.getTime();
                if (timeSinceLastGlobalAd < (client.config.ads.globalCooldown * 1000)) {
                    const timeLeft = Math.ceil((client.config.ads.globalCooldown * 1000 - timeSinceLastGlobalAd) / 1000);
                    const embed = new EmbedBuilder()
                        .setColor(client.config.embeds.deniedEmbed)
                        .setDescription(`Someone recently posted an ad. You can post <t:${Math.floor(Date.now()/1000 + timeLeft)}:R>`)
                        .setTimestamp();
                    
                    return interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });
                }
            }

            // Get user
            const user = await User.findOne({ 
                userId: interaction.user.id,
                guildId: interaction.guild.id 
            });

            // Double check points
            if (!user || user.points < client.config.ads.cost) {
                const embed = new EmbedBuilder()
                    .setColor(client.config.embeds.deniedEmbed)
                    .setDescription(`You need ${client.config.ads.cost} points to post an advertisement.\nCurrent balance: ${user?.points || 0}`)
                    .setTimestamp();
                
                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            // Get the values from the modal
            const communityName = interaction.fields.getTextInputValue('community-name');
            const description = interaction.fields.getTextInputValue('description');
            const howToJoin = interaction.fields.getTextInputValue('how-to-join');

            // Format the complete ad content
            const adContent = `# ${communityName}\n\n` +
                            `### 📝 Description\n\`\`\`\n${description}\`\`\`\n\n` +
                            `### 🔗 How to Join\n\`\`\`\n${howToJoin}\`\`\``;

            // Create the ad embed
            const adEmbed = new EmbedBuilder()
                .setColor(client.config.embeds.mainColor)
                .setAuthor({ 
                    name: interaction.user.tag, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setDescription(adContent)
                .setFooter({ 
                    text: `ℹ️  This ad was purchased with points. Type /ads for more information.${isBooster ? ' • Server Booster' : ''}`
                })
                .setTimestamp();

            // Create buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`dm_user_${interaction.user.id}`)
                        .setLabel('DM User')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`report_ad_${interaction.user.id}`)
                        .setLabel('Report')
                        .setStyle(ButtonStyle.Danger)
                );

            // Arrays to store message IDs and channels
            let messageIds = [];
            let channelsPostedIn = [];

            // Post to all configured channels
            for (const channelId of client.config.ads.adChannels) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    if (channel) {
                        const message = await channel.send({ 
                            embeds: [adEmbed],
                            components: [buttons]
                        });
                        messageIds.push(message.id);
                        channelsPostedIn.push(channelId);
                    }
                } catch (error) {
                    console.error(`Failed to post ad in channel ${channelId}:`, error);
                }
            }

            // Create the ad document
            const newAd = new Ad({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                content: adContent,
                messageIds: messageIds,
                channelsPostedIn: channelsPostedIn,
                cost: client.config.ads.cost,
                status: 'active',
                title: communityName,
                wasBooster: isBooster
            });
            await newAd.save();

            // Deduct points
            user.points -= client.config.ads.cost;
            await user.save();

            // Create confirmation embed
            const confirmationEmbed = new EmbedBuilder()
                .setColor(client.config.embeds.acceptedEmbed)
                .setTitle('Advertisement Posted!')
                .setDescription(`Your advertisement for "${communityName}" has been posted successfully!`)
                .addFields(
                    { 
                        name: 'Cost', 
                        value: `${client.config.ads.cost} points`, 
                        inline: true 
                    },
                    { 
                        name: 'New Balance', 
                        value: `${user.points} points`, 
                        inline: true 
                    },
                    {
                        name: 'Next Available',
                        value: `<t:${Math.floor(Date.now()/1000 + userCooldown)}:R>`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: isBooster ? 
                        '✨ As a Server Booster, you can post ads every 12 hours!' : 
                        '✨ Boost the server to post ads every 12 hours!' 
                })
                .setTimestamp();

            // Send confirmation to user
            await interaction.reply({ 
                embeds: [confirmationEmbed],
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error processing ad:', error);
            const embed = new EmbedBuilder()
                .setColor(client.config.embeds.deniedEmbed)
                .setDescription('There was an error processing your advertisement.')
                .setTimestamp();
            
            await interaction.reply({ 
                embeds: [embed],
                ephemeral: true 
            });
        }
    },
};