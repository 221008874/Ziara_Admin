// Barrel: re-exports all domain services for backward compatibility
// All existing `import { ... } from "../services/firestoreService"` imports keep working.

export { COLLECTIONS, normalizeBilingual, resolveSpecialty, resolveSpecialtyKey, buildPublicDoctor, buildPublicTenant } from './core';
export * from './licenses';
export * from './tenants';
export * from './doctors';
export * from './patients';
export * from './sync';
export * from './servers';
export * from './versions';
export * from './erp';
export * from './inventory';
export * from './procurement';
