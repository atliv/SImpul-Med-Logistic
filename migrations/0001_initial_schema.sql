-- ==============================================================================
-- Migration: 0001_initial_schema.sql
-- Description: Create core tables for medical warehouse fulfillment system
-- Database: Neon PostgreSQL
-- ==============================================================================

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    storage_type VARCHAR(50) NOT NULL CHECK (storage_type IN ('AMBIENT', 'REFRIGERATED'))
);

-- 2. Warehouses Table
CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    distance_km NUMERIC(6, 2) NOT NULL CHECK (distance_km >= 0),
    storage_unit VARCHAR(50) NOT NULL CHECK (storage_unit IN ('GENERAL', 'REFRIGERATED')),
    fleet_type VARCHAR(50) NOT NULL CHECK (fleet_type IN ('STANDARD', 'REFRIGERATED_VANS'))
);

-- 3. Warehouse Inventory Table (Composite PK)
CREATE TABLE IF NOT EXISTS warehouse_inventory (
    warehouse_id VARCHAR(10) REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id VARCHAR(10) REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity >= 0),
    PRIMARY KEY (warehouse_id, product_id)
);

-- 4. Seed Products Baseline
INSERT INTO products (id, name, category, storage_type) VALUES
    ('P001', 'Surgical Gloves (Box of 100)', 'Medical Supplies', 'AMBIENT'),
    ('P002', 'Vaccine — Hepatitis B (10-dose vial)', 'Pharmaceutical', 'REFRIGERATED'),
    ('P003', 'Disposable Syringe (Box of 50)', 'Medical Supplies', 'AMBIENT'),
    ('P004', 'Vaccine — Tetanus Toxoid (10-dose vial)', 'Pharmaceutical', 'REFRIGERATED'),
    ('P005', 'Paracetamol Tablets (Box of 100)', 'Pharmaceutical', 'AMBIENT')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    storage_type = EXCLUDED.storage_type;

-- 5. Seed Warehouses Baseline
INSERT INTO warehouses (id, name, city, distance_km, storage_unit, fleet_type) VALUES
    ('W01', 'Surabaya Central Depot', 'Surabaya', 5.0, 'GENERAL', 'STANDARD'),
    ('W02', 'Surabaya Cold Logistics', 'Surabaya', 12.0, 'REFRIGERATED', 'STANDARD'),
    ('W03', 'Sidoarjo Distribution Hub', 'Sidoarjo', 25.0, 'GENERAL', 'STANDARD'),
    ('W04', 'Gresik Pharma Cold Facility', 'Gresik', 30.0, 'REFRIGERATED', 'REFRIGERATED_VANS'),
    ('W05', 'Malang South Warehouse', 'Malang', 90.0, 'GENERAL', 'STANDARD'),
    ('W06', 'Malang Cold Storage', 'Malang', 95.0, 'REFRIGERATED', 'STANDARD'),
    ('W07', 'Pasuruan Regional Center', 'Pasuruan', 45.0, 'REFRIGERATED', 'REFRIGERATED_VANS'),
    ('W08', 'Jember Deep East Depot', 'Jember', 150.0, 'REFRIGERATED', 'REFRIGERATED_VANS')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    city = EXCLUDED.city,
    distance_km = EXCLUDED.distance_km,
    storage_unit = EXCLUDED.storage_unit,
    fleet_type = EXCLUDED.fleet_type;

-- 6. Seed Baseline Inventory
INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity) VALUES
    ('W01', 'P001', 200), ('W01', 'P003', 500), ('W01', 'P005', 300),
    ('W02', 'P001', 50),  ('W02', 'P002', 30),  ('W02', 'P004', 20),
    ('W03', 'P001', 300), ('W03', 'P003', 200),
    ('W04', 'P002', 40),  ('W04', 'P004', 25),  ('W04', 'P005', 100),
    ('W05', 'P001', 400), ('W05', 'P003', 300), ('W05', 'P005', 500),
    ('W06', 'P002', 20),  ('W06', 'P004', 30),  ('W06', 'P003', 100),
    ('W07', 'P001', 150), ('W07', 'P002', 8),   ('W07', 'P004', 10),
    ('W08', 'P002', 60),  ('W08', 'P004', 50),  ('W08', 'P005', 200)
ON CONFLICT (warehouse_id, product_id) DO UPDATE
SET quantity = EXCLUDED.quantity;
