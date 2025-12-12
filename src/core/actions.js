/**
 * MineBot Actions Module
 * ======================
 * Translates LLM decisions into Mineflayer actions
 */

import { logger } from '../utils/logger.js';
import { BEHAVIOR_CONFIG, LOG_CONFIG } from '../config.js';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals, Movements } = pathfinderPkg;

// Track current action state
let currentAction = null;
let isBusy = false;

/**
 * Check if the bot is currently busy with an action
 */
export function isExecuting() {
    return isBusy;
}

/**
 * Get the current action being executed
 */
export function getCurrentAction() {
    return currentAction;
}

/**
 * Set busy state
 */
function setBusy(action, busy) {
    isBusy = busy;
    currentAction = busy ? action : null;
}

/**
 * Execute a mining/block collection action
 */
async function executeMine(bot, target) {
    const mcData = bot.mcData;
    const blockType = mcData.blocksByName[target];
    
    if (!blockType) {
        throw new Error(`Unknown block type: ${target}`);
    }
    
    logger.action(`Mining: ${target}`);
    
    // Find the block
    const block = bot.findBlock({
        matching: blockType.id,
        maxDistance: BEHAVIOR_CONFIG.mining.maxDistance
    });
    
    if (!block) {
        throw new Error(`No ${target} found within ${BEHAVIOR_CONFIG.mining.maxDistance} blocks`);
    }
    
    // Use collectBlock plugin if available
    if (bot.collectBlock) {
        await bot.collectBlock.collect(block, {
            timeout: BEHAVIOR_CONFIG.mining.timeout
        });
    } else {
        // Fallback: pathfind and dig manually
        const { GoalNear } = goals;
        await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 2));
        await bot.dig(block);
    }
    
    logger.success(`Collected ${target}`);
    return { success: true };
}

/**
 * Execute a crafting action
 */
async function executeCraft(bot, target) {
    const mcData = bot.mcData;
    const item = mcData.itemsByName[target];
    
    if (!item) {
        throw new Error(`Unknown item: ${target}`);
    }
    
    logger.action(`Crafting: ${target}`);
    
    // Find crafting table first if needed for complex recipes
    let craftingTable = null;
    const tableBlock = bot.findBlock({
        matching: mcData.blocksByName.crafting_table.id,
        maxDistance: 32
    });
    
    if (tableBlock) {
        craftingTable = tableBlock;
        logger.info(`Found crafting table at ${tableBlock.position}`);
    }
    
    // Get recipes (with or without crafting table)
    const recipes = bot.recipesFor(item.id, null, 1, craftingTable);
    
    // Debug: log what we found
    logger.info(`Recipes found for ${target}: ${recipes ? recipes.length : 0}`);
    
    if (!recipes || recipes.length === 0) {
        // Try without crafting table
        const recipesNoTable = bot.recipesFor(item.id, null, 1, null);
        logger.info(`Recipes without table: ${recipesNoTable ? recipesNoTable.length : 0}`);
        
        if (!recipesNoTable || recipesNoTable.length === 0) {
            throw new Error(`Cannot craft ${target} with current inventory`);
        }
        // Use recipe without table
        await bot.craft(recipesNoTable[0], 1, null);
        logger.success(`Crafted ${target} (no table needed)`);
        return { success: true };
    }
    
    // Use the recipe we found (with crafting table context)
    const recipe = recipes[0];
    
    // If recipe requires table and we found one, move to it
    if (recipe.requiresTable && craftingTable) {
        logger.info(`Recipe requires table, moving to it...`);
        const { GoalNear } = goals;
        try {
            await bot.pathfinder.goto(new GoalNear(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 2));
        } catch (e) {
            logger.warn(`Could not path to crafting table: ${e.message}`);
        }
    }
    
    // Craft the item
    try {
        await bot.craft(recipe, 1, craftingTable);
        logger.success(`Crafted ${target}`);
        return { success: true };
    } catch (craftError) {
        logger.error(`Craft error: ${craftError.message}`);
        throw craftError;
    }
}

/**
 * Execute an exploration action
 */
async function executeExplore(bot) {
    logger.action('Exploring...');
    
    const { GoalXZ } = goals;
    
    // Generate random direction
    const angle = Math.random() * Math.PI * 2;
    const distance = BEHAVIOR_CONFIG.explore.maxDistance * (0.5 + Math.random() * 0.5);
    
    const targetX = Math.floor(bot.entity.position.x + Math.cos(angle) * distance);
    const targetZ = Math.floor(bot.entity.position.z + Math.sin(angle) * distance);
    
    logger.action(`Moving to X:${targetX}, Z:${targetZ}`);
    
    // Set up movements
    const defaultMove = new Movements(bot);
    defaultMove.allowSprinting = true;
    defaultMove.canDig = false; // Don't dig while exploring
    bot.pathfinder.setMovements(defaultMove);
    
    // Navigate with timeout
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Exploration timeout')), BEHAVIOR_CONFIG.explore.timeout);
    });
    
    const movePromise = bot.pathfinder.goto(new GoalXZ(targetX, targetZ));
    
    try {
        await Promise.race([movePromise, timeoutPromise]);
        logger.success('Exploration complete');
    } catch (error) {
        // Stop pathfinder on error
        bot.pathfinder.stop();
        
        if (error.message === 'Exploration timeout') {
            logger.warn('Exploration timed out, but that\'s OK');
        } else {
            throw error;
        }
    }
    
    return { success: true };
}

/**
 * Execute a combat action
 */
async function executeFight(bot, target) {
    logger.action(`Fighting: ${target}`);
    
    // Find the target entity
    const entity = Object.values(bot.entities).find(e => {
        if (!e || e === bot.entity) return false;
        const name = e.name || e.username;
        return name === target;
    });
    
    if (!entity) {
        throw new Error(`No ${target} found nearby`);
    }
    
    const distance = bot.entity.position.distanceTo(entity.position);
    
    if (distance > BEHAVIOR_CONFIG.pvp.attackRange * 4) {
        // Move closer first
        const { GoalNear } = goals;
        await bot.pathfinder.goto(new GoalNear(entity.position.x, entity.position.y, entity.position.z, 2));
    }
    
    // Equip best weapon
    const weapons = ['diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword'];
    for (const weapon of weapons) {
        const item = bot.inventory.items().find(i => i.name === weapon);
        if (item) {
            await bot.equip(item, 'hand');
            break;
        }
    }
    
    // Attack using PvP plugin if available
    if (bot.pvp) {
        bot.pvp.attack(entity);
        
        // Wait for combat to end (entity dies or moves away)
        await new Promise((resolve) => {
            const checkCombat = setInterval(() => {
                if (!entity.isValid || 
                    bot.entity.position.distanceTo(entity.position) > 20 ||
                    entity.health <= 0) {
                    clearInterval(checkCombat);
                    bot.pvp.stop();
                    resolve();
                }
            }, 500);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkCombat);
                bot.pvp.stop();
                resolve();
            }, 30000);
        });
    } else {
        // Manual attack
        await bot.attack(entity);
    }
    
    logger.success(`Combat with ${target} ended`);
    return { success: true };
}

/**
 * Execute an eat action
 */
async function executeEat(bot, target) {
    logger.action(`Eating: ${target || 'any food'}`);
    
    // Find food in inventory
    const foodItems = bot.inventory.items().filter(item => {
        if (target && item.name !== target) return false;
        return item.name.includes('cooked') || 
               item.name.includes('bread') || 
               item.name.includes('apple') ||
               item.name.includes('steak') ||
               item.name.includes('porkchop') ||
               item.name.includes('chicken') ||
               item.name.includes('mutton') ||
               item.name.includes('potato') ||
               item.name.includes('carrot') ||
               item.name.includes('melon') ||
               item.name.includes('berries') ||
               item.name.includes('rabbit');
    });
    
    if (foodItems.length === 0) {
        throw new Error('No food in inventory');
    }
    
    const food = foodItems[0];
    await bot.equip(food, 'hand');
    await bot.consume();
    
    logger.success(`Ate ${food.name}`);
    return { success: true };
}

/**
 * Execute a place block action
 */
async function executePlace(bot, target) {
    logger.action(`Placing: ${target}`);
    
    const mcData = bot.mcData;
    
    // Find the block in inventory
    const blockItem = bot.inventory.items().find(item => item.name === target);
    
    if (!blockItem) {
        throw new Error(`No ${target} in inventory`);
    }
    
    // Equip the block
    await bot.equip(blockItem, 'hand');
    
    // Find a suitable place to put it (near the bot, on the ground)
    const pos = bot.entity.position.floored();
    
    // Try to find a solid block to place on
    const placementSpots = [
        pos.offset(1, -1, 0),
        pos.offset(-1, -1, 0),
        pos.offset(0, -1, 1),
        pos.offset(0, -1, -1),
        pos.offset(1, 0, 0),
        pos.offset(-1, 0, 0),
        pos.offset(0, 0, 1),
        pos.offset(0, 0, -1),
    ];
    
    for (const spot of placementSpots) {
        const block = bot.blockAt(spot);
        if (block && block.name !== 'air' && block.name !== 'water' && block.name !== 'lava') {
            // Found a solid block, try to place on top or side
            const faceVectors = [
                { x: 0, y: 1, z: 0 },  // top
                { x: 1, y: 0, z: 0 },  // sides
                { x: -1, y: 0, z: 0 },
                { x: 0, y: 0, z: 1 },
                { x: 0, y: 0, z: -1 },
            ];
            
            for (const face of faceVectors) {
                try {
                    await bot.placeBlock(block, { x: face.x, y: face.y, z: face.z });
                    logger.success(`Placed ${target}`);
                    return { success: true };
                } catch (e) {
                    // Try next face
                    continue;
                }
            }
        }
    }
    
    throw new Error(`Could not find a place to put ${target}`);
}

/**
 * Execute a chat action
 */
async function executeChat(bot, message) {
    logger.action(`Sending chat: ${message}`);
    await bot.chat(message);
    return { success: true };
}

/**
 * Execute a wait action
 */
async function executeWait(bot) {
    logger.action('Waiting...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true };
}

/**
 * Execute a goto action (move to a specific block type)
 */
async function executeGoto(bot, target) {
    logger.action(`Going to: ${target}`);
    
    const mcData = bot.mcData;
    const blockType = mcData.blocksByName[target];
    
    if (!blockType) {
        throw new Error(`Unknown block type: ${target}`);
    }
    
    // Find the block
    const block = bot.findBlock({
        matching: blockType.id,
        maxDistance: 64
    });
    
    if (!block) {
        throw new Error(`No ${target} found nearby`);
    }
    
    // Move to the block
    const { GoalNear } = goals;
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    
    await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 2));
    
    logger.success(`Reached ${target}`);
    return { success: true };
}

/**
 * Main action executor
 * Routes LLM decisions to specific action handlers
 */
export async function executeAction(bot, decision) {
    const { action, target, reason } = decision;
    
    if (isBusy) {
        logger.warn('Bot is already busy, skipping action');
        return { success: false, error: 'Bot is busy' };
    }
    
    setBusy(action, true);
    
    const result = {
        action,
        target,
        success: false,
        error: null
    };
    
    try {
        if (LOG_CONFIG.debugActions) {
            logger.action(`Executing: ${action} → ${target}`, reason);
        }
        
        switch (action) {
            case 'mine':
                await executeMine(bot, target);
                result.success = true;
                break;
                
            case 'craft':
                await executeCraft(bot, target);
                result.success = true;
                break;
                
            case 'explore':
                await executeExplore(bot);
                result.success = true;
                break;
                
            case 'fight':
                await executeFight(bot, target);
                result.success = true;
                break;
                
            case 'place':
                await executePlace(bot, target);
                result.success = true;
                break;
                
            case 'eat':
                await executeEat(bot, target);
                result.success = true;
                break;
                
            case 'chat':
                await executeChat(bot, target);
                result.success = true;
                break;
                
            case 'wait':
                await executeWait(bot);
                result.success = true;
                break;
                
            case 'goto':
                await executeGoto(bot, target);
                result.success = true;
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
    } catch (error) {
        result.error = error.message;
        logger.error(`Action failed: ${action}`, error.message);
    } finally {
        setBusy(null, false);
    }
    
    return result;
}

export default { executeAction, isExecuting, getCurrentAction };

