import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.VITE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.trim().length === 0) {
	console.error('❌ Error: VITE_DATABASE_URL or DATABASE_URL environment variable is not defined.');
	console.error('   Please define VITE_DATABASE_URL in your .env file or environment.');
	process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigration() {
	console.log('🚀 Connecting to Neon PostgreSQL...');
	console.log(`🔗 Target: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}\n`);

	const sqlFilePath = path.join(__dirname, 'schema.sql');
	const schemaSql = fs.readFileSync(sqlFilePath, 'utf-8');

	console.log('📄 Executing scripts/schema.sql on Neon database...');
	
	// Execute statements individually to support prepared statement protocols
	const statements = schemaSql
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	for (const stmt of statements) {
		await sql.query(stmt);
	}

	// Verify tables
	const [productsRes, warehousesRes, deliveryRes] = await Promise.all([
		sql`SELECT count(*)::int as count FROM products;`,
		sql`SELECT count(*)::int as count FROM warehouses;`,
		sql`SELECT count(*)::int as count FROM historical_delivery;`
	]);

	console.log('✅ Schema synchronization verified:');
	console.log(`   - Products: ${productsRes[0]?.count ?? 0} records`);
	console.log(`   - Regional Warehouses: ${warehousesRes[0]?.count ?? 0} facilities`);
	console.log(`   - Historical Deliveries: ${deliveryRes[0]?.count ?? 0} records`);
	console.log('\n✨ Neon migration completed successfully!');
}

runMigration().catch((err) => {
	console.error('\n❌ Migration failed:', err.message || err);
	process.exit(1);
});
