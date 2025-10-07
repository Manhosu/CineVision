#!/usr/bin/env python3
import re

# Read the file
with open('src/bot.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Old code pattern
old_pattern = r'''    // Create bot instance \(webhook mode, not polling\)
    this\.bot = new TelegramBotAPI\(this\.token, \{
      polling: false,
      webHook: \{
        port: parseInt\(process\.env\.BOT_PORT \|\| '3003'\)
      \}
    \}\);'''

# New code
new_code = '''    // Determine bot mode: polling (development) or webhook (production)
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
    }'''

# Replace
content = re.sub(old_pattern, new_code, content)

# Write back
with open('src/bot.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Bot updated successfully!')
print('📝 Added support for BOT_MODE environment variable')
