const { execSync } = require('child_process');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const run = (command) => {
  execSync(command, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../..')
  });
};

try {
  console.log('🔧 Running database migration...');
  run('node src/scripts/migrate.js');

  console.log('🔧 Seeding initial data...');
  run('node src/scripts/seed.js');

  console.log('✅ Database initialization complete.');
  process.exit(0);
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  process.exit(1);
}
