const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER || 'tusyen-online'}:${process.env.DB_PASSWORD || 'tusyen-online123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'eduapp'}`;

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');
const APP_BASE_MIGRATION = '001_initial.sql';
const APP_KEYCLOAK_MIGRATION = '000_create_keycloak_database.sql';

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1
     LIMIT 1`,
    [tableName]
  );
  return result.rowCount > 0;
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        file_name TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const applied = new Set(
      (await client.query('SELECT file_name FROM schema_migrations ORDER BY file_name')).rows.map((row) => row.file_name)
    );

    if ((await tableExists(client, 'users')) && !applied.has(APP_BASE_MIGRATION)) {
      await client.query(
        'INSERT INTO schema_migrations (file_name, applied_at) VALUES ($1, NOW()) ON CONFLICT (file_name) DO NOTHING',
        [APP_BASE_MIGRATION]
      );
      applied.add(APP_BASE_MIGRATION);
    }

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql') && file !== APP_KEYCLOAK_MIGRATION)
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`Applying migration ${file}`);
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (file_name, applied_at) VALUES ($1, NOW()) ON CONFLICT (file_name) DO NOTHING',
        [file]
      );
    }

    console.log('Migrations complete.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Migration failed.');
  console.error(error);
  process.exit(1);
});
