const mongoose = require('mongoose');

// This will give us real-time feedback on the connection status
const dbConnection = mongoose.connection;

dbConnection.on('connecting', () => {
    console.log(' Mongoose: Connecting to MongoDB...');
});

dbConnection.on('connected', () => {
    console.log(' Mongoose: Successfully connected to MongoDB.');
});

dbConnection.on('error', (err) => {
    console.error(' Mongoose: Connection error:', err);
});

dbConnection.on('disconnected', () => {
    console.warn(' Mongoose: Disconnected from MongoDB.');
});

async function connect(config) {
    if (!config.database.uri) {
        throw new Error('Database URI is missing from config.yml');
    }
    try {
        // This will now trigger the event listeners above
        await mongoose.connect(config.database.uri, {
            dbName: 'MinecraftBuddies',
        });
    } catch (error) {
        // The 'error' event listener will also catch this
        console.error(' Mongoose: Initial connection failed:', error);
        process.exit(1);
    }
}

function close() {
    return mongoose.disconnect();
}

function getDb() {
    if (mongoose.connection.readyState !== 1) { // 1 = connected
        throw new Error('Database not initialized. Ensure connect() is called first.');
    }
    return mongoose.connection.db;
}

module.exports = { connect, close, getDb };