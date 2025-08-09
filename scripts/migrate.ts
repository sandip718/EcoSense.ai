#!/usr/bin/env ts-node

// Migration CLI script
// Usage: ts-node scripts/migrate.ts [command]
// Commands: status, up, rollback

import { config } from 'dotenv';
import { MigrationRunner } from '../src/utils/migrations';
import { connectDatabase, closeDatabaseConnection } from '../src/config/database';

// Load environment variables
config();

async function main() {
  const command = process.argv[2] || 'status';
  
  try {
    // Connect to database
    await connectDatabase();
    console.log('Connected to database');
    
    const migrationRunner = new MigrationRunner();
    
    switch (command) {
      case 'status':
        console.log('\n📊 Migration Status:');
        const status = await migrationRunner.getMigrationStatus();
        
        console.log(`\n✅ Applied migrations (${status.applied.length}):`);
        status.applied.forEach(migration => {
          console.log(`  - ${migration.filename} (applied: ${migration.applied_at.toISOString()})`);
        });
        
        console.log(`\n⏳ Pending migrations (${status.pending.length}):`);
        status.pending.forEach(migration => {
          console.log(`  - ${migration}`);
        });
        break;
        
      case 'up':
        console.log('\n🚀 Running pending migrations...');
        await migrationRunner.runPendingMigrations();
        console.log('✅ All migrations completed successfully');
        break;
        
      case 'rollback':
        console.log('\n⚠️  Rolling back last migration...');
        await migrationRunner.rollbackLastMigration();
        console.log('✅ Rollback completed');
        break;
        
      default:
        console.log('❌ Unknown command:', command);
        console.log('Available commands: status, up, rollback');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
    console.log('Database connection closed');
  }
}

main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});