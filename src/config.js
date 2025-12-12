/**
 * MineBot Configuration
 * =====================
 * Adjust these settings according to your setup
 */

// ============================================
// MINECRAFT CONNECTION
// ============================================
export const BOT_CONFIG = {
    // Bot username (for offline/cracked servers)
    username: 'MineBot',
    
    // Server connection
    host: 'localhost',
    port: 53676,
    
    // Minecraft version (set to specific version or null to auto-detect)
    // MAX SUPPORTED: 1.21.4 - Newer versions (1.21.10+) are NOT yet supported by mineflayer
    version: null,
    
    // Authentication (for premium servers)
    auth: 'offline', // 'microsoft' for premium accounts
};

// ============================================
// OLLAMA LLM CONFIGURATION
// ============================================
export const OLLAMA_CONFIG = {
    // Ollama API endpoint
    url: 'http://localhost:11434/api/generate',
    
    // Model to use (must be downloaded in Ollama)
    // Options: 'llama3.2', 'llama3.2:3b', 'mistral', 'mistral:7b', 'qwen2.5:7b'
    model: 'qwen2.5:7b',
    
    // Request timeout in milliseconds (increase for slower GPUs)
    timeout: 60000,
    
    // LLM generation parameters
    options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 256, // Max tokens to generate
    }
};

// ============================================
// BOT BEHAVIOR
// ============================================
export const BEHAVIOR_CONFIG = {
    // Cognitive loop interval (ms) - how often the bot "thinks"
    thinkInterval: 5000,
    
    // Combat settings
    pvp: {
        enabled: true,
        attackRange: 3,
        // Entities to fight when threatened
        hostileMobs: [
            'zombie', 'skeleton', 'spider', 'creeper', 
            'enderman', 'witch', 'pillager', 'vindicator',
            'drowned', 'husk', 'stray', 'phantom'
        ]
    },
    
    // Exploration settings
    explore: {
        maxDistance: 100,    // Max blocks to wander
        timeout: 30000       // Exploration timeout (ms)
    },
    
    // Mining settings
    mining: {
        maxDistance: 32,     // Max distance to search for blocks
        timeout: 60000       // Mining operation timeout (ms)
    },
    
    // Health thresholds
    health: {
        critical: 6,         // Health to trigger survival mode
        hungry: 14           // Food level to seek food
    }
};

// ============================================
// LOGGING
// ============================================
export const LOG_CONFIG = {
    // Show detailed LLM prompts/responses
    debugLLM: false,
    
    // Show perception data
    debugPerception: false,
    
    // Show action execution details
    debugActions: true
};

