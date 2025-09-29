const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ad')
        .setDescription('Create and post an advertisement'),

    async execute(interaction, client) {
        const User = mongoose.model('User');
        const Ad = mongoose.model('Ad');
        try {
            // Check user points
            const user = await User.findOne({ 
                userId: interaction.user.id,
                guildId: interaction.guild.id 
            });

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

            // Check if user is a booster
            const isBooster = interaction.member.premiumSince !== null;
            const userCooldown = isBooster ? 43200 : 86400; // 12 hours for boosters, 24 hours for non-boosters

            // Check user's personal cooldown
            const lastUserAd = await Ad.findOne({
                userId: interaction.user.id,
                guildId: interaction.guild.id
            }).sort({ timestamp: -1 });

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

            // Check global cooldown
            const lastGlobalAd = await Ad.findOne({
                guildId: interaction.guild.id
            }).sort({ timestamp: -1 });

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

            // Create the modal
            const modal = new ModalBuilder()
                .setCustomId('ad-modal')
                .setTitle('Create Advertisement');

            // Community Name field
            const communityName = new TextInputBuilder()
                .setCustomId('community-name')
                .setLabel('Community Name')
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(100)
                .setPlaceholder('Your realm/server name (if none, just say "A Minecraft Realm")')
                .setRequired(true);

            // Description field
            const description = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(10)
                .setMaxLength(client.config.ads.max_length)
                .setPlaceholder('Describe your community (No IPs or Discord links - read rules if unsure)')
                .setRequired(true);

            // How to Join field
            const howToJoin = new TextInputBuilder()
                .setCustomId('how-to-join')
                .setLabel('How to Join')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(5)
                .setMaxLength(200)
                .setPlaceholder('Explain how to join (No Discord links or IPs)')
                .setRequired(true);

            // Create action rows (each text input needs its own action row)
            const firstActionRow = new ActionRowBuilder().addComponents(communityName);
            const secondActionRow = new ActionRowBuilder().addComponents(description);
            const thirdActionRow = new ActionRowBuilder().addComponents(howToJoin);

            // Add all action rows to the modal
            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('Error in ad command:', error);
            const embed = new EmbedBuilder()
                .setColor(client.config.embeds.deniedEmbed)
                .setDescription('There was an error processing your advertisement request.')
                .setTimestamp();
            
            await interaction.reply({ 
                embeds: [embed],
                ephemeral: true 
            });
        }
    },
};