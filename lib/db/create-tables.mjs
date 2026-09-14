import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_oRe6jfO2kgiN@ep-lingering-bread-b5kumswy-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
});

async function main() {
  console.log("Conectando con Neon para crear las tablas...");
  try {
    // Crea la tabla de usuarios básica
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT EXISTS,
        password TEXT,
        username TEXT UNIQUE
      );
    `);
    
    // Crea la tabla donde Express guarda tus sesiones iniciadas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    console.log("¡ÉXITO! Las tablas de usuarios y sesiones se crearon en Neon.");
  } catch (err) {
    console.error("Error al crear las tablas:", err);
  } finally {
    await pool.end();
  }
}
main();
