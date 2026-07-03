-- Database Schema for SafeStep Philippines WMS Sync Engine
-- Compatible with Neon Postgres and Vercel Postgres Databases

-- Drop table if it exists
-- DROP TABLE IF EXISTS sync_vaults;

-- Create sync_vaults table
CREATE TABLE IF NOT EXISTS sync_vaults (
  vault_key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_sync_vaults_updated_at ON sync_vaults (updated_at DESC);
