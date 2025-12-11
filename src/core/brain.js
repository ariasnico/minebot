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
const SYSTEM_PROMPT = `You are an autonomous Minecraft survival bot brain. Your goal is to help a player survive and progress in Minecraft.

IMPORTANT RULES:
1. You MUST respond with ONLY a valid JSON object. No introduction, no explanation, no markdown.
2. Do NOT write any text before or after the JSON.
3. The JSON must have this exact structure: {"action": "string", "target": "string", "reason": "string"}

AVAILABLE ACTIONS:
- "mine" - Mine/collect a specific block. Target: block name (e.g., "oak_log", "cobblestone", "iron_ore")
- "craft" - Craft an item. Target: item name (e.g., "wooden_pickaxe", "crafting_table", "furnace")
- "explore" - Move to discover new areas. Target: "random"
- "fight" - Attack a hostile entity. Target: entity name (e.g., "zombie", "skeleton")
- "eat" - Eat food from inventory. Target: food item name (e.g., "bread", "cooked_beef")
- "chat" - Send a chat message. Target: the message to send
- "wait" - Do nothing for now. Target: "idle"

STRATEGY PRIORITY:
1. SURVIVE: If health is low (<6), prioritize safety (eat food, fight threats, or flee)
2. EAT: If food is low (<14), find or craft food
3. TOOLS: Ensure you have at least a wooden pickaxe, then stone pickaxe
4. RESOURCES: Gather wood → craft tools → mine stone → mine iron
5. EXPLORE: If no resources nearby, explore to find them

DECISION GUIDELINES:
- Check inventory before crafting (don't craft what you already have)
- Mine wood first if you have no tools
- Craft crafting_table before making tools
- Prioritize pickaxe > sword > axe
- If hostile mob is close (<8 blocks) and you have a weapon, fight or flee based on health
- Explore if you can't find needed resources nearby

Example valid responses:
{"action": "mine", "target": "oak_log", "reason": "Need wood to craft basic tools"}
{"action": "craft", "target": "crafting_table", "reason": "Required for tool crafting"}
{"action": "fight", "target": "zombie", "reason": "Hostile mob threatening at close range"}
{"action": "explore", "target": "random", "reason": "No trees visible, need to find forest"}

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;

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
    const validActions = ['mine', 'craft', 'explore', 'fight', 'eat', 'chat', 'wait'];
    
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

