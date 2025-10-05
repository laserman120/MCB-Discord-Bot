const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dns = require('dns');
const ticketHandler = require('./ticketHandler');
const { initializeClosureHandler } = require('./handlers/closureHandler');
const { cancelTicketClosure } = require('./utils/database'); 


function initialize(client, config) {
    dns.setDefaultResultOrder('ipv4first');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log('   - Ticket-Bot module initialized.');
}

async function handleInteraction(interaction, client) {
    // Check if this interaction belongs to this module
    if (interaction.isStringSelectMenu() && interaction.customId === 'create_ticket') {
        await ticketHandler.handleTicketCreation(interaction, client);
        return true; 
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_')) {
        await ticketHandler.handleModalSubmit(interaction, client);
        return true;
    }
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await ticketHandler.handleCloseTicket(interaction, client);
        return true;
    }

    // --- NEW BUTTON HANDLERS ---
    if (interaction.isButton()) {
        if (interaction.customId === 'finish:cancel') {
            await cancelTicketClosure(interaction.channel.id);
            // We can stop the timeout if we were tracking it, but with the DB it's not strictly necessary.
            await interaction.message.edit({
                embeds: [
                    EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#F1C40F') // Yellow
                        .setDescription(`Ticket closure has been cancelled by ${interaction.user}.`)
                        .setFooter(null)
                ],
                components: [] // Remove buttons
            });
            await interaction.reply({ content: 'Ticket closure cancelled.', ephemeral: true });
            return true;
        }

        if (interaction.customId === 'finish:close_now') {
            await cancelTicketClosure(interaction.channel.id); // Cancel scheduled closure
            await ticketHandler.handleCloseTicket(interaction, client, "Ticket closed manually.");
            // No reply needed as the channel will be deleted.
            return true;
        }
    }

    // Handle buttons created by individual ticket handlers
    if (interaction.customId && interaction.customId.includes(':')) {
        const [handlerName] = interaction.customId.split(':');
        const handlerPath = `./handlers/${handlerName}.js`;

        try {
            const handler = require(handlerPath);
            if (handler && typeof handler.handleInteraction === 'function') {
                return await handler.handleInteraction(interaction, client);
            }
        } catch (error) {
            console.error(`Error routing interaction to handler "${handlerName}":`, error);
        }
    }

    return false; // IMPORTANT: Signal that this interaction is not for us
}

const eventHandlers = {
    ready: (client, config) => {
        initializeClosureHandler(client);
    },

    guildMemberRemove: async (member, client) => {
        const guild = member.guild;
        const config = client.config;
        const ticketCategory = await guild.channels.fetch(config.categories.ticketCategory).catch(() => null);
        if (!ticketCategory) return;

        const ticketChannels = ticketCategory.children.cache.filter(ch => ch.type === ChannelType.GuildText);
        for (const [, channel] of ticketChannels) {
            if (channel.topic && channel.topic.includes(member.id)) {
                const embed = new EmbedBuilder().setColor(config.panelColor).setDescription(config.messages.ticketCreatorLeft.replace('{user}', member.toString()));
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger));
                await channel.send({ embeds: [embed], components: [row] });
            }
        }
    },
};

module.exports = {
    initialize,
    handleInteraction,
    eventHandlers,
};