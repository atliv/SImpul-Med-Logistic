-- ==============================================================================
-- Migration: 0003_historical_delivery_datetime.sql
-- Description: Ensure historical_delivery and historical_delivery_detail tables exist
--              with TIMESTAMP data types for delivery_date and arrived_date.
-- Database: Neon PostgreSQL
-- ==============================================================================

-- 1. Create table with TIMESTAMP if not exists
CREATE TABLE IF NOT EXISTS historical_delivery (
    id VARCHAR(50) PRIMARY KEY,
    warehouse_id VARCHAR(10) REFERENCES warehouses(id) ON DELETE CASCADE,
    delivery_date TIMESTAMP,
    arrived_date TIMESTAMP,
    notes TEXT
);

-- 2. Alter existing VARCHAR columns to TIMESTAMP if previously created as VARCHAR
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'historical_delivery' 
          AND column_name = 'delivery_date' 
          AND data_type = 'character varying'
    ) THEN
        ALTER TABLE historical_delivery 
            ALTER COLUMN delivery_date TYPE TIMESTAMP USING delivery_date::timestamp,
            ALTER COLUMN arrived_date TYPE TIMESTAMP USING arrived_date::timestamp;
    END IF;
END $$;

-- 3. Historical delivery details line items table
CREATE TABLE IF NOT EXISTS historical_delivery_detail (
    id VARCHAR(50) PRIMARY KEY,
    delivery_id VARCHAR(50) REFERENCES historical_delivery(id) ON DELETE CASCADE,
    product_id VARCHAR(10) REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0)
);
