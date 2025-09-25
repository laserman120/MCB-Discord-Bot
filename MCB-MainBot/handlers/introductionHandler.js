// handlers/introductionHandler.js
const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    EmbedBuilder 
} = require('discord.js');

async function handleIntroButton(interaction, client, config) {
    const modal = new ModalBuilder()
        .setCustomId('intro_modal')
        .setTitle('Create Your Introduction');

    const mcUsernameInput = new TextInputBuilder()
        .setCustomId('mc_username')
        .setLabel('Minecraft Username')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Notch')
        .setRequired(true)
        .setMaxLength(16);

    const platformInput = new TextInputBuilder()
        .setCustomId('platform')
        .setLabel('Platform')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Java Edition, Bedrock, Both')
        .setRequired(true);

    const playstyleInput = new TextInputBuilder()
        .setCustomId('playstyle')
        .setLabel('Playstyle')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Builder, Redstone, PvP, Survival')
        .setRequired(true);

    const countryInput = new TextInputBuilder()
        .setCustomId('country')
        .setLabel('Country')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., United States, UK, Australia')
        .setRequired(true);

    const aboutInput = new TextInputBuilder()
        .setCustomId('about')
        .setLabel('A Little About You')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Tell us about yourself! (Advertising servers here will result in a ban.)')
        .setRequired(true)
        .setMaxLength(1000);

    const rows = [
        new ActionRowBuilder().addComponents(mcUsernameInput),
        new ActionRowBuilder().addComponents(platformInput),
        new ActionRowBuilder().addComponents(playstyleInput),
        new ActionRowBuilder().addComponents(countryInput),
        new ActionRowBuilder().addComponents(aboutInput)
    ];

    modal.addComponents(...rows);
    await interaction.showModal(modal);
}

async function handleIntroSubmit(interaction, client, config) {
    try {
        const mcUsername = interaction.fields.getTextInputValue('mc_username');
        const platform = interaction.fields.getTextInputValue('platform');
        const playstyle = interaction.fields.getTextInputValue('playstyle');
        const country = interaction.fields.getTextInputValue('country');
        const about = interaction.fields.getTextInputValue('about');

        const introEmbed = new EmbedBuilder()
            .setColor(config.introduction?.embedColor ?? '#5865F2')
            .setTitle(`👋 New Member: ${interaction.user.tag}`)
            .setThumbnail(`https://mc-heads.net/head/${mcUsername}`)
            .addFields(
                { name: '🎮 Minecraft Username', value: mcUsername, inline: true },
                { name: '💻 Platform', value: platform, inline: true },
                { name: '🎯 Playstyle', value: playstyle, inline: true },
                { name: '🌎 Country', value: country, inline: true },
                { name: '📝 About Me', value: about }
            )
            .setTimestamp()
            .setFooter({ 
                text: 'Welcome to our community!',
                iconURL: interaction.guild.iconURL()
            });

        const introChannel = await interaction.guild.channels.fetch(config.introduction.channelId);
        if (!introChannel) {
            throw new Error('Introduction channel not configured or not found');
        }
        
        const introMessage = await introChannel.send({
            content: `Welcome ${interaction.user}! 🎉`,
            embeds: [introEmbed]
        });

        const thread = await introMessage.startThread({
            name: `Welcome ${interaction.user.username}!`,
            autoArchiveDuration: config.introduction?.threadDuration ?? 1440
        });

        await thread.send({
            content: `Hey everyone! Feel free to say hello to ${interaction.user}! 👋`
        });

        await interaction.reply({
            content: 'Your introduction has been posted successfully! 🎉',
            ephemeral: true
        });

    } catch (error) {
        console.error('Error handling introduction:', error);
        await interaction.reply({
            content: 'There was an error posting your introduction. Please try again later.',
            ephemeral: true
        });
    }
}

module.exports = { handleIntroButton, handleIntroSubmit };