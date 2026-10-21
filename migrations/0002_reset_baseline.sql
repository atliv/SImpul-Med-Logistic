-- ==============================================================================
-- Migration: 0002_reset_baseline.sql
-- Description: Transactional reset of warehouse_inventory back to baseline defaults
-- Database: Neon PostgreSQL
-- ==============================================================================

BEGIN;

-- Wipe existing inventory levels
DELETE FROM warehouse_inventory;

-- Re-insert exact catalog baseline from domain specification
INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity) VALUES
    ('W01', 'P001', 200), ('W01', 'P003', 500), ('W01', 'P005', 300),
    ('W02', 'P001', 50),  ('W02', 'P002', 30),  ('W02', 'P004', 20),
    ('W03', 'P001', 300), ('W03', 'P003', 200),
    ('W04', 'P002', 40),  ('W04', 'P004', 25),  ('W04', 'P005', 100),
    ('W05', 'P001', 400), ('W05', 'P003', 300), ('W05', 'P005', 500),
    ('W06', 'P002', 20),  ('W06', 'P004', 30),  ('W06', 'P003', 100),
    ('W07', 'P001', 150), ('W07', 'P002', 8),   ('W07', 'P004', 10),
    ('W08', 'P002', 60),  ('W08', 'P004', 50),  ('W08', 'P005', 200);

COMMIT;
