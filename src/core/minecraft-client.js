/**
 * Minecraft Client via HTTP
 * 
 * Replaces mineflayer - communicates with our Fabric mod
 * that runs inside Minecraft with Baritone
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

const MOD_URL = 'http://localhost:8080';

/**
 * Send a command to the Minecraft mod
 */
export async function sendCommand(action, target, reason = '') {
    try {
        const response = await axios.post(`${MOD_URL}/command`, {
            action,
            target,
            reason
        }, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        logger.action(`${action.toUpperCase()} → ${target}`);
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error('Minecraft mod not running. Make sure Minecraft is open with the MineBot mod installed.');
        }
        throw error;
    }
}

/**
 * Get current bot status
 */
export async function getStatus() {
    try {
        const response = await axios.get(`${MOD_URL}/status`, { timeout: 2000 });
        return response.data;
    } catch (error) {
        return { action: 'disconnected', busy: false };
    }
}

/**
 * Get player position
 */
export async function getPosition() {
    try {
        const response = await axios.get(`${MOD_URL}/position`, { timeout: 2000 });
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * Get player health
 */
export async function getHealth() {
    try {
        const response = await axios.get(`${MOD_URL}/health`, { timeout: 2000 });
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * Get inventory
 */
export async function getInventory() {
    try {
        const response = await axios.get(`${MOD_URL}/inventory`, { timeout: 2000 });
        return response.data;
    } catch (error) {
        return { items: [] };
    }
}

/**
 * Check if mod is connected
 */
export async function isConnected() {
    try {
        await axios.get(`${MOD_URL}/status`, { timeout: 1000 });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Wait for mod to be available
 */
export async function waitForConnection(maxWaitMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
        if (await isConnected()) {
            return true;
        }
        logger.info('Waiting for Minecraft mod connection...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return false;
}

/**
 * Execute action based on decision from LLM/goals
 */
export async function executeAction(decision) {
    const { action, target, reason } = decision;
    
    logger.action(`Executing: ${action} → ${target}`);
    logger.status('', reason, 'cyan');
    
    try {
        const result = await sendCommand(action, target, reason);
        
        if (result.success) {
            logger.success(`${action} started successfully`);
        } else {
            logger.error(`${action} failed: ${result.error}`);
        }
        
        return {
            action,
            success: result.success,
            error: result.error || null
        };
    } catch (error) {
        logger.error(`Action failed: ${error.message}`);
        return {
            action,
            success: false,
            error: error.message
        };
    }
}

/**
 * Stop current action
 */
export async function stopCurrentAction() {
    return sendCommand('stop', '', 'Stopping current action');
}

// Export all functions
export default {
    sendCommand,
    getStatus,
    getPosition,
    getHealth,
    getInventory,
    isConnected,
    waitForConnection,
    executeAction,
    stopCurrentAction
};

