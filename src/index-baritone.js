/**
 * MineBot - Baritone Edition
 * 
 * Uses our Fabric mod with Baritone instead of mineflayer
 * This allows running on the latest Minecraft versions!
 */

import { logger } from './utils/logger.js';
import { OLLAMA_CONFIG, BEHAVIOR_CONFIG } from './config.js';
import { think } from './core/brain.js';
import minecraftClient from './core/minecraft-client.js';

// State
let isThinking = false;
let lastActionResult = null;
let cognitiveLoopInterval = null;

/**
 * Display startup banner
 */
function displayBanner() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ███╗   ███╗██╗███╗   ██╗███████╗██████╗  ██████╗ ████████╗ ║
║   ████╗ ████║██║████╗  ██║██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝ ║
║   ██╔████╔██║██║██╔██╗ ██║█████╗  ██████╔╝██║   ██║   ██║    ║
║   ██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ██╔══██╗██║   ██║   ██║    ║
║   ██║ ╚═╝ ██║██║██║ ╚████║███████╗██████╔╝╚██████╔╝   ██║    ║
║   ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═════╝  ╚═════╝    ╚═╝    ║
║                                                              ║
║          🚀 BARITONE EDITION - Any MC Version! 🚀            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

/**
 * Get perception from Minecraft mod
 */
async function getPerception() {
    const [status, position, health, inventory] = await Promise.all([
        minecraftClient.getStatus(),
        minecraftClient.getPosition(),
        minecraftClient.getHealth(),
        minecraftClient.getInventory()
    ]);
    
    return {
        status,
        position,
        health,
        inventory,
        lastAction: lastActionResult
    };
}

/**
 * Format perception for LLM
 */
function formatPerceptionForLLM(perception) {
    const { status, position, health, inventory, lastAction } = perception;
    
    let context = '=== CURRENT STATE ===\n';
    
    // Position
    if (position) {
        context += `Position: X:${Math.floor(position.x)} Y:${Math.floor(position.y)} Z:${Math.floor(position.z)}\n`;
    }
    
    // Health
    if (health) {
        context += `Health: ${health.health}/${health.maxHealth} | Food: ${health.food}/${health.maxFood}\n`;
    }
    
    // Status
    if (status) {
        context += `Current action: ${status.action}${status.target ? ` (${status.target})` : ''}\n`;
        context += `Busy: ${status.busy ? 'Yes' : 'No'}\n`;
    }
    
    // Inventory
    context += '\n=== INVENTORY ===\n';
    if (inventory && inventory.items && inventory.items.length > 0) {
        // Count items
        const itemCounts = {};
        for (const item of inventory.items) {
            itemCounts[item.item] = (itemCounts[item.item] || 0) + item.count;
        }
        
        for (const [item, count] of Object.entries(itemCounts)) {
            context += `- ${item}: ${count}\n`;
        }
    } else {
        context += '(empty)\n';
    }
    
    // Last action result
    if (lastAction) {
        context += `\n=== LAST ACTION ===\n`;
        context += `${lastAction.action}: ${lastAction.success ? 'SUCCESS' : 'FAILED'}`;
        if (lastAction.error) {
            context += ` (${lastAction.error})`;
        }
        context += '\n';
    }
    
    // Add hints based on inventory
    context += '\n=== HINTS ===\n';
    
    if (!inventory || !inventory.items || inventory.items.length === 0) {
        context += '⚠️ Inventory empty! Mine some wood first (oak_log, birch_log)\n';
    }
    
    return context;
}

/**
 * Main cognitive loop
 */
async function cognitiveLoop() {
    // Skip if already thinking
    if (isThinking) return;
    
    // Check if busy with current action
    const status = await minecraftClient.getStatus();
    if (status.busy) {
        logger.info(`Still busy: ${status.action} → ${status.target}`);
        return;
    }
    
    try {
        isThinking = true;
        
        // 1. PERCEIVE
        const perception = await getPerception();
        const context = formatPerceptionForLLM(perception);
        
        // 2. THINK (LLM decides)
        logger.brain('Thinking...');
        const decision = await think(context);
        
        logger.brain(`Decision: ${decision.action.toUpperCase()} → ${decision.target}`);
        logger.status('', decision.reason, 'cyan');
        
        // 3. ACT
        if (decision.action !== 'wait') {
            lastActionResult = await minecraftClient.executeAction(decision);
        } else {
            lastActionResult = { action: 'wait', success: true };
        }
        
    } catch (error) {
        logger.error('Cognitive loop error:', error.message);
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
        clearInterval(cognitiveLoopInterval);
    }
    
    logger.info(`Starting cognitive loop (interval: ${BEHAVIOR_CONFIG.thinkInterval}ms)`);
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
 * Main entry point
 */
async function main() {
    displayBanner();
    
    console.log('────────────────────────────────────────────────────────────');
    logger.info('Starting MineBot (Baritone Edition)...');
    logger.info(`  • LLM Model: ${OLLAMA_CONFIG.model}`);
    logger.info(`  • Mod URL: http://localhost:8080`);
    console.log('────────────────────────────────────────────────────────────');
    
    // Wait for Minecraft mod to be available
    logger.info('Connecting to Minecraft mod...');
    const connected = await minecraftClient.waitForConnection(60000);
    
    if (!connected) {
        logger.error('Could not connect to Minecraft mod!');
        logger.error('Make sure:');
        logger.error('  1. Minecraft is running with the MineBot mod');
        logger.error('  2. You are in a world (not main menu)');
        process.exit(1);
    }
    
    logger.success('Connected to Minecraft!');
    
    // Get initial status
    const position = await minecraftClient.getPosition();
    if (position) {
        logger.success(`Player position: X:${Math.floor(position.x)} Y:${Math.floor(position.y)} Z:${Math.floor(position.z)}`);
    }
    
    // Start cognitive loop
    startCognitiveLoop();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.warn('Shutting down...');
        stopCognitiveLoop();
        await minecraftClient.stopCurrentAction();
        process.exit(0);
    });
}

// Run
main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});

