-- ==============================================================================
-- Simpul Tech MedLogistics Engine — Neon PostgreSQL Schema & Seed Migration
-- ==============================================================================

-- 1. Create Core Master Tables
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    storage_type VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    distance_km NUMERIC(6, 2) NOT NULL,
    storage_unit VARCHAR(50) NOT NULL,
    fleet_type VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS warehouse_inventory (
    warehouse_id VARCHAR(10) REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id VARCHAR(10) REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity >= 0),
    PRIMARY KEY (warehouse_id, product_id)
);

CREATE TABLE IF NOT EXISTS historical_delivery (
    id VARCHAR(50) PRIMARY KEY,
    warehouse_id VARCHAR(10) REFERENCES warehouses(id) ON DELETE CASCADE,
    delivery_date TIMESTAMP,
    arrived_date TIMESTAMP,
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ON_PROCESS'
);

CREATE TABLE IF NOT EXISTS historical_delivery_detail (
    id VARCHAR(50) PRIMARY KEY,
    delivery_id VARCHAR(50) REFERENCES historical_delivery(id) ON DELETE CASCADE,
    product_id VARCHAR(10) REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS historical_delivery_status (
    id SERIAL PRIMARY KEY,
    delivery_id VARCHAR(50) NOT NULL REFERENCES historical_delivery(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'ON_PROCESS',
    note TEXT,
    created_date TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_historical_delivery_status_unique 
ON historical_delivery_status (delivery_id, status);

-- 2. Seed Master Products
INSERT INTO products (id, name, category, storage_type) VALUES
('P001', 'Surgical Gloves (Box/100)', 'Medical Consumables', 'AMBIENT'),
('P002', 'Hepatitis B Vaccine (Vial)', 'Vaccines', 'REFRIGERATED'),
('P003', 'Syringes 5ml (Box/100)', 'Medical Consumables', 'AMBIENT'),
('P004', 'Tetanus Vaccine (Vial)', 'Vaccines', 'REFRIGERATED'),
('P005', 'Paracetamol Infusion 100ml', 'Medication', 'AMBIENT')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Regional Warehouses
INSERT INTO warehouses (id, name, city, distance_km, storage_unit, fleet_type) VALUES
('W01', 'Surabaya Facility', 'Surabaya', 5.00, 'GENERAL', 'STANDARD'),
('W02', 'Surabaya Facility', 'Surabaya', 12.00, 'MIXED', 'VAN_WITH_SMALL_REFRIGERATOR'),
('W03', 'Sidoarjo Facility', 'Sidoarjo', 25.00, 'GENERAL', 'STANDARD'),
('W04', 'Gresik Facility', 'Gresik', 30.00, 'MIXED', 'REFRIGERATED_VANS'),
('W05', 'Malang Facility', 'Malang', 90.00, 'GENERAL', 'STANDARD'),
('W06', 'Malang Facility', 'Malang', 95.00, 'REFRIGERATED', 'REFRIGERATED_VANS'),
('W07', 'Pasuruan Facility', 'Pasuruan', 45.00, 'GENERAL', 'STANDARD'),
('W08', 'Jember Facility', 'Jember', 150.00, 'MIXED', 'VAN_WITH_SMALL_REFRIGERATOR')
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Baseline Warehouse Inventories
INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity) VALUES
('W01', 'P001', 200), ('W01', 'P003', 500), ('W01', 'P005', 300),
('W02', 'P001', 50),  ('W02', 'P002', 30),  ('W02', 'P004', 20),
('W03', 'P001', 300), ('W03', 'P003', 200),
('W04', 'P002', 40),  ('W04', 'P004', 25),  ('W04', 'P005', 100),
('W05', 'P001', 400), ('W05', 'P003', 300), ('W05', 'P005', 500),
('W06', 'P002', 100), ('W06', 'P004', 80),
('W07', 'P001', 150), ('W07', 'P003', 250), ('W07', 'P005', 200),
('W08', 'P001', 100), ('W08', 'P002', 20),  ('W08', 'P003', 150), ('W08', 'P004', 15), ('W08', 'P005', 50)
ON CONFLICT (warehouse_id, product_id) DO NOTHING;

-- 5. Seed Baseline Historical Deliveries (DL001 - DL038)
INSERT INTO historical_delivery (id, warehouse_id, delivery_date, arrived_date, notes, status) VALUES
('DL001', 'W01', '2026-09-01 08:00:00', NULL, 'Morning routine dispatch to Surabaya Central Hub (08:00)', 'ON_PROCESS'),
('DL002', 'W01', '2026-09-01 14:00:00', NULL, 'Afternoon off-peak dispatch (14:00)', 'ON_PROCESS'),
('DL003', 'W01', '2026-09-02 07:30:00', NULL, 'Morning rush hour delivery (07:30)', 'ON_PROCESS'),
('DL004', 'W01', '2026-09-03 16:30:00', NULL, 'Wednesday evening peak traffic (16:30)', 'ON_PROCESS'),
('DL005', 'W01', '2026-09-04 11:00:00', NULL, 'Friday morning pre-weekend delivery (11:00)', 'ON_PROCESS'),
('DL006', 'W01', '2026-09-05 09:00:00', NULL, 'Saturday morning non-peak run (09:00)', 'ON_PROCESS'),
('DL007', 'W01', '2026-09-07 08:30:00', NULL, 'Monday morning peak traffic delivery (08:30)', 'ON_PROCESS'),
('DL008', 'W01', '2026-09-08 17:00:00', NULL, 'Tuesday evening rush hour delivery (17:00)', 'ON_PROCESS'),
('DL009', 'W01', '2026-09-09 13:00:00', NULL, 'Wednesday afternoon off-peak corridor (13:00)', 'ON_PROCESS'),
('DL010', 'W01', '2026-09-10 07:00:00', NULL, 'Thursday early morning run (07:00)', 'ON_PROCESS'),
('DL011', 'W02', '2026-09-01 09:30:00', NULL, 'Cold-chain vaccine dispatch via Van + Small Fridge (09:30)', 'ON_PROCESS'),
('DL012', 'W02', '2026-09-02 14:30:00', NULL, 'Afternoon cold supply transfer (14:30)', 'ON_PROCESS'),
('DL013', 'W02', '2026-09-03 08:00:00', NULL, 'Wednesday morning dual-cargo delivery (08:00)', 'ON_PROCESS'),
('DL014', 'W02', '2026-09-04 17:30:00', NULL, 'Friday evening traffic transfer (17:30)', 'ON_PROCESS'),
('DL015', 'W02', '2026-09-06 10:00:00', NULL, 'Sunday urgent vaccine replenishment (10:00)', 'ON_PROCESS'),
('DL016', 'W02', '2026-09-07 15:00:00', NULL, 'Monday afternoon routine clinic delivery (15:00)', 'ON_PROCESS'),
('DL017', 'W02', '2026-09-08 07:30:00', NULL, 'Tuesday rush hour delivery (07:30)', 'ON_PROCESS'),
('DL018', 'W02', '2026-09-09 11:30:00', NULL, 'Midday cold chain transfer (11:30)', 'ON_PROCESS'),
('DL019', 'W03', '2026-09-01 10:00:00', NULL, 'Sidoarjo toll corridor transit (25 km)', 'ON_PROCESS'),
('DL020', 'W03', '2026-09-02 16:00:00', NULL, 'Afternoon standard cargo delivery (16:00)', 'ON_PROCESS'),
('DL021', 'W03', '2026-09-03 07:00:00', NULL, 'Early morning bulk consumables dispatch (07:00)', 'ON_PROCESS'),
('DL022', 'W03', '2026-09-05 13:30:00', NULL, 'Weekend afternoon expressway run (13:30)', 'ON_PROCESS'),
('DL023', 'W03', '2026-09-07 17:00:00', NULL, 'Evening rush hour toll highway transfer (17:00)', 'ON_PROCESS'),
('DL024', 'W04', '2026-09-01 11:00:00', NULL, 'Dedicated refrigerated van dispatch from Gresik (30 km)', 'ON_PROCESS'),
('DL025', 'W04', '2026-09-02 08:30:00', NULL, 'Morning peak cold-chain transfer (08:30)', 'ON_PROCESS'),
('DL026', 'W04', '2026-09-04 15:30:00', NULL, 'Afternoon vaccine supply run (15:30)', 'ON_PROCESS'),
('DL027', 'W04', '2026-09-06 12:00:00', NULL, 'Midday cold transport via bypass (12:00)', 'ON_PROCESS'),
('DL028', 'W04', '2026-09-08 18:00:00', NULL, 'Evening cold-chain delivery into Surabaya Hub (18:00)', 'ON_PROCESS'),
('DL029', 'W05', '2026-09-02 06:00:00', NULL, 'Long-distance inter-city transit from Malang (90 km)', 'ON_PROCESS'),
('DL030', 'W05', '2026-09-04 13:00:00', NULL, 'Midday expressway bulk cargo delivery (13:00)', 'ON_PROCESS'),
('DL031', 'W05', '2026-09-07 07:00:00', NULL, 'Early morning regional consignment (07:00)', 'ON_PROCESS'),
('DL032', 'W06', '2026-09-01 06:30:00', NULL, 'Refrigerated van long-haul from Malang (95 km)', 'ON_PROCESS'),
('DL033', 'W06', '2026-09-03 14:00:00', NULL, 'Regional cold-chain replenishment transfer (14:00)', 'ON_PROCESS'),
('DL034', 'W06', '2026-09-08 07:00:00', NULL, 'Early morning dedicated vaccine transport (07:00)', 'ON_PROCESS'),
('DL035', 'W07', '2026-09-02 10:30:00', NULL, 'Pasuruan corridor bulk delivery (45 km)', 'ON_PROCESS'),
('DL036', 'W07', '2026-09-05 15:00:00', NULL, 'Weekend afternoon cargo dispatch (15:00)', 'ON_PROCESS'),
('DL037', 'W08', '2026-09-03 05:00:00', NULL, 'Maximum distance run from Jember Hub (150 km)', 'ON_PROCESS'),
('DL038', 'W08', '2026-09-07 05:30:00', NULL, 'Early dawn regional dispatch (150 km transit)', 'ON_PROCESS')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Line Items for Baseline Deliveries
INSERT INTO historical_delivery_detail (id, delivery_id, product_id, quantity) VALUES
('DL001-P001', 'DL001', 'P001', 50), ('DL001-P003', 'DL001', 'P003', 100),
('DL002-P005', 'DL002', 'P005', 50),
('DL003-P001', 'DL003', 'P001', 40), ('DL003-P003', 'DL003', 'P003', 80),
('DL004-P005', 'DL004', 'P005', 60),
('DL005-P001', 'DL005', 'P001', 30), ('DL005-P005', 'DL005', 'P005', 40),
('DL006-P003', 'DL006', 'P003', 120),
('DL007-P001', 'DL007', 'P001', 60), ('DL007-P003', 'DL007', 'P003', 90),
('DL008-P005', 'DL008', 'P005', 70),
('DL009-P001', 'DL009', 'P001', 45), ('DL009-P003', 'DL009', 'P003', 60),
('DL010-P003', 'DL010', 'P003', 80),  ('DL010-P005', 'DL010', 'P005', 50),
('DL011-P001', 'DL011', 'P001', 20), ('DL011-P002', 'DL011', 'P002', 15),
('DL012-P004', 'DL012', 'P004', 10),
('DL013-P001', 'DL013', 'P001', 25), ('DL013-P002', 'DL013', 'P002', 10),
('DL014-P002', 'DL014', 'P002', 12), ('DL014-P004', 'DL014', 'P004', 8),
('DL015-P002', 'DL015', 'P002', 20),
('DL016-P001', 'DL016', 'P001', 15), ('DL016-P004', 'DL016', 'P004', 6),
('DL017-P002', 'DL017', 'P002', 18),
('DL018-P001', 'DL018', 'P001', 30), ('DL018-P004', 'DL018', 'P004', 10),
('DL019-P001', 'DL019', 'P001', 100), ('DL019-P003', 'DL019', 'P003', 80),
('DL020-P001', 'DL020', 'P001', 60),  ('DL020-P003', 'DL020', 'P003', 50),
('DL021-P001', 'DL021', 'P001', 80),  ('DL021-P003', 'DL021', 'P003', 70),
('DL022-P003', 'DL022', 'P003', 100),
('DL023-P001', 'DL023', 'P001', 75),  ('DL023-P003', 'DL023', 'P003', 90),
('DL024-P002', 'DL024', 'P002', 25),  ('DL024-P004', 'DL024', 'P004', 15),
('DL025-P002', 'DL025', 'P002', 30),
('DL026-P004', 'DL026', 'P004', 20),  ('DL026-P005', 'DL026', 'P005', 40),
('DL027-P002', 'DL027', 'P002', 20),  ('DL027-P004', 'DL027', 'P004', 10),
('DL028-P002', 'DL028', 'P002', 35),  ('DL028-P005', 'DL028', 'P005', 50),
('DL029-P001', 'DL029', 'P001', 150), ('DL029-P003', 'DL029', 'P003', 120),
('DL030-P001', 'DL030', 'P001', 100), ('DL030-P005', 'DL030', 'P005', 150),
('DL031-P003', 'DL031', 'P003', 180),
('DL032-P002', 'DL032', 'P002', 50),  ('DL032-P004', 'DL032', 'P004', 40),
('DL033-P002', 'DL033', 'P002', 60),
('DL034-P004', 'DL034', 'P004', 50),
('DL035-P001', 'DL035', 'P001', 80),  ('DL035-P003', 'DL035', 'P003', 100),
('DL036-P003', 'DL036', 'P003', 90),  ('DL036-P005', 'DL036', 'P005', 80),
('DL037-P001', 'DL037', 'P001', 50),  ('DL037-P002', 'DL037', 'P002', 15), ('DL037-P003', 'DL037', 'P003', 60),
('DL038-P001', 'DL038', 'P001', 40),  ('DL038-P004', 'DL038', 'P004', 10)
ON CONFLICT (id) DO NOTHING;

-- 7. Seed Initial Status Records for Baseline Deliveries
INSERT INTO historical_delivery_status (delivery_id, status, note, created_date)
SELECT id, 'ON_PROCESS', notes, COALESCE(delivery_date, NOW())
FROM historical_delivery
ON CONFLICT (delivery_id, status) DO NOTHING;
