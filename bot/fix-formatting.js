const fs = require('fs');
let content = fs.readFileSync('src/bot.ts', 'utf8');
content = content.replace(
  '}    // Determine bot mode',
  '}\n\n    // Determine bot mode'
);
fs.writeFileSync('src/bot.ts', content, 'utf8');
console.log('[OK] Formatting fixed');
