import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" })); // Support large state sync payloads

// In-memory fallback if DATABASE_URL is not set
const memorySyncVaults = new Map<string, any>();

let pool: pg.Pool | null = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required. Please set up your Neon or Vercel Postgres connection string.");
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Standard SSL configuration for Neon/Vercel serverless databases
      },
    });
  }
  return pool;
}

// Ensure database table exists
async function initializeDatabase() {
  try {
    const dbPool = getPool();
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS sync_vaults (
        vault_key TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database schema initialized successfully.");
  } catch (error) {
    console.warn("Database initialization skipped or failed. Ensure DATABASE_URL is correct.", error);
  }
}

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    databaseConnected: !!process.env.DATABASE_URL
  });
});

// Sync Pull Endpoint: Fetch entire state by Vault Key
app.get("/api/sync/fetch", async (req, res) => {
  const { vaultKey } = req.query;
  
  if (!vaultKey || typeof vaultKey !== "string") {
    return res.status(400).json({ error: "Missing or invalid vaultKey parameter" });
  }

  try {
    if (!process.env.DATABASE_URL) {
      console.log(`[Sync Fallback] Fetching in-memory state for vault: ${vaultKey}`);
      const state = memorySyncVaults.get(vaultKey);
      if (!state) {
        return res.status(404).json({ error: "Vault session not found (In-memory Fallback)" });
      }
      return res.json(state);
    }

    const dbPool = getPool();
    const result = await dbPool.query(
      "SELECT state FROM sync_vaults WHERE vault_key = $1",
      [vaultKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vault session not found" });
    }

    return res.json(result.rows[0].state);
  } catch (error: any) {
    console.error("Fetch error:", error);
    return res.status(500).json({ error: error.message || "Database fetch error" });
  }
});

// Sync Push Endpoint: Store/Update state by Vault Key
app.post("/api/sync/push", async (req, res) => {
  const { vaultKey, state } = req.body;

  if (!vaultKey || !state) {
    return res.status(400).json({ error: "Missing vaultKey or state payload" });
  }

  try {
    if (!process.env.DATABASE_URL) {
      console.log(`[Sync Fallback] Saving in-memory state for vault: ${vaultKey}`);
      memorySyncVaults.set(vaultKey, state);
      return res.json({ 
        success: true, 
        timestamp: new Date().toISOString(),
        warning: "DATABASE_URL not set. Saved in server memory (reset on restart)."
      });
    }

    const dbPool = getPool();
    await dbPool.query(
      `INSERT INTO sync_vaults (vault_key, state, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (vault_key)
       DO UPDATE SET state = EXCLUDED.state, updated_at = CURRENT_TIMESTAMP`,
      [vaultKey, JSON.stringify(state)]
    );

    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Push error:", error);
    return res.status(500).json({ error: error.message || "Database push error" });
  }
});


async function startServer() {
  // Try to set up schema at boot if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    await initializeDatabase();
  }

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// In standard production containers or dev mode, start server normally.
// On Vercel, we export the app and let the Vercel serverless environment route requests.
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer();
} else {
  // On Vercel production serverless context
  if (process.env.DATABASE_URL) {
    initializeDatabase().catch(err => console.error("Vercel DB auto-init warning:", err));
  }
}

export default app;
