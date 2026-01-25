import Database from "better-sqlite3";
import { config } from "../../config.js";
import { readFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database | null = null;

function runMigrations(db: Database.Database) {
  db.pragma("foreign_keys = ON");
  
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  
  // Run initial migration (001) if migrations.sql exists
  const initialMigrationPath = join(__dirname, "migrations.sql");
  if (existsSync(initialMigrationPath)) {
    const applied = db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get("001");
    if (!applied) {
      try {
        const migration = readFileSync(initialMigrationPath, "utf-8");
        db.exec(migration);
        db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run("001");
        console.log("Applied migration 001");
      } catch (error: any) {
        console.error("Error applying initial migration:", error);
        throw error;
      }
    }
  }
  
  // Get all numbered migration files in order
  const migrationsDir = join(__dirname, "migrations");
  if (!existsSync(migrationsDir)) {
    return; // No migrations directory yet
  }
  
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql") && /^\d+_/.test(f))
    .sort();
  
  for (const file of files) {
    const version = file.replace(".sql", "").split("_")[0];
    
    // Check if already applied
    const applied = db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(version);
    if (applied) {
      console.log(`Migration ${version} already applied, skipping`);
      continue;
    }
    
    try {
      const migrationPath = join(migrationsDir, file);
      const migration = readFileSync(migrationPath, "utf-8");
      
      // Wrap in transaction
      const transaction = db.transaction(() => {
        db.exec(migration);
        db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
      });
      
      transaction();
      console.log(`Applied migration ${version}`);
    } catch (error: any) {
      // Handle "column already exists" errors gracefully
      if (error.message?.includes("duplicate column") || error.message?.includes("already exists")) {
        console.log(`Migration ${version} had non-fatal errors (columns may already exist), marking as applied`);
        db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)").run(version);
      } else {
        console.error(`Error applying migration ${version}:`, error);
        throw error;
      }
    }
  }
}

export function initDb() {
  const dbPath = config.dbPath;
  
  // Ensure data directory exists
  const dbDir = dbPath.split("/").slice(0, -1).join("/");
  if (dbDir) {
    try {
      mkdirSync(dbDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
  }
  
  db = new Database(dbPath);
  
  // Run migrations
  runMigrations(db);
  
  console.log(`Database initialized at ${dbPath}`);
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}
