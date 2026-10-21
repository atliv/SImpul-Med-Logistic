import type { IWarehouseRepository } from "../../domain/repositories/IWarehouseRepository.js";
import { InMemoryWarehouseRepository } from "../memory/InMemoryWarehouseRepository.js";
import { NeonWarehouseRepository } from "../db/NeonWarehouseRepository.js";

let instance: IWarehouseRepository | null = null;

/**
 * Safely resolves an environment variable across Vite dev (import.meta.env)
 * and Node / Vercel runtime (process.env), checking both VITE_* and standard keys.
 */
function getEnvVar(key: string): string | undefined {
  const viteKey = key.startsWith("VITE_") ? key : `VITE_${key}`;

  // 1. Check import.meta.env (Vite dev server & client/server build)
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (import.meta.env[viteKey] !== undefined) return import.meta.env[viteKey];
    if (import.meta.env[key] !== undefined) return import.meta.env[key];
  }

  // 2. Check process.env (Node runtime / Vercel serverless / CLI)
  if (typeof process !== "undefined" && process.env) {
    if (process.env[viteKey] !== undefined) return process.env[viteKey];
    if (process.env[key] !== undefined) return process.env[key];
  }

  return undefined;
}

/**
 * Repository Factory:
 * - Vitest / Test Runner: Always uses InMemoryWarehouseRepository.
 * - Neon / PostgreSQL: Uses NeonWarehouseRepository when VITE_DATABASE_URL or DATABASE_URL is set and USE_IN_MEMORY !== 'true'.
 * - Fallback: Uses InMemoryWarehouseRepository if database URL is absent or USE_IN_MEMORY === 'true'.
 */
export function getWarehouseRepository(): IWarehouseRepository {
  if (instance) {
    return instance;
  }

  const isTest =
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

  const useInMemoryVal = getEnvVar("USE_IN_MEMORY");
  const forceInMemory = useInMemoryVal === "true";

  const databaseUrl = getEnvVar("DATABASE_URL");

  if (
    !isTest &&
    !forceInMemory &&
    databaseUrl &&
    databaseUrl.trim().length > 0
  ) {
    instance = new NeonWarehouseRepository(databaseUrl);
    return instance;
  }

  if (!isTest) {
    console.log(
      `[Repository] Using In-Memory Repository (USE_IN_MEMORY=${useInMemoryVal ?? "unset"}, DATABASE_URL=${databaseUrl ? "set" : "unset"})`,
    );
  }
  instance = new InMemoryWarehouseRepository();
  return instance;
}

/**
 * Allows automated tests to inject a clean or custom repository instance.
 */
export function setWarehouseRepository(
  repo: IWarehouseRepository | null,
): void {
  instance = repo;
}
