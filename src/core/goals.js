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
    const distantTable = findDistantCraftingTable(bot);
    
    logger.info(`📦 Inventory: ${inv.logs} logs, ${inv.planks} planks, ${inv.sticks} sticks, table: ${inv.hasCraftingTable ? 'inv' : 'no'}, nearby: ${nearbyTable ? 'yes' : 'no'}, pickaxe: ${inv.hasWoodenPickaxe}`);
    
    // GOAL 1: Get a wooden pickaxe
    if (!inv.hasWoodenPickaxe) {
        return getPickaxeAction(inv, nearbyTable, bot);
    }
    
    // GOAL 2: Get cobblestone (need pickaxe first)
    if (inv.hasWoodenPickaxe && inv.cobblestone < 8) {
        return { action: 'mine', target: 'stone', reason: 'Need cobblestone for tools' };
    }
    
    // GOAL 3: Need sticks for stone pickaxe
    if (inv.cobblestone >= 3 && inv.sticks < 2) {
        if (inv.planks >= 2) {
            return { action: 'craft', target: 'stick', reason: 'Need sticks for stone pickaxe' };
        } else if (inv.logs > 0) {
            const plankType = getPlankTypeFromLogs(inv);
            return { action: 'craft', target: plankType, reason: 'Need planks for sticks' };
        } else {
            const logType = findNearbyLogType(bot);
            return { action: 'mine', target: logType, reason: 'Need wood for sticks' };
        }
    }
    
    // GOAL 4: Get stone pickaxe
    if (inv.cobblestone >= 3 && inv.sticks >= 2 && !inv.hasStonePickaxe) {
        // Need crafting table nearby
        if (!nearbyTable) {
            if (inv.hasCraftingTable) {
                return { action: 'place', target: 'crafting_table', reason: 'Place table for stone pickaxe' };
            }
            const distantTable = findDistantCraftingTable(bot);
            if (distantTable) {
                return { action: 'goto', target: 'crafting_table', reason: 'Go to crafting table' };
            }
            // Need to make a new one
            if (inv.planks >= 4) {
                return { action: 'craft', target: 'crafting_table', reason: 'Need table for stone pickaxe' };
            }
        } else {
            return { action: 'craft', target: 'stone_pickaxe', reason: 'Upgrade to stone pickaxe!' };
        }
    }
    
    // GOAL 5: Get iron ore (need stone pickaxe)
    if (inv.hasStonePickaxe && inv.ironOre < 3) {
        return { action: 'mine', target: 'iron_ore', reason: 'Need iron for better tools' };
    }
    
    // GOAL 6: Keep mining cobblestone for furnace/building
    if (inv.hasStonePickaxe && inv.cobblestone < 20) {
        return { action: 'mine', target: 'stone', reason: 'Gathering cobblestone' };
    }
    
    // GOAL 7: Explore to find resources
    return { action: 'explore', target: 'random', reason: 'Looking for resources' };
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
    
    // Step 3: Need crafting table - but only craft if we don't have one AND there isn't one nearby
    if (!inv.hasCraftingTable && !nearbyTable && inv.planks >= 4) {
        return { action: 'craft', target: 'crafting_table', reason: 'Need crafting table for pickaxe' };
    }
    
    // Step 4: Place crafting table if we have one but none nearby
    if (inv.hasCraftingTable && !nearbyTable) {
        return { action: 'place', target: 'crafting_table', reason: 'Placing crafting table' };
    }
    
    // Step 5: If no crafting table nearby and we don't have one, find one in the world or get materials
    if (!nearbyTable && !inv.hasCraftingTable) {
        // Try to find a crafting table in the world (within 32 blocks)
        const distantTable = findDistantCraftingTable(bot);
        if (distantTable) {
            return { action: 'goto', target: 'crafting_table', reason: 'Going to crafting table' };
        }
        // Otherwise need to make one
        if (inv.planks < 4) {
            const logType = findNearbyLogType(bot);
            return { action: 'mine', target: logType, reason: 'Need wood for crafting table' };
        }
    }
    
    // Step 6: If we have materials for pickaxe but NO table nearby - GO TO one or make one
    if (inv.sticks >= 2 && inv.planks >= 3 && !nearbyTable) {
        // Check if there's a table somewhere we can go to
        const distantTable = findDistantCraftingTable(bot);
        if (distantTable) {
            return { action: 'goto', target: 'crafting_table', reason: 'Walking to crafting table' };
        }
        // If we have one in inventory, place it
        if (inv.hasCraftingTable) {
            return { action: 'place', target: 'crafting_table', reason: 'Placing table to craft pickaxe' };
        }
        // Otherwise we need to make one (need 4 planks)
        if (inv.planks >= 4) {
            return { action: 'craft', target: 'crafting_table', reason: 'Making table for pickaxe' };
        }
    }
    
    // Step 7: Make sticks (need 2 for pickaxe) - only if near table
    if (nearbyTable && inv.sticks < 2 && inv.planks >= 2) {
        return { action: 'craft', target: 'stick', reason: 'Need sticks for pickaxe' };
    }
    
    // Step 8: Make the pickaxe! - only if ACTUALLY near table
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
    let ironOre = 0;
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
        
        if (name === 'raw_iron' || name === 'iron_ore') {
            ironOre += item.count;
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
        ironOre,
        hasCraftingTable,
        hasWoodenPickaxe,
        hasStonePickaxe,
        logTypes
    };
}

/**
 * Find nearby crafting table (within 3 blocks - can use it)
 * Also checks if bot can actually see it (no blocks in between)
 */
function findNearbyCraftingTable(bot) {
    const mcData = bot.mcData;
    const craftingTableId = mcData.blocksByName['crafting_table']?.id;
    
    if (!craftingTableId) return null;
    
    const table = bot.findBlock({
        matching: craftingTableId,
        maxDistance: 3
    });
    
    // Verify we can actually reach it (not through walls)
    if (table) {
        const canSee = bot.canSeeBlock(table);
        if (!canSee) return null;
    }
    
    return table;
}

/**
 * Find distant crafting table (within 32 blocks - need to walk to it)
 * Only returns tables the bot can actually path to
 */
function findDistantCraftingTable(bot) {
    const mcData = bot.mcData;
    const craftingTableId = mcData.blocksByName['crafting_table']?.id;
    
    if (!craftingTableId) return null;
    
    // Find all tables within range
    const tables = bot.findBlocks({
        matching: craftingTableId,
        maxDistance: 32,
        count: 5
    });
    
    // Return the first one that bot can see (not through walls)
    for (const pos of tables) {
        const block = bot.blockAt(pos);
        if (block && bot.canSeeBlock(block)) {
            return block;
        }
    }
    
    return null;
}

// Export for use in actions.js
export { findDistantCraftingTable };

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

