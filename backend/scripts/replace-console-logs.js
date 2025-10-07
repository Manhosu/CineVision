/**
 * Script para substituir console.log por Winston Logger
 *
 * Uso: node scripts/replace-console-logs.js
 */

const fs = require('fs');
const path = require('path');

// Arquivos que precisam ser atualizados
const filesToUpdate = [
  'src/main.ts',
  'src/app.module.ts',
  'src/modules/supabase/controllers/supabase-auth.controller.ts',
  'src/modules/admin/services/admin-content-simple.service.ts',
  'src/modules/admin/services/admin-content.service.ts',
  'src/modules/admin/controllers/admin-content.controller.ts',
  'src/modules/admin/admin.module.ts',
  'src/config/supabase-connection.ts',
  'src/config/ipv6-proxy.ts',
  'src/config/typeorm-optional.helper.ts',
  'src/config/dns-config.ts',
  'src/health/health.controller.ts',
  'src/modules/content/content.module.ts',
  'src/config/database-connection.ts',
  'src/modules/admin/services/admin-purchases-simple.service.ts',
  'src/modules/purchases/purchases.service.ts',
  'src/database/seeds/run-seeds.ts',
];

// Padrões de substituição
const patterns = [
  {
    // console.log() -> this.logger.log()
    regex: /console\.log\((.*?)\);?/g,
    replacement: 'this.logger.log($1);',
  },
  {
    // console.error() -> this.logger.error()
    regex: /console\.error\((.*?)\);?/g,
    replacement: 'this.logger.error($1);',
  },
  {
    // console.warn() -> this.logger.warn()
    regex: /console\.warn\((.*?)\);?/g,
    replacement: 'this.logger.warn($1);',
  },
  {
    // console.debug() -> this.logger.debug()
    regex: /console\.debug\((.*?)\);?/g,
    replacement: 'this.logger.debug($1);',
  },
  {
    // console.info() -> this.logger.log()
    regex: /console\.info\((.*?)\);?/g,
    replacement: 'this.logger.log($1);',
  },
];

function processFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  let modified = false;

  // Verificar se já importa Logger
  const hasLoggerImport = content.includes('import { Logger }') || content.includes('LoggerService');
  const hasLoggerField = content.includes('private readonly logger') || content.includes('private logger');

  // Se não tem Logger, adicionar importação
  if (!hasLoggerImport && !hasLoggerField) {
    // Para arquivos NestJS (Controllers/Services)
    if (content.includes('@Injectable()') || content.includes('@Controller')) {
      content = content.replace(
        /(import .* from '@nestjs\/common';)/,
        `$1\nimport { LoggerService } from '../../../common/logger/logger.service';`
      );
      modified = true;
    }
    // Para main.ts
    else if (filePath.includes('main.ts')) {
      content = content.replace(
        /(import .* from '@nestjs\/core';)/,
        `$1\nimport { LoggerService } from './common/logger/logger.service';`
      );
      modified = true;
    }
  }

  // Adicionar logger no constructor se for classe
  if (content.includes('constructor(') && !hasLoggerField) {
    content = content.replace(
      /constructor\(([\s\S]*?)\) \{/,
      (match, params) => {
        const newParams = params.trim()
          ? `${params},\n    private readonly logger: LoggerService,`
          : 'private readonly logger: LoggerService,';
        return `constructor(${newParams}) {`;
      }
    );
    modified = true;

    // Adicionar setContext após constructor
    const className = content.match(/(?:export )?class (\w+)/)?.[1];
    if (className) {
      content = content.replace(
        /constructor\([^)]*\) \{/,
        `constructor($&\n    this.logger.setContext('${className}');`
      );
    }
  }

  // Aplicar padrões de substituição
  patterns.forEach(({ regex, replacement }) => {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      modified = true;
    }
  });

  // Se houve modificação, salvar
  if (modified) {
    // Criar backup
    fs.writeFileSync(`${fullPath}.backup`, originalContent, 'utf8');

    // Salvar arquivo modificado
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
    return false;
  }
}

// Processar todos os arquivos
console.log('🔄 Starting console.log replacement...\n');

let updatedCount = 0;
filesToUpdate.forEach(file => {
  if (processFile(file)) {
    updatedCount++;
  }
});

console.log(`\n✅ Completed! ${updatedCount}/${filesToUpdate.length} files updated.`);
console.log('\n📝 Backups created with .backup extension');
console.log('\n🎯 Next steps:');
console.log('   1. Review changes in each file');
console.log('   2. Test the application: npm run start:dev');
console.log('   3. If everything works, delete .backup files');
