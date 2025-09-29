const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pointsadmin')
        .setDescription('Manage user points (Staff only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName('give')
                .setDescription('Give points to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to give points to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of points to give')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove points from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove points from')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of points to remove')
                        .setRequired(true)
                        .setMinValue(1))),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        
        try {
            // Find or create user document
            let userDoc = await User.findOne({
                userId: target.id,
                guildId: interaction.guild.id
            });

            if (!userDoc) {
                userDoc = new User({
                    userId: target.id,
                    guildId: interaction.guild.id,
                    points: 0
                });
            }

            // Create base embed for logging
            const logEmbed = new EmbedBuilder()
                .setColor(subcommand === 'give' ? client.config.embeds.acceptedEmbed : client.config.embeds.deniedEmbed)
                .setTitle(`Points ${subcommand === 'give' ? 'Given' : 'Removed'}`)
                .addFields(
                    { name: 'Staff Member', value: interaction.user.toString() },
                    { name: 'User', value: target.toString() },
                    { name: 'Amount', value: amount.toString() }
                )
                .setTimestamp();

            // Create response embed
            const responseEmbed = new EmbedBuilder()
                .setColor(subcommand === 'give' ? client.config.embeds.acceptedEmbed : client.config.embeds.deniedEmbed)
                .setTitle(`Points ${subcommand === 'give' ? 'Given' : 'Removed'}`);

            if (subcommand === 'give') {
                userDoc.points += amount;
                logEmbed.addFields({ name: 'New Balance', value: userDoc.points.toString() });
                responseEmbed.setDescription(`Successfully given ${amount} points to ${target}`);
            } else {
                // Check if user has enough points to remove
                if (userDoc.points < amount) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(client.config.embeds.deniedEmbed)
                            .setDescription(`${target} only has ${userDoc.points} points. Cannot remove ${amount} points.`)],
                        ephemeral: true
                    });
                }
                
                userDoc.points -= amount;
                logEmbed.addFields({ name: 'New Balance', value: userDoc.points.toString() });
                responseEmbed.setDescription(`Successfully removed ${amount} points from ${target}`);
            }

            await userDoc.save();

            // Log the action
            const logChannel = await interaction.guild.channels.fetch(client.config.channels.loggingChannel);
            if (logChannel) {
                await logChannel.send({ embeds: [logEmbed] });
            }

            // Send response to command user
            await interaction.reply({
                embeds: [responseEmbed],
                ephemeral: true
            });

            // Try to DM the target user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(subcommand === 'give' ? client.config.embeds.acceptedEmbed : client.config.embeds.deniedEmbed)
                    .setTitle(`Points ${subcommand === 'give' ? 'Received' : 'Removed'}`)
                    .setDescription(`${amount} points have been ${subcommand === 'give' ? 'added to' : 'removed from'} your account`)
                    .addFields({ name: 'New Balance', value: userDoc.points.toString() })
                    .setTimestamp();

                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM user ${target.tag}`);
            }

        } catch (error) {
            console.error('Error in pointsadmin command:', error);
            await interaction.reply({
                content: 'There was an error while executing this command.',
                ephemeral: true
            });
        }
    },
};