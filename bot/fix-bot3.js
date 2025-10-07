const fs = require('fs');
let content = fs.readFileSync('src/bot.ts', 'utf8');

// Use a flexible regex that handles trailing spaces
const pattern = /\s+\/\/ Create bot instance \(webhook mode, not polling\)\s+this\.bot = new TelegramBotAPI\(this\.token, \{\s*\n\s+polling: false,\s*\n\s+webHook: \{\s*\n\s+port: parseInt\(process\.env\.BOT_PORT \|\| '3003'\)\s*\n\s+\}\s*\n\s+\}\);/;

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

content = content.replace(pattern, newCode);
fs.writeFileSync('src/bot.ts', content, 'utf8');
console.log('[OK] Bot updated with regex');
