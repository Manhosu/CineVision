const fs = require('fs');
const content = fs.readFileSync('src/bot.ts', 'utf8');

const oldCode = `    // Create bot instance (webhook mode, not polling)
    this.bot = new TelegramBotAPI(this.token, { 
      polling: false,
      webHook: {
        port: parseInt(process.env.BOT_PORT || '3003')
      }
    });`;

const newCode = `    // Determine bot mode: polling (development) or webhook (production)
    const botMode = process.env.BOT_MODE || 'webhook';
    const isPolling = botMode === 'polling';

    if (isPolling) {
      // Polling mode for development
      console.log('Bot starting in POLLING mode (development)');
      this.bot = new TelegramBotAPI(this.token, {
        polling: true
      });
    } else {
      // Webhook mode for production
      console.log('Bot starting in WEBHOOK mode (production)');
      this.bot = new TelegramBotAPI(this.token, {
        polling: false,
        webHook: {
          port: parseInt(process.env.BOT_PORT || '3003')
        }
      });
    }`;

const newContent = content.replace(oldCode, newCode);
fs.writeFileSync('src/bot.ts', newContent, 'utf8');
console.log('[OK] Bot mode switching added');
