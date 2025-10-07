const fs = require('fs');
const path = require('path');

const botPath = path.join(__dirname, 'src', 'bot.ts');
let content = fs.readFileSync(botPath, 'utf8');

// Old code to replace
const oldCode = `    // Create bot instance (webhook mode, not polling)
    this.bot = new TelegramBotAPI(this.token, {
      polling: false,
      webHook: {
        port: parseInt(process.env.BOT_PORT || '3003')
      }
    });`;

// New code with both modes
const newCode = `    // Determine bot mode: polling (development) or webhook (production)
    const botMode = process.env.BOT_MODE || 'webhook';
    const isPolling = botMode === 'polling';

    if (isPolling) {
      // Polling mode for development
      console.log('🔄 Bot starting in POLLING mode (development)');
      this.bot = new TelegramBotAPI(this.token, {
        polling: true
      });
    } else {
      // Webhook mode for production
      console.log('🌐 Bot starting in WEBHOOK mode (production)');
      this.bot = new TelegramBotAPI(this.token, {
        polling: false,
        webHook: {
          port: parseInt(process.env.BOT_PORT || '3003')
        }
      });
    }`;

// Replace the code
content = content.replace(oldCode, newCode);

// Write back
fs.writeFileSync(botPath, content, 'utf8');

console.log('✅ Bot patched successfully!');
console.log('📝 Added support for BOT_MODE environment variable');
console.log('   - Set BOT_MODE=polling for development');
console.log('   - Set BOT_MODE=webhook for production');
