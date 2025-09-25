const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { addNote, getUserNotes, removeNote } = require('../utils/database');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notes')
        .setDescription('Manage user notes')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a note to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to add a note for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View notes for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to view notes for')
                        .setRequired(true))),

    async execute(interaction, client) {
        // Check if user has staff role
        if (!interaction.member.roles.cache.has(client.config.roles.staffRoleId)) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Permission Denied')
                .setDescription('You do not have permission to use this command.')
                .setTimestamp();

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add': {
                const user = interaction.options.getUser('user');
                
                // Create modal for note input
                const modal = new ModalBuilder()
                    .setCustomId('noteModal')
                    .setTitle(`Add Note for ${user.username}`);

                const noteInput = new TextInputBuilder()
                    .setCustomId('noteContent')
                    .setLabel('Note Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(1000);

                const firstActionRow = new ActionRowBuilder().addComponents(noteInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
                
                // Handle modal submission
                const filter = i => i.customId === 'noteModal';
                const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 60000 })
                    .catch(() => null);

                if (!modalInteraction) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('Note Creation Timed Out')
                        .setDescription('The note creation process timed out. Please try again.')
                        .setTimestamp();

                    return interaction.followUp({
                        embeds: [timeoutEmbed],
                        ephemeral: true
                    });
                }

                const noteContent = modalInteraction.fields.getTextInputValue('noteContent');
                await addNote(user.id, interaction.user.id, noteContent);

                // Create log embed
                const logEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Note Added')
                    .addFields(
                        { name: 'Note added for:', value: `<@${user.id}> (${user.tag})` },
                        { name: 'Added by:', value: `<@${interaction.user.id}>` },
                        { name: 'Content', value: noteContent }
                    )
                    .setTimestamp();

                // Send log to misc thread
                const logThread = await interaction.guild.channels.fetch('1360784310268989531');
                if (logThread) {
                    await logThread.send({ embeds: [logEmbed] });
                }

                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Note Added')
                    .setDescription(`Successfully added a note for ${user.username}`)
                    .addFields(
                        { name: 'Content', value: noteContent },
                        { name: 'Added by', value: interaction.user.tag }
                    )
                    .setTimestamp();

                return modalInteraction.reply({
                    embeds: [successEmbed],
                    ephemeral: true
                });
            }

            case 'view': {
                const user = interaction.options.getUser('user');
                const notes = await getUserNotes(user.id);

                if (notes.length === 0) {
                    const noNotesEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('No Notes Found')
                        .setDescription(`No notes found for ${user.username}`)
                        .setTimestamp();

                    return interaction.reply({
                        embeds: [noNotesEmbed],
                        ephemeral: true
                    });
                }

                let currentPage = 0;

                const generateEmbed = (pageNum) => {
                    const note = notes[pageNum];
                    return new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(`Notes for ${user.username}`)
                        .setDescription(`Found ${notes.length} note(s)\n\nNote ${pageNum + 1}:\nGiven: <t:${Math.floor(note.timestamp.getTime() / 1000)}:F>`)
                        .addFields({
                            name: 'Note:',
                            value: `\`\`\`\n${note.content}\n\`\`\``
                        })
                        .setFooter({ text: `Added by: ${interaction.guild.members.cache.get(note.authorId)?.user.tag || note.authorId}` })
                        .setTimestamp();
                };

                const generateButtons = (pageNum) => {
                    const row = new ActionRowBuilder();
                    
                    // Previous button
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_note')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageNum === 0)
                    );

                    // Remove button
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('remove_note')
                            .setLabel('Remove')
                            .setStyle(ButtonStyle.Danger)
                    );

                    // Next button
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('next_note')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageNum === notes.length - 1)
                    );

                    return row;
                };

                const initialMessage = await interaction.reply({
                    embeds: [generateEmbed(currentPage)],
                    components: [generateButtons(currentPage)],
                    ephemeral: true
                });

                if (notes.length === 0) return;

                // Create button collector
                const collector = initialMessage.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id,
                    time: 300000 // 5 minutes
                });

                collector.on('collect', async i => {
                    if (i.customId === 'prev_note') {
                        currentPage--;
                    } else if (i.customId === 'next_note') {
                        currentPage++;
                    } else if (i.customId === 'remove_note') {
                        try {
                            // Get the current note
                            const noteToRemove = notes[currentPage];
                            
                            // Remove the note from the database
                            await removeNote(noteToRemove._id.toString());
                            
                            // Remove the note from our local array
                            notes.splice(currentPage, 1);
                            
                            // If no notes left, update the embed to show no notes
                            if (notes.length === 0) {
                                const noNotesEmbed = new EmbedBuilder()
                                    .setColor('#FFA500')
                                    .setTitle('No Notes Found')
                                    .setDescription(`No notes found for ${user.username}`)
                                    .setTimestamp();

                                await i.update({ 
                                    embeds: [noNotesEmbed], 
                                    components: [] 
                                });

                                // Create log embed for the removal
                                const logEmbed = new EmbedBuilder()
                                    .setColor('#FF0000')
                                    .setTitle('Note Removed')
                                    .addFields(
                                        { name: 'Note removed from:', value: `<@${user.id}> (${user.username})` },
                                        { name: 'Removed by:', value: `<@${interaction.user.id}>` },
                                        { name: 'Original Note', value: `\`\`\`\n${noteToRemove.content}\n\`\`\`` },
                                        { name: 'Note was added by', value: `<@${noteToRemove.authorId}>` },
                                        { name: 'Note was added on', value: `<t:${Math.floor(noteToRemove.timestamp.getTime() / 1000)}:F>` }
                                    )
                                    .setTimestamp();

                                // Send to notes log thread
                                const logThread = await interaction.guild.channels.fetch(client.config.threads.noteLogThreadId);
                                if (logThread && logThread.isThread()) {
                                    await logThread.send({ embeds: [logEmbed] });
                                }
                                return;
                            }

                            // Adjust currentPage if we removed the last note in the list
                            if (currentPage >= notes.length) {
                                currentPage = notes.length - 1;
                            }

                            // Create log embed for the removal
                            const logEmbed = new EmbedBuilder()
                                .setColor('#FF0000')
                                .setTitle('Note Removed')
                                .addFields(
                                    { name: 'Note removed from:', value: `<@${user.id}> (${user.username})` },
                                    { name: 'Removed by:', value: `<@${interaction.user.id}>` },
                                    { name: 'Original Note', value: `\`\`\`\n${noteToRemove.content}\n\`\`\`` },
                                    { name: 'Note was added by', value: `<@${noteToRemove.authorId}>` },
                                    { name: 'Note was added on', value: `<t:${Math.floor(noteToRemove.timestamp.getTime() / 1000)}:F>` }
                                )
                                .setTimestamp();

                            // Send to notes log thread
                            const logThread = await interaction.guild.channels.fetch(client.config.threads.noteLogThreadId);
                            if (logThread && logThread.isThread()) {
                                await logThread.send({ embeds: [logEmbed] });
                            }

                            // Update embed and buttons
                            await i.update({
                                embeds: [generateEmbed(currentPage)],
                                components: [generateButtons(currentPage)]
                            });
                        } catch (error) {
                            console.error('Error removing note:', error);
                            await i.reply({
                                content: 'There was an error removing the note.',
                                ephemeral: true
                            });
                        }
                        return;
                    }

                    await i.update({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons(currentPage)]
                    });
                });

                collector.on('end', () => {
                    initialMessage.edit({ components: [] }).catch(() => {});
                });
                break;
            }
        }
    }
}; 