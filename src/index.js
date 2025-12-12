/**
 * MineBot - Autonomous Minecraft Bot
 * ===================================
 * Main entry point with connection logic and cognitive loop
 */

import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder } = pathfinderPkg;
import collectBlock from 'mineflayer-collectblock';
import pvp from 'mineflayer-pvp';
import minecraftData from 'minecraft-data';

import { BOT_CONFIG, BEHAVIOR_CONFIG, OLLAMA_CONFIG, LOG_CONFIG } from './config.js';
import { logger } from './utils/logger.js';
import { perceive, formatPerceptionForLLM } from './core/perception.js';
import { think, testConnection } from './core/brain.js';
import { executeAction, isExecuting } from './core/actions.js';
import { getNextAction } from './core/goals.js';

// Global bot instance
let bot = null;
let cognitiveLoopInterval = null;
let lastActionResult = null;
let isThinking = false;

/**
 * Initialize and connect the bot
 */
async function createBot() {
    logger.banner();
    logger.divider();
    logger.info('Starting MineBot...');
    logger.status('Username', BOT_CONFIG.username, 'cyan');
    logger.status('Server', `${BOT_CONFIG.host}:${BOT_CONFIG.port}`, 'cyan');
    logger.status('LLM Model', OLLAMA_CONFIG.model, 'magenta');
    logger.divider();

    // Test Ollama connection first
    logger.info('Testing Ollama connection...');
    const ollamaOk = await testConnection();
    
    if (!ollamaOk) {
        logger.error('Ollama is not available. Please start Ollama first.');
        logger.info('Run: ollama serve');
        logger.info(`Then make sure you have the model: ollama pull ${OLLAMA_CONFIG.model}`);
        process.exit(1);
    }

    // Create bot instance
    bot = mineflayer.createBot({
        host: BOT_CONFIG.host,
        port: BOT_CONFIG.port,
        username: BOT_CONFIG.username,
        version: BOT_CONFIG.version,
        auth: BOT_CONFIG.auth
    });

    // Store minecraft-data reference on bot for easy access
    bot.once('spawn', () => {
        bot.mcData = minecraftData(bot.version);
        logger.success(`Connected to server (Minecraft ${bot.version})`);
    });

    // Load plugins
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(collectBlock.plugin);
    bot.loadPlugin(pvp.plugin);

    // Set up event handlers
    setupEventHandlers();

    return bot;
}

/**
 * Set up bot event handlers
 */
function setupEventHandlers() {
    // Connection events
    bot.on('login', () => {
        logger.success('Bot logged in successfully');
    });

    bot.on('spawn', () => {
        logger.success('Bot spawned in world');
        logger.status('Position', 
            `X:${Math.round(bot.entity.position.x)} Y:${Math.round(bot.entity.position.y)} Z:${Math.round(bot.entity.position.z)}`,
            'green'
        );
        
        // Start cognitive loop after spawn
        startCognitiveLoop();
    });

    // Chat handling
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        logger.chat(`${username}: ${message}`);
        
        // You could add command handling here
        // e.g., if message starts with "!bot"
    });

    // Health monitoring
    bot.on('health', () => {
        if (bot.health <= BEHAVIOR_CONFIG.health.critical) {
            logger.warn(`Health critical: ${bot.health}/20`);
        }
    });

    // Death handling
    bot.on('death', () => {
        logger.error('Bot died!');
        stopCognitiveLoop();
        
        // Will automatically respawn and restart loop
    });

    bot.on('respawn', () => {
        logger.info('Bot respawned');
        startCognitiveLoop();
    });

    // Error handling
    bot.on('error', (err) => {
        logger.error('Bot error', err.message);
    });

    bot.on('kicked', (reason) => {
        logger.error('Bot was kicked', reason);
        stopCognitiveLoop();
    });

    bot.on('end', () => {
        logger.warn('Connection ended');
        stopCognitiveLoop();
    });

    // Combat events (using pvp plugin)
    bot.on('stoppedAttacking', () => {
        logger.action('Stopped attacking');
    });

    // Pathfinder events
    bot.on('goal_reached', () => {
        if (LOG_CONFIG?.debugActions) {
            logger.action('Reached goal');
        }
    });

    bot.on('path_update', (r) => {
        if (r.status === 'noPath') {
            logger.warn('No path found');
        }
    });
}

/**
 * The main cognitive loop
 * Perceive → Think (Deterministic first, then LLM) → Act
 */
async function cognitiveLoop() {
    // Skip if already thinking or executing
    if (isThinking || isExecuting()) {
        return;
    }

    try {
        isThinking = true;

        let decision;

        // 1. TRY DETERMINISTIC GOALS FIRST (faster, more reliable)
        const deterministicAction = getNextAction(bot);
        
        if (deterministicAction) {
            // Use deterministic decision
            logger.brain(`[AUTO] ${deterministicAction.action.toUpperCase()} → ${deterministicAction.target}`);
            logger.status('', deterministicAction.reason, 'cyan');
            decision = deterministicAction;
        } else {
            // 2. FALL BACK TO LLM for complex decisions
            const perception = perceive(bot, lastActionResult);
            const context = formatPerceptionForLLM(perception);

            logger.brain('Thinking with LLM...');
            decision = await think(context);
        }

        // 3. ACT - Execute the decision
        if (decision.action !== 'wait') {
            lastActionResult = await executeAction(bot, decision);
        } else {
            lastActionResult = { action: 'wait', success: true };
        }

    } catch (error) {
        logger.error('Cognitive loop error', error.message);
        lastActionResult = {
            action: 'error',
            success: false,
            error: error.message
        };
    } finally {
        isThinking = false;
    }
}

/**
 * Start the cognitive loop
 */
function startCognitiveLoop() {
    if (cognitiveLoopInterval) {
        return; // Already running
    }

    logger.info(`Starting cognitive loop (interval: ${BEHAVIOR_CONFIG.thinkInterval}ms)`);
    
    // Run immediately once
    setTimeout(() => cognitiveLoop(), 2000);
    
    // Then run on interval
    cognitiveLoopInterval = setInterval(cognitiveLoop, BEHAVIOR_CONFIG.thinkInterval);
}

/**
 * Stop the cognitive loop
 */
function stopCognitiveLoop() {
    if (cognitiveLoopInterval) {
        clearInterval(cognitiveLoopInterval);
        cognitiveLoopInterval = null;
        logger.info('Cognitive loop stopped');
    }
}

/**
 * Graceful shutdown
 */
function shutdown() {
    logger.warn('Shutting down...');
    stopCognitiveLoop();
    
    if (bot) {
        bot.quit();
    }
    
    process.exit(0);
}

// Handle process termination
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error.message);
    console.error(error.stack);
    // Don't exit, try to keep running
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', reason);
    // Don't exit, try to keep running
});

// ============================================
// MAIN ENTRY POINT
// ============================================
async function main() {
    try {
        await createBot();
    } catch (error) {
        logger.error('Failed to start bot', error.message);
        process.exit(1);
    }
}

main();

