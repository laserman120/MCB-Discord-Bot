const fs = require('fs');
const path = require('path');

module.exports = () => {
    console.log('--- Loading Mongoose Models ---');

    // Define the directories where models are located
    const modelDirectories = ['MCB-MainBot/models']; // Add other bot model dirs here if they exist

    for (const dir of modelDirectories) {
        const modelsPath = path.join(__dirname, '..', dir); // Go up one level from Utils
        if (!fs.existsSync(modelsPath)) continue;

        const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));
        for (const file of modelFiles) {
            const filePath = path.join(modelsPath, file);
            require(filePath);
            console.log(`  - Loaded model: ${file}`);
        }
    }
    console.log('-------------------------------\n');
};