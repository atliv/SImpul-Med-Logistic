-- ==============================================================================
-- Migration: 0004_delivery_status_tracking.sql
-- Description: Add status column to historical_delivery and create
--              historical_delivery_status table with audit log and lifecycle tracking.
-- Database: Neon PostgreSQL
-- ==============================================================================

-- 1. Add status column to historical_delivery if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'historical_delivery'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE historical_delivery ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ON_PROCESS';
    END IF;
END $$;

-- 2. Create historical_delivery_status table
CREATE TABLE IF NOT EXISTS historical_delivery_status (
    id SERIAL PRIMARY KEY,
    delivery_id VARCHAR(50) NOT NULL REFERENCES historical_delivery(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'ON_PROCESS',
    note TEXT,
    created_date TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Create unique index to ensure 1 historical delivery cannot have duplicate statuses
CREATE UNIQUE INDEX IF NOT EXISTS idx_historical_delivery_status_unique 
ON historical_delivery_status (delivery_id, status);

-- 4. Backfill initial ON_PROCESS status for existing historical_delivery records if missing
INSERT INTO historical_delivery_status (delivery_id, status, note, created_date)
SELECT id, COALESCE(status, 'ON_PROCESS'), notes, COALESCE(delivery_date, NOW())
FROM historical_delivery hd
WHERE NOT EXISTS (
    SELECT 1 FROM historical_delivery_status s WHERE s.delivery_id = hd.id
)
ON CONFLICT (delivery_id, status) DO NOTHING;
