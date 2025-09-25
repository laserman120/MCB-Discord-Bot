const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to fetch meme with retries
async function fetchMemeWithRetry(subreddit, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`https://meme-api.com/gimme/${subreddit}`);
            
            if (response.ok) {
                return await response.json();
            }

            // If we get a 530, wait longer before retrying
            if (response.status === 530) {
                await delay(initialDelay * attempt);
                continue;
            }

            throw new Error(`API returned ${response.status}`);
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries) {
                throw error;
            }
            await delay(initialDelay * attempt);
        }
    }
    throw lastError;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a random Minecraft meme'),

    async execute(interaction, client, config) {
        // Check if command is used in the memes channel
        if (interaction.channelId !== '1352308677163352094') {
            return interaction.reply({
                content: 'This command can only be used in the memes channel!',
                ephemeral: true
            });
        }

        try {
            // Defer the reply since API might take a moment
            await interaction.deferReply();

            let data;
            try {
                // Try MinecraftMemes first
                data = await fetchMemeWithRetry('MinecraftMemes');
            } catch (error) {
                console.log('Failed to fetch from MinecraftMemes, trying minecraft as fallback:', error.message);
                // If that fails, try the minecraft subreddit as fallback
                data = await fetchMemeWithRetry('minecraft');
            }
            
            if (!data || !data.url || !data.title) {
                console.error('Invalid API response structure:', data);
                throw new Error('Invalid API response');
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(config.embeds.acceptedEmbed)
                .setTitle(data.title.substring(0, 256)) // Discord has a 256 character limit for titles
                .setURL(data.postLink)
                .setImage(data.url)
                .setFooter({ 
                    text: `👍 ${data.ups || 0} | Posted by u/${data.author || 'unknown'}`
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in meme command:', error);
            await interaction.editReply({
                content: 'Sorry, I was unable to fetch a meme at this time. Please try again later.',
                ephemeral: true
            });
        }
    },
}; 