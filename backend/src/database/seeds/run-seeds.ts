import { DataSource } from 'typeorm';
import { dataSourceConfig } from '../../config/database.config';
import * as fs from 'fs';
import * as path from 'path';

async function runSeeds() {
  const dataSource = new DataSource(dataSourceConfig);

  try {
    await dataSource.initialize();
    console.log('🔌 Database connection established');

    // Read and execute the initial seed SQL
    const seedFilePath = path.join(__dirname, 'initial-seed.sql');
    const seedSQL = fs.readFileSync(seedFilePath, 'utf8');

    console.log('🌱 Running database seeds...');
    await dataSource.query(seedSQL);

    console.log('✅ Seeds executed successfully!');
    console.log('📊 Initial data inserted:');
    console.log('  - 1 Admin user created');
    console.log('  - 5 Categories created');
    console.log('  - 3 Sample content items created');
    console.log('  - 1 Sample content request created');

  } catch (error) {
    console.error('❌ Error running seeds:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('🔌 Database connection closed');
  }
}

// Run seeds if this file is executed directly
if (require.main === module) {
  runSeeds();
}

export { runSeeds };