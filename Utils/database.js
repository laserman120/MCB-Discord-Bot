const { MongoClient } = require('mongodb');

let client;
let db;

/**
 * Connects to the MongoDB database once.
 * This should be called from your main index.js at startup.
 */
async function connect(config) {
    if (!config.database.uri) {
        throw new Error('Database URI is missing from config.yml');
    }
    try {
        client = new MongoClient(config.database.uri);
        await client.connect();
        db = client.db('mcb_moderation'); // Or your main DB name
        console.log('📊 Successfully connected to MongoDB.');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

/**
 * Gracefully closes the database connection.
 */
async function close() {
    if (client) {
        await client.close();
    }
}

/**
 * Returns the connected database instance.
 * All modules will call this function to get access to the DB.
 */
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Ensure connect() is called first.');
    }
    return db;
}

module.exports = { connect, close, getDb };