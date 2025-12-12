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
const SYSTEM_PROMPT = `You are a Minecraft survival bot. Output ONLY valid JSON.

FORMAT: {"action": "string", "target": "string", "reason": "string"}

ACTIONS:
- mine: Collect block (oak_log, birch_log, spruce_log, cobblestone, iron_ore)
- craft: Make item (oak_planks, stick, crafting_table, wooden_pickaxe)
- place: Put block down (crafting_table)
- explore: Walk around to find trees
- fight: Attack mob (zombie, skeleton)
- eat: Eat food (bread, apple)
- wait: Do nothing

ABSOLUTE RULES - READ CAREFULLY:
1. If inventory is EMPTY or has NO LOGS → action MUST be "mine" with target "oak_log" or "birch_log"
2. If you have logs but NO planks → craft planks first (e.g., "oak_planks")
3. If you have planks but NO sticks → craft "stick"
4. If you have planks but NO crafting_table → craft "crafting_table"
5. If you have crafting_table in inventory → action "place" target "crafting_table"
6. ONLY craft wooden_pickaxe if "crafting_table nearby: Yes" in the state
7. NEVER try to craft something not in "CAN CRAFT" list!
8. If last action FAILED → do something DIFFERENT

DECISION TREE (follow in order!):
1. Health < 5? → eat food OR wait (don't die!)
2. Have crafting_table in inventory? → PLACE IT IMMEDIATELY! action="place" target="crafting_table"
3. No wood in inventory? → mine oak_log or birch_log
4. Have logs, no planks? → craft oak_planks (or birch_planks)
5. Have planks, no sticks? → craft stick  
6. Have 4+ planks, no crafting_table? → craft crafting_table
7. Crafting table nearby + have sticks + planks? → craft wooden_pickaxe
8. Have pickaxe? → mine cobblestone
9. Nothing nearby to mine? → explore

SUPER IMPORTANT - FOLLOW THESE EXACTLY:
- If you see "🚨 CRITICAL" → COPY THE ACTION FROM "ACTION REQUIRED" EXACTLY!
- If "Crafting table nearby: YES" → Do NOT craft another crafting_table! Make sticks or pickaxe instead!
- If you have sticks AND planks AND crafting table nearby → CRAFT WOODEN_PICKAXE!
- If crafting table nearby but no sticks → craft stick first!
- Only craft ONE crafting_table, then PLACE it, then make TOOLS!

COMMON MISTAKES - DO NOT DO THESE:
- Do NOT craft multiple crafting_tables (you only need ONE)
- Do NOT keep crafting crafting_table after placing one
- Do NOT ignore the CRITICAL hints

COMMON MISTAKES TO AVOID:
- Do NOT craft sticks without planks in inventory
- Do NOT craft pickaxe without crafting_table PLACED nearby
- Do NOT explore if there are trees nearby - MINE THEM!
- Do NOT repeat failed actions - try something else!

JSON ONLY. NO OTHER TEXT.`;

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

