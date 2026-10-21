/**
 * Storage type classification for medical/pharmaceutical products.
 * AMBIENT: Standard room-temperature storage.
 * REFRIGERATED: Requires cold-chain logistics (2–8°C).
 */
export type StorageType = 'AMBIENT' | 'REFRIGERATED';

/**
 * Product category in the medical supply chain.
 */
export type ProductCategory = 'Medical Supplies' | 'Pharmaceutical';

/**
 * Represents a medical/pharmaceutical product (SKU) in the catalog.
 */
export interface Product {
	id: string;
	name: string;
	category: ProductCategory;
	storageType: StorageType;
}

/**
 * Baseline product catalog — 5 SKUs from the domain specification.
 */
export const PRODUCTS: readonly Product[] = [
	{
		id: 'P001',
		name: 'Surgical Gloves (Box of 100)',
		category: 'Medical Supplies',
		storageType: 'AMBIENT'
	},
	{
		id: 'P002',
		name: 'Vaccine — Hepatitis B (10-dose vial)',
		category: 'Pharmaceutical',
		storageType: 'REFRIGERATED'
	},
	{
		id: 'P003',
		name: 'Disposable Syringe (Box of 50)',
		category: 'Medical Supplies',
		storageType: 'AMBIENT'
	},
	{
		id: 'P004',
		name: 'Vaccine — Tetanus Toxoid (10-dose vial)',
		category: 'Pharmaceutical',
		storageType: 'REFRIGERATED'
	},
	{
		id: 'P005',
		name: 'Paracetamol Tablets (Box of 100)',
		category: 'Pharmaceutical',
		storageType: 'AMBIENT'
	}
] as const;

/**
 * Lookup a product by its ID.
 */
export function getProductById(id: string): Product | undefined {
	return PRODUCTS.find((p) => p.id === id);
}
