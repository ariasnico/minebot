/**
 * MineBot Logger
 * ==============
 * Beautiful console logging with colors and formatting
 */

import chalk from 'chalk';

// Log level colors and icons
const LEVELS = {
    info: { color: chalk.blue, icon: 'ℹ', label: 'INFO' },
    success: { color: chalk.green, icon: '✓', label: 'SUCCESS' },
    warn: { color: chalk.yellow, icon: '⚠', label: 'WARN' },
    error: { color: chalk.red, icon: '✗', label: 'ERROR' },
    brain: { color: chalk.magenta, icon: '🧠', label: 'BRAIN' },
    action: { color: chalk.cyan, icon: '⚡', label: 'ACTION' },
    perception: { color: chalk.gray, icon: '👁', label: 'PERCEPT' },
    chat: { color: chalk.white, icon: '💬', label: 'CHAT' },
    debug: { color: chalk.gray, icon: '🔧', label: 'DEBUG' }
};

/**
 * Get formatted timestamp
 */
function getTimestamp() {
    const now = new Date();
    return chalk.gray(
        `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`
    );
}

/**
 * Format and print a log message
 */
function log(level, message, data = null) {
    const config = LEVELS[level] || LEVELS.info;
    const timestamp = getTimestamp();
    const label = config.color(`[${config.label}]`);
    const icon = config.icon;
    
    let output = `${timestamp} ${icon} ${label} ${message}`;
    
    console.log(output);
    
    if (data !== null) {
        if (typeof data === 'object') {
            console.log(chalk.gray('   └─'), data);
        } else {
            console.log(chalk.gray(`   └─ ${data}`));
        }
    }
}

// Export individual log functions
export const logger = {
    info: (msg, data) => log('info', msg, data),
    success: (msg, data) => log('success', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
    brain: (msg, data) => log('brain', msg, data),
    action: (msg, data) => log('action', msg, data),
    perception: (msg, data) => log('perception', msg, data),
    chat: (msg, data) => log('chat', msg, data),
    debug: (msg, data) => log('debug', msg, data),
    
    // Special formatted outputs
    banner: () => {
        console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ███╗   ███╗██╗███╗   ██╗███████╗██████╗  ██████╗ ████████╗ ║
║   ████╗ ████║██║████╗  ██║██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝ ║
║   ██╔████╔██║██║██╔██╗ ██║█████╗  ██████╔╝██║   ██║   ██║    ║
║   ██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ██╔══██╗██║   ██║   ██║    ║
║   ██║ ╚═╝ ██║██║██║ ╚████║███████╗██████╔╝╚██████╔╝   ██║    ║
║   ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═════╝  ╚═════╝    ╚═╝    ║
║                                                              ║
║          Autonomous Minecraft Bot + Local LLM                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        `));
    },
    
    divider: () => {
        console.log(chalk.gray('─'.repeat(60)));
    },
    
    status: (label, value, color = 'white') => {
        const colorFn = chalk[color] || chalk.white;
        console.log(`  ${chalk.gray('•')} ${chalk.gray(label + ':')} ${colorFn(value)}`);
    }
};

export default logger;

