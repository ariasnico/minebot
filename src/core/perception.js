/**
 * MineBot Perception Module
 * =========================
 * Gathers and formats environmental context for the LLM
 */

import { logger } from '../utils/logger.js';
import { LOG_CONFIG, BEHAVIOR_CONFIG } from '../config.js';

/**
 * Get the current time of day in Minecraft
 */
function getTimeOfDay(bot) {
    const time = bot.time.timeOfDay;
    if (time >= 0 && time < 6000) return 'morning';
    if (time >= 6000 && time < 12000) return 'day';
    if (time >= 12000 && time < 13000) return 'sunset';
    if (time >= 13000 && time < 23000) return 'night';
    return 'dawn';
}

/**
 * Get simplified inventory summary
 */
function getInventorySummary(bot) {
    const items = {};
    
    for (const item of bot.inventory.items()) {
        const name = item.name;
        items[name] = (items[name] || 0) + item.count;
    }
    
    // Categorize items
    const summary = {
        tools: [],
        weapons: [],
        food: [],
        blocks: [],
        materials: [],
        armor: []
    };
    
    const toolTypes = ['pickaxe', 'axe', 'shovel', 'hoe'];
    const weaponTypes = ['sword', 'bow', 'crossbow', 'trident'];
    const foodItems = ['bread', 'cooked', 'apple', 'steak', 'porkchop', 'chicken', 'mutton', 'rabbit', 'potato', 'carrot', 'melon', 'berries'];
    const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
    
    for (const [name, count] of Object.entries(items)) {
        const entry = `${name}:${count}`;
        
        if (toolTypes.some(t => name.includes(t))) {
            summary.tools.push(entry);
        } else if (weaponTypes.some(w => name.includes(w))) {
            summary.weapons.push(entry);
        } else if (foodItems.some(f => name.includes(f))) {
            summary.food.push(entry);
        } else if (armorTypes.some(a => name.includes(a))) {
            summary.armor.push(entry);
        } else if (name.includes('_log') || name.includes('_planks') || name.includes('cobblestone') || name.includes('dirt') || name.includes('stone')) {
            summary.blocks.push(entry);
        } else {
            summary.materials.push(entry);
        }
    }
    
    return summary;
}

/**
 * Get nearby entities (mobs, players)
 */
function getNearbyEntities(bot) {
    const entities = {
        hostile: [],
        passive: [],
        players: []
    };
    
    const hostileMobs = BEHAVIOR_CONFIG.pvp.hostileMobs;
    const passiveMobs = ['cow', 'pig', 'sheep', 'chicken', 'rabbit', 'horse', 'donkey', 'llama', 'villager'];
    
    for (const entity of Object.values(bot.entities)) {
        if (!entity || entity === bot.entity) continue;
        
        const distance = bot.entity.position.distanceTo(entity.position);
        if (distance > 32) continue;
        
        const name = entity.name || entity.username || 'unknown';
        const entry = {
            name,
            distance: Math.round(distance),
            health: entity.health || 'unknown'
        };
        
        if (entity.type === 'player') {
            entities.players.push(entry);
        } else if (hostileMobs.includes(name)) {
            entities.hostile.push(entry);
        } else if (passiveMobs.includes(name)) {
            entities.passive.push(entry);
        }
    }
    
    // Sort by distance
    entities.hostile.sort((a, b) => a.distance - b.distance);
    entities.passive.sort((a, b) => a.distance - b.distance);
    entities.players.sort((a, b) => a.distance - b.distance);
    
    // Limit to closest
    entities.hostile = entities.hostile.slice(0, 5);
    entities.passive = entities.passive.slice(0, 5);
    
    return entities;
}

/**
 * Get nearby important blocks
 */
function getNearbyBlocks(bot) {
    const mcData = bot.mcData;
    const blocks = {
        ores: [],
        wood: [],
        water: false,
        lava: false,
        crafting_table: false,
        furnace: false,
        chest: false
    };
    
    const oreTypes = ['coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'copper_ore', 'lapis_ore', 'redstone_ore', 'emerald_ore', 'deepslate'];
    const woodTypes = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'];
    
    const pos = bot.entity.position;
    const range = 16;
    
    // Check for nearby blocks
    for (let x = -range; x <= range; x++) {
        for (let y = -range; y <= range; y++) {
            for (let z = -range; z <= range; z++) {
                const block = bot.blockAt(pos.offset(x, y, z));
                if (!block) continue;
                
                const name = block.name;
                
                if (oreTypes.some(ore => name.includes(ore))) {
                    const existing = blocks.ores.find(o => o.name === name);
                    if (existing) {
                        existing.count++;
                    } else {
                        blocks.ores.push({ name, count: 1 });
                    }
                } else if (woodTypes.includes(name)) {
                    const existing = blocks.wood.find(w => w.name === name);
                    if (existing) {
                        existing.count++;
                    } else {
                        blocks.wood.push({ name, count: 1 });
                    }
                } else if (name === 'water') {
                    blocks.water = true;
                } else if (name === 'lava') {
                    blocks.lava = true;
                } else if (name === 'crafting_table') {
                    blocks.crafting_table = true;
                } else if (name === 'furnace') {
                    blocks.furnace = true;
                } else if (name === 'chest') {
                    blocks.chest = true;
                }
            }
        }
    }
    
    return blocks;
}

/**
 * Check what the bot can craft with current inventory
 */
function getCraftableItems(bot) {
    const craftable = [];
    const mcData = bot.mcData;
    
    // Priority items to check
    const priorityItems = [
        'crafting_table', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe',
        'wooden_sword', 'stone_sword', 'iron_sword', 'diamond_sword',
        'wooden_axe', 'stone_axe', 'iron_axe',
        'furnace', 'chest', 'torch', 'stick', 'oak_planks', 'spruce_planks', 'birch_planks'
    ];
    
    for (const itemName of priorityItems) {
        const item = mcData.itemsByName[itemName];
        if (!item) continue;
        
        const recipes = bot.recipesFor(item.id);
        if (recipes && recipes.length > 0) {
            craftable.push(itemName);
        }
    }
    
    return craftable;
}

/**
 * Generate full perception context for the LLM
 */
export function perceive(bot, lastAction = null) {
    const perception = {
        // Bot status
        status: {
            health: Math.round(bot.health),
            maxHealth: 20,
            food: Math.round(bot.food),
            maxFood: 20,
            saturation: Math.round(bot.foodSaturation),
            oxygen: bot.oxygenLevel,
            position: {
                x: Math.round(bot.entity.position.x),
                y: Math.round(bot.entity.position.y),
                z: Math.round(bot.entity.position.z)
            },
            biome: bot.world.biome?.name || 'unknown'
        },
        
        // Time and weather
        world: {
            time: getTimeOfDay(bot),
            isRaining: bot.isRaining,
            dimension: bot.game.dimension
        },
        
        // Inventory
        inventory: getInventorySummary(bot),
        
        // Nearby stuff
        nearby: {
            entities: getNearbyEntities(bot),
            blocks: getNearbyBlocks(bot)
        },
        
        // What can be crafted
        craftable: getCraftableItems(bot),
        
        // Last action result
        lastAction: lastAction
    };
    
    if (LOG_CONFIG.debugPerception) {
        logger.perception('World state gathered', perception);
    }
    
    return perception;
}

/**
 * Format perception as a concise string for the LLM prompt
 */
export function formatPerceptionForLLM(perception) {
    const p = perception;
    
    // Check if inventory is essentially empty
    const hasLogs = p.inventory.blocks.some(b => b.includes('log'));
    const hasPlanks = p.inventory.blocks.some(b => b.includes('planks'));
    const hasSticks = p.inventory.materials.some(m => m.includes('stick'));
    const hasCraftingTable = p.inventory.blocks.some(b => b.includes('crafting_table'));
    const totalItems = p.inventory.tools.length + p.inventory.weapons.length + 
                       p.inventory.food.length + p.inventory.blocks.length + 
                       p.inventory.materials.length;
    
    let context = `=== STATUS ===
Health: ${p.status.health}/20 ${p.status.health < 6 ? '⚠️ LOW!' : ''}
Food: ${p.status.food}/20

=== INVENTORY (${totalItems === 0 ? 'EMPTY!' : totalItems + ' items'}) ===
Logs: ${hasLogs ? p.inventory.blocks.filter(b => b.includes('log')).join(', ') : 'NONE - NEED TO MINE TREES!'}
Planks: ${hasPlanks ? p.inventory.blocks.filter(b => b.includes('planks')).join(', ') : 'None'}
Sticks: ${hasSticks ? p.inventory.materials.filter(m => m.includes('stick')).join(', ') : 'None'}
Crafting Table: ${hasCraftingTable ? 'Yes (in inventory - need to PLACE it!)' : 'No'}
Tools: ${p.inventory.tools.length > 0 ? p.inventory.tools.join(', ') : 'None'}
Weapons: ${p.inventory.weapons.length > 0 ? p.inventory.weapons.join(', ') : 'None'}
Food: ${p.inventory.food.length > 0 ? p.inventory.food.join(', ') : 'None'}
Other: ${p.inventory.materials.filter(m => !m.includes('stick')).join(', ') || 'None'}

=== NEARBY ===
Trees: ${p.nearby.blocks.wood.length > 0 ? p.nearby.blocks.wood.map(w => `${w.name}:${w.count}`).join(', ') : 'None visible'}
Crafting table nearby: ${p.nearby.blocks.crafting_table ? 'YES ✓' : 'No'}
Hostile Mobs: ${p.nearby.entities.hostile.length > 0 ? p.nearby.entities.hostile.map(e => `${e.name}(${e.distance}m)`).join(', ') : 'None'}
Ores: ${p.nearby.blocks.ores.length > 0 ? p.nearby.blocks.ores.map(o => `${o.name}:${o.count}`).join(', ') : 'None'}

=== CAN CRAFT (only these!) ===
${p.craftable.length > 0 ? p.craftable.join(', ') : 'NOTHING - need materials first!'}`;

    if (p.lastAction) {
        context += `\n\n=== LAST ACTION ===
${p.lastAction.action} → ${p.lastAction.target || 'N/A'}: ${p.lastAction.success ? 'SUCCESS ✓' : 'FAILED ✗'}
${p.lastAction.error ? `Reason: ${p.lastAction.error}` : ''}`;
    }
    
    // Add hints based on current state
    if (totalItems === 0 || (!hasLogs && !hasPlanks)) {
        context += `\n\n⚠️ HINT: Inventory empty! You MUST mine wood first (oak_log, birch_log, etc.)`;
    } else if (hasLogs && !hasPlanks) {
        context += `\n\n⚠️ HINT: You have logs! Craft them into planks.`;
    } else if (hasPlanks && !hasSticks) {
        context += `\n\n⚠️ HINT: You have planks! Craft sticks.`;
    } else if (hasPlanks && !hasCraftingTable && !p.nearby.blocks.crafting_table) {
        context += `\n\n⚠️ HINT: Craft a crafting_table!`;
    } else if (hasCraftingTable && !p.nearby.blocks.crafting_table) {
        context += `\n\n⚠️ HINT: Place the crafting_table! Use action "place" with target "crafting_table"`;
    }
    
    return context;
}

export default { perceive, formatPerceptionForLLM };

