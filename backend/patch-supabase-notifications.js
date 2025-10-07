const fs = require('fs');
let content = fs.readFileSync('src/modules/admin/services/admin-content.service.ts', 'utf8');

const oldCode = `    // Use SupabaseRestClient to create the content
    const result = await this.supabaseClient.insert('content', contentData);
    
    this.logger.log(\`Content created successfully with Supabase: \${(result[0] as any)?.id || 'unknown'}\`);
    return result[0];
  }`;

const newCode = `    // Use SupabaseRestClient to create the content
    const result = await this.supabaseClient.insert('content', contentData);
    const createdContent = result[0];

    this.logger.log(\`Content created successfully with Supabase: \${(createdContent as any)?.id || 'unknown'}\`);

    // Notify Telegram subscribers if content is published and bot service is available
    if (contentData.status === 'PUBLISHED' && this.botNotificationService) {
      try {
        const notifiedCount = await this.botNotificationService.notifyNewContent(
          createdContent as any,
          true, // throttle enabled
        );
        this.logger.log(\`Telegram notification sent to \${notifiedCount} subscribers for content \${(createdContent as any)?.id}\`);
      } catch (botError) {
        this.logger.error(\`Failed to send Telegram notifications: \${botError.message}\`);
        // Don't fail the creation if bot notification fails
      }
    }

    return createdContent;
  }`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('src/modules/admin/services/admin-content.service.ts', content, 'utf8');
console.log('[OK] Auto-broadcast added to Supabase content creation');
