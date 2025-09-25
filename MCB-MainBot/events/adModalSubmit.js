const { EmbedBuilder } = require('discord.js');
const Ad = require('../models/Ad');
const User = require('../models/User');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client, config) {
        if (!interaction.isModalSubmit()) return;
        if (interaction.customId !== 'ad-modal') return;

        try {
            // Get the user's points
            const user = await User.findOne({ 
                userId: interaction.user.id,
                guildId: interaction.guild.id 
            });

            if (!user || user.points < config.ads.cost) {
                return interaction.reply({
                    content: `You need ${config.ads.cost} points to post an advertisement.`,
                    ephemeral: true
                });
            }

            // Check cooldown
            const lastAd = await Ad.findOne({
                userId: interaction.user.id,
                guildId: interaction.guild.id
            }).sort({ timestamp: -1 });

            if (lastAd && (Date.now() - lastAd.timestamp) < (config.ads.cooldown * 1000)) {
                const timeLeft = Math.ceil((config.ads.cooldown * 1000 - (Date.now() - lastAd.timestamp)) / 1000 / 60);
                return interaction.reply({
                    content: `Please wait ${timeLeft} minutes before posting another advertisement.`,
                    ephemeral: true
                });
            }

            const adContent = interaction.fields.getTextInputValue('ad-content');

            // Create the ad
            const newAd = new Ad({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                content: adContent,
                cost: config.ads.cost
            });
            await newAd.save();

            // Deduct points
            user.points -= config.ads.cost;
            await user.save();

            // Create and send the ad embed
            const adEmbed = new EmbedBuilder()
                .setColor(config.embeds.mainColor)
                .setAuthor({ 
                    name: interaction.user.tag, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setDescription(adContent)
                .setTimestamp();

            await interaction.reply({ 
                content: config.messages.ad_posted.replace('{balance}', user.points),
                embeds: [adEmbed] 
            });

        } catch (error) {
            console.error('Error processing ad:', error);
            await interaction.reply({ 
                content: 'There was an error processing your advertisement.',
                ephemeral: true 
            });
        }
    },
};