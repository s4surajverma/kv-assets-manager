/**
 * Tenant Context — AsyncLocalStorage for multi-tenant isolation.
 * Stores the current vidyalaya_id for the duration of each HTTP request.
 */
const { AsyncLocalStorage } = require('async_hooks');

const tenantStore = new AsyncLocalStorage();

/**
 * Get the current tenant context.
 * @returns {{ vidyalayaId: number, isSuperAdmin: boolean, userId: number } | undefined}
 */
function getContext() {
  return tenantStore.getStore();
}

/**
 * Run a callback within a tenant context.
 * @param {{ vidyalayaId: number, isSuperAdmin: boolean, userId: number }} ctx
 * @param {Function} fn
 */
function runWithContext(ctx, fn) {
  return tenantStore.run(ctx, fn);
}

module.exports = { tenantStore, getContext, runWithContext };
