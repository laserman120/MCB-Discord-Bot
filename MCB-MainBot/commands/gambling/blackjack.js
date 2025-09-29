const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');

// Card emoji IDs
const CARD_EMOJIS = {
    hearts: {
        1: '<:HEARTSPNGA:1367890711890104382>',
        2: '<:HEARTSPNG2:1367890640356118538>',
        3: '<:HEARTSPNG3:1367890647293366353>',
        4: '<:HEARTSPNG4:1367890658039304372>',
        5: '<:HEARTSPNG5:1367890666780098581>',
        6: '<:HEARTSPNG6:1367890673424142578>',
        7: '<:HEARTSPNG7:1367890679543500891>',
        8: '<:HEARTSPNG8:1367890685319057501>',
        9: '<:HEARTSPNG9:1367890691153203240>',
        10: '<:HEARTSPNG10:1367890702524223508>',
        11: '<:HEARTSPNGJ:1367890720328908800>',
        12: '<:HEARTSPNGQ:1367890733356548107>',
        13: '<:HEARTSPNGK:1367890727232864409>'
    },
    clubs: {
        1: '<:CLUBSPNGA:1367890599365312633>',
        2: '<:CLUBSPNG2:1367890526681956413>',
        3: '<:CLUBSPNG3:1367890538224816148>',
        4: '<:CLUBSPNG4:1367890546655494285>',
        5: '<:CLUBSPNG5:1367890553513185341>',
        6: '<:CLUBSPNG6:1367890560291180587>',
        7: '<:CLUBSPNG7:1367890567274430625>',
        8: '<:CLUBSPNG8:1367890573788319905>',
        9: '<:CLUBSPNG9:1367890580864110593>',
        10: '<:CLUBSPNG10:1367890587432390840>',
        11: '<:CLUBSPNGJ:1367890607523233853>',
        12: '<:CLUBSPNGQ:1367890622014554164>',
        13: '<:CLUBSPNGK:1367890613797650473>'
    }
};

class Deck {
    constructor() {
        this.reset();
    }

    reset() {
        this.cards = [];
        // Using clubs and hearts for the game
        const suits = ['clubs', 'hearts'];
        for (const suit of suits) {
            for (let value = 1; value <= 13; value++) {
                this.cards.push({ suit, value });
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        if (this.cards.length === 0) this.reset();
        return this.cards.pop();
    }
}

function getCardEmoji(card) {
    return CARD_EMOJIS[card.suit][card.value];
}

function getHandValue(hand) {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
        if (card.value === 1) {
            aces++;
        } else {
            value += Math.min(10, card.value);
        }
    }

    // Add aces
    for (let i = 0; i < aces; i++) {
        if (value + 11 <= 21) {
            value += 11;
        } else {
            value += 1;
        }
    }

    return value;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play blackjack with your points')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount of points to bet')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction, client) {
        try {
            // Create a new interaction handler for the game
            const handleInteraction = async (i) => {
                if (i.customId === 'playAgain') {
                    // Start a new game with the same bet
                    await i.deferUpdate();
                    const bet = interaction.options.getInteger('bet');
                    await handleGame(i, client, client.config, bet);
                }
            };

            // Set up the interaction collector for the entire command
            const filter = i => i.user.id === interaction.user.id && i.customId === 'playAgain';
            const collector = interaction.channel.createMessageComponentCollector({
                filter,
                time: 300000 // 5 minutes
            });

            collector.on('collect', handleInteraction);

            // Start the initial game
            await handleGame(interaction, client, client.config);

        } catch (error) {
            console.error('Error in blackjack command:', error);
            await interaction.reply({
                content: 'There was an error processing your game.',
                ephemeral: true
            });
        }
    }
};

async function handleGame(interaction, client, config, previousBet = null) {
    const bet = previousBet || interaction.options.getInteger('bet');
    const isBooster = interaction.member.premiumSince !== null;

    // Get user's points
    let user = await User.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id
    });

    if (!user) {
        return interaction.reply({
            content: "You don't have any points to bet!",
            ephemeral: true
        });
    }

    if (user.points < bet) {
        return interaction.reply({
            content: `You don't have enough points! Your balance: ${user.points}`,
            ephemeral: true
        });
    }

    // Initialize deck and deal cards
    const deck = new Deck();
    const playerHand = [deck.draw(), deck.draw()];
    const dealerHand = [deck.draw(), deck.draw()];

    // Create buttons for hit/stand
    const gameButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('hit')
                .setLabel('Hit')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('👊'),
            new ButtonBuilder()
                .setCustomId('stand')
                .setLabel('Stand')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛑'),
            new ButtonBuilder()
                .setCustomId('info')
                .setLabel('Game Info')
                .setStyle(ButtonStyle.Success)
                .setEmoji('ℹ️')
        );

    // Create initial embed
    const embed = createGameEmbed(playerHand, dealerHand, bet, user.points, client.config, true);

    // Check for natural blackjack
    if (getHandValue(playerHand) === 21) {
        const dealerValue = getHandValue(dealerHand);
        const isPlayerBlackjack = playerHand.length === 2 && getHandValue(playerHand) === 21;
        const isDealerBlackjack = dealerHand.length === 2 && dealerValue === 21;

        if (isPlayerBlackjack && !isDealerBlackjack) {
            const multiplier = isBooster ? 3 : 2.5;
            const winnings = Math.floor(bet * multiplier);
            user.points += winnings;
            embed.setColor(client.config.embeds.acceptedEmbed)
                 .setDescription(`**🎉 BLACKJACK! You win ${multiplier}x your bet!**\n${isBooster ? 
                     '*(Booster bonus applied!)*' : 
                     '*💎 Boost the server to get 3x on blackjack wins!*'}`);
        } else if (isPlayerBlackjack && isDealerBlackjack) {
            embed.setColor(client.config.embeds.mainColor)
                 .setDescription('**Push! Both had Blackjack. Bet returned.**\n' +
                     (!isBooster ? '*💎 Boost the server to get 2x on blackjack wins!*' : ''));
        }

        await user.save();
        
        const playAgainButton = createPlayAgainButton();
        if (interaction.replied || interaction.deferred) {
            return interaction.editReply({
                embeds: [embed],
                components: [playAgainButton],
                ephemeral: true
            });
        } else {
            return interaction.reply({
                embeds: [embed],
                components: [playAgainButton],
                ephemeral: true
            });
        }
    }

    const response = interaction.replied || interaction.deferred ?
        await interaction.editReply({
            embeds: [embed],
            components: [gameButtons],
            ephemeral: true
        }) :
        await interaction.reply({
            embeds: [embed],
            components: [gameButtons],
            ephemeral: true
        });

    // Create button collector for hit/stand/info
    const gameFilter = i => i.user.id === interaction.user.id && ['hit', 'stand', 'info', 'backToGame'].includes(i.customId);
    const gameCollector = response.createMessageComponentCollector({
        filter: gameFilter,
        time: 30000
    });

    let currentEmbed = embed;
    let currentButtons = gameButtons;

    gameCollector.on('collect', async (i) => {
        try {
            await i.deferUpdate();

            if (i.customId === 'info') {
                const infoEmbed = new EmbedBuilder()
                    .setColor(client.config.embeds.mainColor)
                    .setTitle('🎰 Blackjack Rules & Payouts')
                    .setDescription('Try to beat the dealer by getting closer to 21 without going over!')
                    .addFields(
                        {
                            name: '📋 Basic Rules',
                            value: '• Cards 2-10 are worth their face value\n' +
                                   '• Face cards (J, Q, K) are worth 10\n' +
                                   '• Aces are worth 11 or 1 (automatically optimized)\n' +
                                   '• Dealer must hit on 16 and stand on 17',
                            inline: false
                        },
                        {
                            name: '💰 Regular Win Payouts',
                            value: '**Normal Users:**\n' +
                                   '• 2x bet (100% profit)\n' +
                                   '**Server Boosters:**\n' +
                                   '• 2.5x bet (150% profit)',
                            inline: true
                        },
                        {
                            name: '🎉 Natural Blackjack Payouts',
                            value: '**Normal Users:**\n' +
                                   '• 2.5x bet (150% profit)\n' +
                                   '**Server Boosters:**\n' +
                                   '• 3x bet (200% profit)',
                            inline: true
                        },
                        {
                            name: '🎮 How to Play',
                            value: '1. Place your bet\n' +
                                   '2. Click 👊 **Hit** to draw another card\n' +
                                   '3. Click 🛑 **Stand** to keep your current hand\n' +
                                   '4. Try to get closer to 21 than the dealer!',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Click "Back to Game" to return to your current game 🍀' });

                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('backToGame')
                            .setLabel('Back to Game')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🎮')
                    );

                currentEmbed = infoEmbed;
                currentButtons = backButton;

                await interaction.editReply({
                    embeds: [currentEmbed],
                    components: [currentButtons]
                });
                return;
            }

            if (i.customId === 'backToGame') {
                currentEmbed = embed;
                currentButtons = gameButtons;
                
                currentEmbed.spliceFields(0, currentEmbed.data.fields.length);
                updateGameEmbed(currentEmbed, playerHand, dealerHand, bet, user.points, true);
                
                await interaction.editReply({
                    embeds: [currentEmbed],
                    components: [currentButtons]
                });
                return;
            }

            if (i.customId === 'hit') {
                playerHand.push(deck.draw());
                const playerValue = getHandValue(playerHand);

                currentEmbed.spliceFields(0, currentEmbed.data.fields.length);
                updateGameEmbed(currentEmbed, playerHand, dealerHand, bet, user.points, true);

                if (playerValue > 21) {
                    user.points -= bet;
                    await user.save();
                    
                    currentEmbed.setColor(client.config.embeds.deniedEmbed)
                         .setDescription('**💥 BUST! You lose! 💥**\n' +
                             (!isBooster ? '*💎 Boost the server to get 2.5x on wins!*' : ''));
                    
                    const playAgainButton = createPlayAgainButton();
                    gameCollector.stop();
                    await interaction.editReply({
                        embeds: [currentEmbed],
                        components: [playAgainButton]
                    });
                } else {
                    await interaction.editReply({
                        embeds: [currentEmbed],
                        components: [gameButtons]
                    });
                }
            } else if (i.customId === 'stand') {
                let dealerValue = getHandValue(dealerHand);
                while (dealerValue < 17) {
                    dealerHand.push(deck.draw());
                    dealerValue = getHandValue(dealerHand);
                }

                const playerValue = getHandValue(playerHand);
                let result;
                let color;
                let winnings = 0;

                if (dealerValue > 21) {
                    const multiplier = isBooster ? 2.5 : 2;
                    winnings = Math.floor(bet * (multiplier - 1));
                    result = `**🎉 Dealer busts! You win ${multiplier}x your bet!**\n${isBooster ? 
                        '*(Booster bonus applied!)*' : 
                        '*💎 Boost the server to get 2.5x on wins!*'}`;
                    user.points += winnings + bet;
                    color = client.config.embeds.acceptedEmbed;
                } else if (dealerValue > playerValue) {
                    result = '**❌ Dealer wins! ❌**\n' + 
                        (!isBooster ? '*💎 Boost the server to get 2.5x on wins!*' : '');
                    user.points -= bet;
                    color = client.config.embeds.deniedEmbed;
                } else if (dealerValue < playerValue) {
                    const multiplier = isBooster ? 2.5 : 2;
                    winnings = Math.floor(bet * (multiplier - 1));
                    result = `**🎉 You win ${multiplier}x your bet!**\n${isBooster ? 
                        '*(Booster bonus applied!)*' : 
                        '*💎 Boost the server to get 2.5x on wins!*'}`;
                    user.points += winnings + bet;
                    color = client.config.embeds.acceptedEmbed;
                } else {
                    result = '**🤝 Push! Bet returned. 🤝**\n' +
                        (!isBooster ? '*💎 Boost the server to get 2.5x on wins!*' : '');
                    color = client.config.embeds.mainColor;
                }

                currentEmbed.spliceFields(0, currentEmbed.data.fields.length);
                updateGameEmbed(currentEmbed, playerHand, dealerHand, bet, user.points, false);
                currentEmbed.setColor(color)
                     .setDescription(result);

                await user.save();
                gameCollector.stop();

                const playAgainButton = createPlayAgainButton();
                await interaction.editReply({
                    embeds: [currentEmbed],
                    components: [playAgainButton]
                });
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
        }
    });

    gameCollector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            currentEmbed.setDescription('**⏰ Game timed out! Bet returned. ⏰**');
            const playAgainButton = createPlayAgainButton();
            await interaction.editReply({
                embeds: [currentEmbed],
                components: [playAgainButton]
            });
        }
    });
}

function createGameEmbed(playerHand, dealerHand, bet, points, config, hideDealer = true) {
    const playerValue = getHandValue(playerHand);
    const dealerValue = hideDealer ? getHandValue([dealerHand[0]]) : getHandValue(dealerHand);
    
    const embed = new EmbedBuilder()
        .setColor(client.config.embeds.mainColor)
        .setTitle('🎰 Blackjack Game')
        .setDescription('Game in progress...')
        .addFields(
            { 
                name: '\u200B',
                value: '**Your Hand:**',
                inline: false 
            },
            {
                name: `Value: ${playerValue}`,
                value: `${playerHand.map(getCardEmoji).join(' ')}`,
                inline: false
            },
            { 
                name: '\u200B',
                value: "**Dealer's Hand:**",
                inline: false 
            },
            {
                name: `Value: ${hideDealer ? '?' : dealerValue}`,
                value: hideDealer ? 
                    `${getCardEmoji(dealerHand[0])} ❓` :
                    `${dealerHand.map(getCardEmoji).join(' ')}`,
                inline: false
            },
            {
                name: '💰 Bet',
                value: `${bet} points`,
                inline: true
            },
            {
                name: '💳 Balance',
                value: `${points} points`,
                inline: true
            }
        );

    return embed;
}

function updateGameEmbed(embed, playerHand, dealerHand, bet, points, hideDealer = true) {
    const playerValue = getHandValue(playerHand);
    const dealerValue = hideDealer ? getHandValue([dealerHand[0]]) : getHandValue(dealerHand);
    
    embed.data.fields = [
        { 
            name: '\u200B',
            value: '**Your Hand:**',
            inline: false 
        },
        {
            name: `Value: ${playerValue}`,
            value: `${playerHand.map(getCardEmoji).join(' ')}`,
            inline: false
        },
        { 
            name: '\u200B',
            value: "**Dealer's Hand:**",
            inline: false 
        },
        {
            name: `Value: ${hideDealer ? '?' : dealerValue}`,
            value: hideDealer ? 
                `${getCardEmoji(dealerHand[0])} ❓` :
                `${dealerHand.map(getCardEmoji).join(' ')}`,
            inline: false
        },
        {
            name: '💰 Bet',
            value: `${bet} points`,
            inline: true
        },
        {
            name: '💳 Balance',
            value: `${points} points`,
            inline: true
        }
    ];

    return embed;
}

function createPlayAgainButton() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('playAgain')
                .setLabel('Play Again')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔄')
        );
} 