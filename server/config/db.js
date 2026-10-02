const { Pool } = require('pg');
const { getContext } = require('./tenantContext');

// ============================================================
// Environment-based Database Connection
// ============================================================
const isDev = (process.env.NODE_ENV || 'development') === 'development';
const connectionString = isDev
  ? (process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL)
  : (process.env.DATABASE_URL_PROD || process.env.DATABASE_URL);

if (!connectionString) {
  console.error(`[DB] FATAL: DATABASE_URL_PROD or DATABASE_URL is not set in environment`);
  process.exit(1);
}

const poolConfig = {
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};
if (!isDev || (connectionString && (connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || connectionString.includes('supabase.com') || connectionString.includes('sslmode=require')))) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);
pool.on('error', (err) => console.error('[DB] Unexpected error on idle client:', err.message));
console.log(`[DB] Mode: ${isDev ? 'LOCAL (development)' : 'NEON (production)'}`);

// ============================================================
// Tables that are GLOBAL (no vidyalaya_id column)
// ============================================================
const GLOBAL_TABLES = new Set([
  'financial_year', 'funding_head', 'asset_category', 'role',
  'user_role', 'depreciation_rule', 'verification_item',
  'stock_transition_items', 'condemnation_items', 'department', 'vidyalaya',
  'non_consumable_issue_items',
]);

// ============================================================
// SQL Validation Helpers
// ============================================================

/** Extract the query type (SELECT, INSERT, UPDATE, DELETE) */
function getQueryType(sql) {
  const m = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
  if (!m) return null;
  return m[1].toUpperCase();
}

/** Extract the primary table name from a SQL string */
function extractTable(sql, queryType) {
  let m;
  if (queryType === 'INSERT') {
    m = sql.match(/INSERT\s+INTO\s+"?(\w+)"?/i);
  } else if (queryType === 'UPDATE') {
    m = sql.match(/UPDATE\s+"?(\w+)"?/i);
  } else {
    // SELECT / DELETE — use first FROM
    m = sql.match(/FROM\s+"?(\w+)"?/i);
  }
  return m ? m[1].toLowerCase() : null;
}

/**
 * Validate a SELECT / UPDATE / DELETE query for tenant isolation.
 * Rules:
 *   1. vidyalaya_id must appear as equality: vidyalaya_id = $N
 *   2. Must NOT be negated (!=, <>)
 *   3. Must NOT appear in an OR clause (same paren level)
 *   4. Parameter value must match the context vidyalayaId
 */
function validateReadQuery(sql, params, vidyalayaId) {
  // 1. Reject negation first (more specific error)
  if (/(?:\w+\.)?vidyalaya_id\s*(!=|<>)/i.test(sql)) {
    throw new Error('[TENANT] vidyalaya_id must not be negated');
  }

  // 2. Must have vidyalaya_id = $N
  const eqMatch = sql.match(/(?:\w+\.)?vidyalaya_id\s*=\s*\$(\d+)/i);
  if (!eqMatch) {
    throw new Error(`[TENANT] Query on tenant table missing "vidyalaya_id = $N" filter`);
  }

  // 3. Reject OR involving vidyalaya_id (same parenthesis level)
  if (/\bOR\b[^()]*\bvidyalaya_id\b|\bvidyalaya_id\b[^()]*\bOR\b/i.test(sql)) {
    throw new Error('[TENANT] vidyalaya_id must not appear in OR conditions');
  }

  // 4. Validate parameter matches context
  const paramIdx = parseInt(eqMatch[1]) - 1;
  if (params[paramIdx] !== vidyalayaId) {
    throw new Error(`[TENANT] vidyalaya_id parameter mismatch: got ${params[paramIdx]}, expected ${vidyalayaId}`);
  }

  return { sql, params };
}

/**
 * Validate/inject vidyalaya_id for INSERT queries.
 * - If vidyalaya_id column is present → validate value matches context
 * - If missing → inject column + value safely
 * - Reject bulk inserts (multiple VALUES tuples) without explicit vidyalaya_id
 */
function validateInsertQuery(sql, params, vidyalayaId) {
  const hasVidCol = /\bvidyalaya_id\b/i.test(sql);

  if (hasVidCol) {
    // Find which column position vidyalaya_id is at
    const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (colsMatch) {
      const cols = colsMatch[1].split(',').map(c => c.trim().replace(/"/g, '').toLowerCase());
      const vidIdx = cols.indexOf('vidyalaya_id');
      if (vidIdx !== -1) {
        // Find the $N at the same position in VALUES
        const valsMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
        if (valsMatch) {
          const vals = valsMatch[1].split(',').map(v => v.trim());
          const paramRef = vals[vidIdx]; // e.g. "$3"
          const pMatch = paramRef.match(/\$(\d+)/);
          if (pMatch) {
            const pIdx = parseInt(pMatch[1]) - 1;
            if (params[pIdx] !== vidyalayaId) {
              throw new Error(`[TENANT] INSERT vidyalaya_id mismatch: got ${params[pIdx]}, expected ${vidyalayaId}`);
            }
          }
        }
      }
    }
    return { sql, params };
  }

  // vidyalaya_id missing — reject bulk inserts, inject for single-row
  const multiValues = sql.match(/VALUES\s*\(/gi);
  if (multiValues && multiValues.length > 1) {
    throw new Error('[TENANT] Bulk INSERT without explicit vidyalaya_id is rejected');
  }

  // Inject: add column to column list, add $N to values, append param
  const newParams = [...params, vidyalayaId];
  const nextParam = `$${newParams.length}`;

  // Insert "vidyalaya_id" into column list
  let newSql = sql.replace(/\)\s*VALUES/i, `, vidyalaya_id) VALUES`);
  // Insert $N into values list (before the closing paren of VALUES)
  newSql = newSql.replace(/VALUES\s*\(([^)]+)\)/i, (match, inner) => {
    return `VALUES (${inner}, ${nextParam})`;
  });

  if (isDev) console.log(`[TENANT] Injected vidyalaya_id=$${newParams.length} into INSERT`);
  return { sql: newSql, params: newParams };
}

// ============================================================
// Core Tenant Query Function
// ============================================================

/**
 * Execute a query with full tenant isolation enforcement.
 * Requires AsyncLocalStorage context to be active.
 */
function tenantQuery(sql, params = []) {
  const ctx = getContext();

  // 1. Context MUST exist
  if (!ctx) {
    throw new Error('[TENANT] No tenant context — query rejected. Use rawQuery for system operations.');
  }

  // 2. SuperAdmin bypass — allowed for reads on global/vidyalaya tables only
  if (ctx.isSuperAdmin) {
    if (isDev) console.log(`[TENANT] SuperAdmin query (bypassed): ${sql.substring(0, 80)}...`);
    return pool.query(sql, params);
  }

  // 3. Determine query type
  const queryType = getQueryType(sql);
  if (!queryType) {
    throw new Error('[TENANT] Only SELECT, INSERT, UPDATE, DELETE queries are allowed');
  }

  // 4. Determine table — skip enforcement for global tables
  const table = extractTable(sql, queryType);
  if (table && GLOBAL_TABLES.has(table)) {
    if (isDev) console.log(`[TENANT] Global table "${table}" — no vid filter (vid=${ctx.vidyalayaId})`);
    return pool.query(sql, params);
  }

  // 5. Enforce tenant isolation
  const vidyalayaId = ctx.vidyalayaId;
  if (!vidyalayaId) {
    throw new Error('[TENANT] No vidyalaya_id in context — cannot execute tenant query');
  }

  let validated;
  if (queryType === 'INSERT') {
    validated = validateInsertQuery(sql, params, vidyalayaId);
  } else {
    validated = validateReadQuery(sql, params, vidyalayaId);
  }

  if (isDev) console.log(`[TENANT] vid=${vidyalayaId} | ${queryType} ${table || '?'}`);
  return pool.query(validated.sql, validated.params);
}

/**
 * Get a tenant-aware client for transactions.
 * The returned client's query() method is wrapped with tenant enforcement.
 */
async function getTenantClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  client.query = (sql, params = []) => {
    // Allow transaction control statements
    if (/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/i.test(sql)) {
      return originalQuery(sql, params);
    }

    const ctx = getContext();
    if (!ctx) throw new Error('[TENANT] No tenant context for transaction query');
    if (ctx.isSuperAdmin) return originalQuery(sql, params);

    const queryType = getQueryType(sql);
    if (!queryType) throw new Error('[TENANT] Only SELECT/INSERT/UPDATE/DELETE allowed');

    const table = extractTable(sql, queryType);
    if (table && GLOBAL_TABLES.has(table)) return originalQuery(sql, params);

    const vidyalayaId = ctx.vidyalayaId;
    if (!vidyalayaId) throw new Error('[TENANT] No vidyalaya_id in transaction context');

    let validated;
    if (queryType === 'INSERT') {
      validated = validateInsertQuery(sql, params, vidyalayaId);
    } else {
      validated = validateReadQuery(sql, params, vidyalayaId);
    }

    if (isDev) console.log(`[TENANT-TX] vid=${vidyalayaId} | ${queryType} ${table || '?'}`);
    return originalQuery(validated.sql, validated.params);
  };

  client.release = (err) => {
    client.query = originalQuery;
    client.release = originalRelease;
    originalRelease(err);
  };
  return client;
}

// ============================================================
// Raw Query (NO tenant enforcement)
// Use ONLY for: login, registration, migrations, system ops
// ============================================================
const rawQuery = (sql, params) => pool.query(sql, params);
const getClient = () => pool.connect();

module.exports = {
  pool,
  query: tenantQuery,       // Default export is tenant-enforced
  tenantQuery,
  rawQuery,
  getClient,               // Raw client (migrations)
  getTenantClient,         // Wrapped client (tenant transactions)
};
