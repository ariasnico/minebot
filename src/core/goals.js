/**
 * GOALS SYSTEM - Deterministic decision making
 * =============================================
 * 
 * This replaces the LLM for basic survival progression.
 * The LLM is only used for complex decisions.
 */

import logger from '../utils/logger.js';

/**
 * Analyze inventory and determine the next action deterministically
 * @param {Object} bot - Mineflayer bot
 * @returns {Object|null} - Action to take, or null if LLM should decide
 */
export function getNextAction(bot) {
    const inv = analyzeInventory(bot);
    const nearbyTable = findNearbyCraftingTable(bot);
    
    logger.info(`📦 Inventory: ${inv.logs} logs, ${inv.planks} planks, ${inv.sticks} sticks, pickaxe: ${inv.hasWoodenPickaxe}`);
    
    // GOAL 1: Get a wooden pickaxe
    if (!inv.hasWoodenPickaxe) {
        return getPickaxeAction(inv, nearbyTable, bot);
    }
    
    // GOAL 2: Get cobblestone (need pickaxe first)
    if (inv.hasWoodenPickaxe && inv.cobblestone < 3) {
        return { action: 'mine', target: 'stone', reason: 'Need cobblestone for stone pickaxe' };
    }
    
    // GOAL 3: Get stone pickaxe
    if (inv.cobblestone >= 3 && inv.sticks >= 2 && nearbyTable && !inv.hasStonePickaxe) {
        return { action: 'craft', target: 'stone_pickaxe', reason: 'Upgrade to stone pickaxe' };
    }
    
    // If we have basic tools, let LLM decide what to do next
    return null;
}

/**
 * Determine action needed to get wooden pickaxe
 */
function getPickaxeAction(inv, nearbyTable, bot) {
    // Step 1: Need logs first
    if (inv.logs === 0 && inv.planks < 3) {
        const logType = findNearbyLogType(bot);
        return { action: 'mine', target: logType, reason: 'Need wood for tools' };
    }
    
    // Step 2: Convert logs to planks (need at least 3 for pickaxe + some for sticks)
    if (inv.logs > 0 && inv.planks < 5) {
        const plankType = getPlankTypeFromLogs(inv);
        return { action: 'craft', target: plankType, reason: 'Converting logs to planks' };
    }
    
    // Step 3: Need crafting table
    if (!inv.hasCraftingTable && inv.planks >= 4) {
        return { action: 'craft', target: 'crafting_table', reason: 'Need crafting table for pickaxe' };
    }
    
    // Step 4: Place crafting table
    if (inv.hasCraftingTable && !nearbyTable) {
        return { action: 'place', target: 'crafting_table', reason: 'Placing crafting table' };
    }
    
    // Step 5: Make sticks (need 2 for pickaxe)
    if (nearbyTable && inv.sticks < 2 && inv.planks >= 2) {
        return { action: 'craft', target: 'stick', reason: 'Need sticks for pickaxe' };
    }
    
    // Step 6: Make the pickaxe!
    if (nearbyTable && inv.sticks >= 2 && inv.planks >= 3) {
        return { action: 'craft', target: 'wooden_pickaxe', reason: 'Crafting wooden pickaxe!' };
    }
    
    // Need more materials
    if (inv.planks < 5 || inv.sticks < 2) {
        const logType = findNearbyLogType(bot);
        return { action: 'mine', target: logType, reason: 'Need more wood' };
    }
    
    return null;
}

/**
 * Analyze bot inventory
 */
function analyzeInventory(bot) {
    const items = bot.inventory.items();
    
    let logs = 0;
    let planks = 0;
    let sticks = 0;
    let cobblestone = 0;
    let hasCraftingTable = false;
    let hasWoodenPickaxe = false;
    let hasStonePickaxe = false;
    let logTypes = [];
    
    for (const item of items) {
        const name = item.name;
        
        if (name.includes('_log') || name === 'oak_log' || name === 'birch_log' || 
            name === 'spruce_log' || name === 'jungle_log' || name === 'acacia_log' || 
            name === 'dark_oak_log' || name === 'mangrove_log' || name === 'cherry_log') {
            logs += item.count;
            if (!logTypes.includes(name)) logTypes.push(name);
        }
        
        if (name.includes('_planks')) {
            planks += item.count;
        }
        
        if (name === 'stick') {
            sticks += item.count;
        }
        
        if (name === 'cobblestone') {
            cobblestone += item.count;
        }
        
        if (name === 'crafting_table') {
            hasCraftingTable = true;
        }
        
        if (name === 'wooden_pickaxe') {
            hasWoodenPickaxe = true;
        }
        
        if (name === 'stone_pickaxe') {
            hasStonePickaxe = true;
        }
    }
    
    return {
        logs,
        planks,
        sticks,
        cobblestone,
        hasCraftingTable,
        hasWoodenPickaxe,
        hasStonePickaxe,
        logTypes
    };
}

/**
 * Find nearby crafting table
 */
function findNearbyCraftingTable(bot) {
    const mcData = bot.mcData;
    const craftingTableId = mcData.blocksByName['crafting_table']?.id;
    
    if (!craftingTableId) return null;
    
    return bot.findBlock({
        matching: craftingTableId,
        maxDistance: 4
    });
}

/**
 * Find what type of log is nearby
 */
function findNearbyLogType(bot) {
    const mcData = bot.mcData;
    const logTypes = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'cherry_log', 'mangrove_log'];
    
    for (const logType of logTypes) {
        const logId = mcData.blocksByName[logType]?.id;
        if (logId) {
            const block = bot.findBlock({
                matching: logId,
                maxDistance: 32
            });
            if (block) return logType;
        }
    }
    
    return 'oak_log'; // default
}

/**
 * Get plank type from logs in inventory
 */
function getPlankTypeFromLogs(inv) {
    if (inv.logTypes.length === 0) return 'oak_planks';
    
    const logType = inv.logTypes[0];
    const woodType = logType.replace('_log', '');
    return `${woodType}_planks`;
}

export default { getNextAction };

