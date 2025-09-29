const mongoose = require('mongoose');
const messageLogger = require('./handlers/messageLogger');
const InteractionManager = require('./handlers/interactionManager');
const PointsHandler = require('./handlers/pointsHandler');
const statusHandler = require('./handlers/statusHandler');

let interactionManager;
let pointsHandler;

function initialize(client, config) {
    interactionManager = new InteractionManager(client, config);
    pointsHandler = new PointsHandler(config);

    pointsHandler.startCooldownCleanup();

    process.on('unhandledRejection', error => {
        console.error('Unhandled promise rejection:', error);
    });

    console.log('   - Main Module Initialized');
}

async function handleInteraction(interaction, client) {
    return interactionManager.handleInteraction(interaction, client);
}

const eventHandlers = {
    ready: (client, config) => {
        statusHandler.updateStatus(client, config);
    },

    messageUpdate: (oldMessage, newMessage, client, config) => {
        messageLogger.execute('messageUpdate', oldMessage, newMessage, client, config);
    },

    messageDelete: (message, client, config) => {
        messageLogger.execute('messageDelete', message, client, config);
    },

    messageCreate: (message) => {
        if (message.author.bot) return;
        pointsHandler.handleMessagePoints(message);
    }
};

// Export the module structure
module.exports = {
    initialize,
    handleInteraction,
    eventHandlers,
};