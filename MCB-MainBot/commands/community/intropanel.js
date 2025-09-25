// commands/community/intropanel.js
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
        .setName('intropanel')
        .setDescription('Create the introduction panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client, config) {
        const embed = new EmbedBuilder()
            .setColor(config.embeds?.mainColor ?? '#5865F2')
            .setTitle('👋 Welcome to Our Community!')
            .setDescription('Click the button below to introduce yourself to everyone!')
            .addFields({
                name: 'What happens next?',
                value: 'You\'ll be prompted to fill out a short form about yourself, and your introduction will be posted in our introductions channel!'
            });

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_intro')
                    .setLabel('Introduce Yourself')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👋')
            );

        // First, acknowledge the command with an ephemeral message
        await interaction.reply({ 
            content: 'Introduction panel created!',
            ephemeral: true 
        });

        // Then send the actual panel message to the channel
        await interaction.channel.send({
            embeds: [embed],
            components: [button]
        });
    },
};