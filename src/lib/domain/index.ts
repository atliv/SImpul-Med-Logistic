/**
 * Domain layer barrel export.
 * Single entry point for all domain models, types, and baseline data.
 */

// Models
export * from './model/index.js';

// Baseline seed data
export { BASELINE_WAREHOUSES, getBaselineWarehouses } from './data/baseline.js';

// Domain Services
export { FulfillmentPolicy } from './services/FulfillmentPolicy.js';
export { ExplanationBuilder, type ExplanationContext } from './services/ExplanationBuilder.js';
