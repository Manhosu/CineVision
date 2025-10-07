#!/usr/bin/env node

/**
 * Telegram Webhook Management Script
 *
 * Usage:
 *   node telegram-webhook-setup.js [action] [options]
 *
 * Actions:
 *   check       - Check current webhook status
 *   set <url>   - Set webhook URL (requires HTTPS)
 *   delete      - Delete webhook
 *
 * Examples:
 *   node telegram-webhook-setup.js check
 *   node telegram-webhook-setup.js set https://your-domain.com/api/v1/telegrams/webhook
 *   node telegram-webhook-setup.js delete
 */

const https = require('https');
const http = require('http');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN not found in .env file');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function checkWebhook() {
  console.log('🔍 Checking webhook status...\n');

  try {
    const response = await makeRequest('/getWebhookInfo');

    if (response.ok) {
      const info = response.result;

      console.log('📊 Webhook Information:');
      console.log('━'.repeat(60));
      console.log(`URL: ${info.url || '(not set)'}`);
      console.log(`Pending updates: ${info.pending_update_count || 0}`);
      console.log(`Last error date: ${info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : 'None'}`);
      console.log(`Last error message: ${info.last_error_message || 'None'}`);
      console.log(`Max connections: ${info.max_connections || 40}`);
      console.log(`Allowed updates: ${info.allowed_updates ? info.allowed_updates.join(', ') : 'All'}`);
      console.log('━'.repeat(60));

      if (!info.url) {
        console.log('\n⚠️  Webhook is not configured');
        console.log('💡 Tip: Use "node telegram-webhook-setup.js set <url>" to configure');
      } else {
        console.log('\n✅ Webhook is configured');
      }
    } else {
      console.error('❌ Error:', response.description);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

async function setWebhook(url) {
  if (!url) {
    console.error('❌ Error: Webhook URL is required');
    console.log('Usage: node telegram-webhook-setup.js set <url>');
    process.exit(1);
  }

  if (!url.startsWith('https://')) {
    console.error('❌ Error: Webhook URL must use HTTPS');
    process.exit(1);
  }

  console.log(`🔧 Setting webhook to: ${url}\n`);

  try {
    const payload = {
      url: url,
      allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
      drop_pending_updates: true,
    };

    if (WEBHOOK_SECRET) {
      payload.secret_token = WEBHOOK_SECRET;
      console.log('🔐 Using secret token for authentication');
    }

    const response = await makeRequest('/setWebhook', 'POST', payload);

    if (response.ok) {
      console.log('✅ Webhook configured successfully!');
      console.log('📝 Description:', response.description);

      // Verify the webhook
      console.log('\n🔍 Verifying configuration...');
      await checkWebhook();
    } else {
      console.error('❌ Error:', response.description);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

async function deleteWebhook() {
  console.log('🗑️  Deleting webhook...\n');

  try {
    const response = await makeRequest('/deleteWebhook?drop_pending_updates=true', 'POST');

    if (response.ok) {
      console.log('✅ Webhook deleted successfully!');
      console.log('📝 Description:', response.description);
    } else {
      console.error('❌ Error:', response.description);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

async function getBotInfo() {
  console.log('🤖 Getting bot information...\n');

  try {
    const response = await makeRequest('/getMe');

    if (response.ok) {
      const bot = response.result;
      console.log('📊 Bot Information:');
      console.log('━'.repeat(60));
      console.log(`ID: ${bot.id}`);
      console.log(`Name: ${bot.first_name}`);
      console.log(`Username: @${bot.username}`);
      console.log(`Can join groups: ${bot.can_join_groups}`);
      console.log(`Can read messages: ${bot.can_read_all_group_messages}`);
      console.log('━'.repeat(60));
    } else {
      console.error('❌ Error:', response.description);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Main execution
const action = process.argv[2];
const param = process.argv[3];

async function main() {
  console.log('\n🔷 Telegram Webhook Setup Tool 🔷\n');

  switch (action) {
    case 'check':
    case 'status':
      await checkWebhook();
      break;

    case 'set':
      await setWebhook(param);
      break;

    case 'delete':
    case 'remove':
      await deleteWebhook();
      break;

    case 'info':
      await getBotInfo();
      break;

    case 'help':
    default:
      console.log('Usage: node telegram-webhook-setup.js [action] [options]');
      console.log('');
      console.log('Actions:');
      console.log('  check              - Check current webhook status');
      console.log('  set <url>          - Set webhook URL (requires HTTPS)');
      console.log('  delete             - Delete webhook');
      console.log('  info               - Get bot information');
      console.log('');
      console.log('Examples:');
      console.log('  node telegram-webhook-setup.js check');
      console.log('  node telegram-webhook-setup.js set https://your-domain.com/api/v1/telegrams/webhook');
      console.log('  node telegram-webhook-setup.js delete');
      console.log('  node telegram-webhook-setup.js info');
      break;
  }

  console.log('');
}

main().catch(console.error);
