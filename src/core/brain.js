/**
 * MineBot Brain Module
 * ====================
 * Handles communication with Ollama Local LLM for high-level decision making
 */

import axios from 'axios';
import { OLLAMA_CONFIG, LOG_CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * System prompt that defines the bot's persona and JSON output requirements
 */
const SYSTEM_PROMPT = `You are an autonomous Minecraft survival bot brain. Your goal is to survive and progress.

RULES:
1. Respond with ONLY a JSON object: {"action": "string", "target": "string", "reason": "string"}
2. No text before or after the JSON.

AVAILABLE ACTIONS:
- "mine" - Collect a block. Target: block name (oak_log, cobblestone, iron_ore, coal_ore)
- "craft" - Craft an item. Target: item name (see crafting guide below)
- "place" - Place a block from inventory. Target: block name (crafting_table, furnace, torch)
- "explore" - Walk to find resources. Target: "random"
- "fight" - Attack entity. Target: entity name (zombie, skeleton, spider)
- "eat" - Eat food. Target: food name (bread, cooked_beef, apple)
- "wait" - Do nothing. Target: "idle"

CRAFTING PROGRESSION (follow this order!):
1. Mine 3+ logs (oak_log, birch_log, etc.)
2. Craft planks: oak_log → oak_planks (gives 4 planks per log)
3. Craft sticks: oak_planks → stick (gives 4 sticks from 2 planks)
4. Craft crafting_table: 4 planks → crafting_table
5. PLACE the crafting_table: use "place" action with target "crafting_table"
6. Craft wooden_pickaxe: 3 planks + 2 sticks (needs nearby crafting_table!)
7. Mine cobblestone (need pickaxe!)
8. Craft stone_pickaxe: 3 cobblestone + 2 sticks
9. Mine iron_ore and coal_ore
10. Craft furnace: 8 cobblestone

CRITICAL RULES:
- You CANNOT craft tools without a crafting_table placed nearby!
- Check "CAN CRAFT" section - only craft items listed there
- If crafting fails, you're missing materials - gather more!
- Always check inventory before deciding
- Mine at least 3 logs before trying to craft anything
- If last action failed, try something different

PRIORITIES:
1. If health < 6: eat or flee
2. If no tools: follow crafting progression above
3. If have pickaxe: mine stone, then iron
4. If nothing nearby: explore

RESPOND WITH ONLY THE JSON.`;

/**
 * Clean LLM response to extract JSON
 * Handles common issues with local models adding extra text
 */
function cleanJsonResponse(text) {
    // Remove potential markdown code blocks
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Remove any text before the first {
    const firstBrace = text.indexOf('{');
    if (firstBrace > 0) {
        text = text.substring(firstBrace);
    }
    
    // Remove any text after the last }
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < text.length - 1) {
        text = text.substring(0, lastBrace + 1);
    }
    
    // Remove line breaks within the JSON
    text = text.replace(/\n/g, ' ').trim();
    
    return text;
}

/**
 * Validate that the response has the required structure
 */
function validateResponse(response) {
    const validActions = ['mine', 'craft', 'place', 'explore', 'fight', 'eat', 'chat', 'wait'];
    
    if (!response || typeof response !== 'object') {
        throw new Error('Response is not a valid object');
    }
    
    if (!response.action || typeof response.action !== 'string') {
        throw new Error('Missing or invalid "action" field');
    }
    
    if (!validActions.includes(response.action)) {
        throw new Error(`Invalid action: ${response.action}. Must be one of: ${validActions.join(', ')}`);
    }
    
    if (response.target === undefined) {
        response.target = '';
    }
    
    if (!response.reason) {
        response.reason = 'No reason provided';
    }
    
    return response;
}

/**
 * Query the Ollama LLM for a decision
 * @param {string} context - Formatted perception context
 * @returns {Promise<object>} - Decision object {action, target, reason}
 */
export async function think(context) {
    const prompt = `${SYSTEM_PROMPT}

CURRENT GAME STATE:
${context}

Based on the current state, what should I do next? Respond with ONLY the JSON object.`;

    if (LOG_CONFIG.debugLLM) {
        logger.debug('Sending prompt to LLM', { length: prompt.length });
    }

    try {
        const response = await axios.post(
            OLLAMA_CONFIG.url,
            {
                model: OLLAMA_CONFIG.model,
                prompt: prompt,
                stream: false,
                options: OLLAMA_CONFIG.options
            },
            {
                timeout: OLLAMA_CONFIG.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        const rawResponse = response.data.response;
        
        if (LOG_CONFIG.debugLLM) {
            logger.debug('Raw LLM response', rawResponse);
        }

        // Clean and parse the response
        const cleanedJson = cleanJsonResponse(rawResponse);
        
        let decision;
        try {
            decision = JSON.parse(cleanedJson);
        } catch (parseError) {
            logger.error('Failed to parse LLM response as JSON', {
                raw: rawResponse,
                cleaned: cleanedJson,
                error: parseError.message
            });
            
            // Return a safe fallback action
            return {
                action: 'wait',
                target: 'idle',
                reason: 'LLM response parsing failed, waiting for next cycle'
            };
        }

        // Validate the response structure
        const validatedDecision = validateResponse(decision);
        
        logger.brain(
            `Decision: ${validatedDecision.action.toUpperCase()} → ${validatedDecision.target}`,
            validatedDecision.reason
        );

        return validatedDecision;

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            logger.error('Cannot connect to Ollama. Is it running?', {
                url: OLLAMA_CONFIG.url,
                hint: 'Start Ollama with: ollama serve'
            });
        } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            logger.error('Ollama request timed out', {
                timeout: OLLAMA_CONFIG.timeout,
                hint: 'Increase timeout in config.js or use a faster model'
            });
        } else {
            logger.error('LLM request failed', error.message);
        }

        // Return a safe fallback
        return {
            action: 'wait',
            target: 'idle',
            reason: `LLM error: ${error.message}`
        };
    }
}

/**
 * Test connection to Ollama
 */
export async function testConnection() {
    try {
        const response = await axios.get('http://localhost:11434/api/tags', {
            timeout: 5000
        });
        
        const models = response.data.models || [];
        const modelNames = models.map(m => m.name);
        
        logger.success('Ollama connection OK', {
            availableModels: modelNames,
            usingModel: OLLAMA_CONFIG.model
        });
        
        if (!modelNames.some(m => m.startsWith(OLLAMA_CONFIG.model.split(':')[0]))) {
            logger.warn(`Model "${OLLAMA_CONFIG.model}" not found in Ollama`, {
                hint: `Run: ollama pull ${OLLAMA_CONFIG.model}`
            });
            return false;
        }
        
        return true;
    } catch (error) {
        logger.error('Failed to connect to Ollama', {
            url: 'http://localhost:11434',
            error: error.message,
            hint: 'Make sure Ollama is running: ollama serve'
        });
        return false;
    }
}

export default { think, testConnection };

