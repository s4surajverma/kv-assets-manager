const router = require('express').Router();
const bcrypt = require('bcryptjs');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success } = require('../utils/responseHelper');
const { getContext, runWithContext } = require('../config/tenantContext');

// Helper to wrap route with SuperAdmin context to bypass tenant checks
const withSuperAdmin = (handler) => {
  return (req, res, next) => {
    const contextData = { isSuperAdmin: true };
    runWithContext(contextData, () => {
      handler(req, res, next).catch(next);
    });
  };
};

// All Vidyalaya management routes require Admin
router.use(authorize('Admin'));

// ==================== GET MY VIDYALAYA PROFILE ====================
router.get('/my-profile', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    if (!vid) return res.status(400).json({ success: false, error: 'No Vidyalaya associated with this user' });

    const { rows } = await db.rawQuery('SELECT * FROM vidyalaya WHERE id = $1', [vid]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vidyalaya not found' });
    }
    success(res, rows[0]);
  } catch (err) { next(err); }
});

// ==================== UPDATE MY VIDYALAYA PROFILE ====================
router.put('/my-profile', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    if (!vid) return res.status(400).json({ success: false, error: 'No Vidyalaya associated with this user' });

    const { kv_name_en, kv_name_hi, kv_code, regional_office_en, regional_office_hi } = req.body;

    if (!kv_name_en || !kv_name_en.trim()) {
      return res.status(400).json({ success: false, error: 'Kendriya Vidyalaya Name (English) is required' });
    }

    // Check if kv_code is already in use by another Vidyalaya
    if (kv_code) {
      const { rows: conflict } = await db.rawQuery(
        'SELECT id FROM vidyalaya WHERE kv_code = $1 AND id != $2',
        [kv_code.trim(), vid]
      );
      if (conflict.length > 0) {
        return res.status(409).json({ success: false, error: `KV Code "${kv_code}" is already in use by another Vidyalaya` });
      }
    }

    const { rows } = await db.rawQuery(
      `UPDATE vidyalaya
       SET kv_name_en = COALESCE($1, kv_name_en),
           kv_name_hi = COALESCE($2, kv_name_hi),
           kv_code = COALESCE($3, kv_code),
           regional_office_en = COALESCE($4, regional_office_en),
           regional_office_hi = COALESCE($5, regional_office_hi),
           is_system = false
       WHERE id = $6
       RETURNING *`,
      [
        kv_name_en ? kv_name_en.trim() : null,
        kv_name_hi ? kv_name_hi.trim() : null,
        kv_code ? kv_code.trim() : null,
        regional_office_en ? regional_office_en.trim() : null,
        regional_office_hi ? regional_office_hi.trim() : null,
        vid
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vidyalaya not found' });
    }

    success(res, rows[0]);
  } catch (err) { next(err); }
});

// ====================================================================
// DANGER ZONE — Password Re-Authentication Helper
// ====================================================================
async function reAuthenticate(client, userId, password) {
  const { rows } = await client.query(
    'SELECT password_hash FROM "user" WHERE id = $1 AND is_deleted = false',
    [userId]
  );
  if (rows.length === 0) throw new Error('User not found');
  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) throw new Error('INVALID_PASSWORD');
  return true;
}

// ====================================================================
// Trigger Management — Disable/Re-enable protective triggers that
// would block DELETE operations during data purge.
// ====================================================================
const TRIGGERS_TO_DISABLE = [
  // Audit log immutability (blocks DELETE on audit_log)
  { table: 'audit_log', trigger: 'trg_audit_no_delete' },
  { table: 'audit_log', trigger: 'trg_audit_no_update' },
  // Stock transition deletion prevention
  { table: 'stock_transition_master', trigger: 'trg_prevent_master_delete' },
  { table: 'stock_transition_items', trigger: 'trg_prevent_items_delete' },
  // Auto audit log triggers (prevent cascading audit INSERTs during DELETE)
  { table: 'stock_ledger', trigger: 'trg_audit_stock_ledger' },
  { table: 'asset', trigger: 'trg_audit_asset' },
  { table: 'depreciation_ledger', trigger: 'trg_audit_depreciation' },
  { table: 'condemnation_entry', trigger: 'trg_audit_condemnation' },
  { table: 'sanction', trigger: 'trg_audit_sanction' },
  { table: 'disposal', trigger: 'trg_audit_disposal' },
  { table: 'verification', trigger: 'trg_audit_verification' },
  // Non-consumable immutability triggers
  { table: 'non_consumable_issue_master', trigger: 'trg_nc_master_immutability' },
  { table: 'non_consumable_issue_master', trigger: 'trg_nc_status_transition' },
  { table: 'non_consumable_issue_items', trigger: 'trg_nc_item_immutability' },
  // Condemnation state machine
  { table: 'condemnation_entry', trigger: 'trg_condemnation_state' },
  // Stock transition lifecycle guards
  { table: 'stock_transition_master', trigger: 'trg_master_lifecycle_guard' },
  { table: 'stock_transition_items', trigger: 'trg_protect_items_update' },
];

async function disableTriggers(client) {
  for (const { table, trigger } of TRIGGERS_TO_DISABLE) {
    await client.query(`ALTER TABLE "${table}" DISABLE TRIGGER "${trigger}"`).catch(() => {});
  }
}

async function enableTriggers(client) {
  for (const { table, trigger } of TRIGGERS_TO_DISABLE) {
    await client.query(`ALTER TABLE "${table}" ENABLE TRIGGER "${trigger}"`).catch(() => {});
  }
}

// ====================================================================
// Transactional data deletion — FK-safe bottom-up order
// Returns a summary of deleted counts per table.
// ====================================================================
async function purgeTransactionalData(client, vid) {
  const summary = {};

  // Layer 5 (leaf tables — no FK dependents)
  const leafTables = [
    { table: 'verification_item', fk: `verification_id IN (SELECT id FROM verification WHERE vidyalaya_id = $1)` },
    { table: 'stock_transition_items', fk: `transition_master_id IN (SELECT id FROM stock_transition_master WHERE vidyalaya_id = $1)` },
    { table: 'condemnation_items', fk: `condemnation_master_id IN (SELECT id FROM condemnation_master WHERE vidyalaya_id = $1)` },
    { table: 'non_consumable_issue_items', fk: `issue_master_id IN (SELECT id FROM non_consumable_issue_master WHERE vidyalaya_id = $1)` },
  ];
  for (const { table, fk } of leafTables) {
    const r = await client.query(`DELETE FROM "${table}" WHERE ${fk}`, [vid]);
    summary[table] = r.rowCount;
  }

  // Layer 4 (mid-tier)
  const midTables = [
    'disposal', 'verification', 'consumable_issue',
    'non_consumable_issue_master', 'stock_transition_master',
  ];
  for (const table of midTables) {
    const r = await client.query(`DELETE FROM "${table}" WHERE vidyalaya_id = $1`, [vid]);
    summary[table] = r.rowCount;
  }

  // Layer 3
  const r3 = await client.query('DELETE FROM sanction WHERE vidyalaya_id = $1', [vid]);
  summary.sanction = r3.rowCount;

  // Layer 2
  const layer2 = ['condemnation_entry', 'condemnation_master', 'depreciation_ledger'];
  for (const table of layer2) {
    const r = await client.query(`DELETE FROM "${table}" WHERE vidyalaya_id = $1`, [vid]);
    summary[table] = r.rowCount;
  }

  // Layer 1
  const r1 = await client.query('DELETE FROM asset WHERE vidyalaya_id = $1', [vid]);
  summary.asset = r1.rowCount;

  // Layer 0 (root transactional)
  const rootTables = ['stock_ledger', 'opening_balance_snapshot'];
  for (const table of rootTables) {
    const r = await client.query(`DELETE FROM "${table}" WHERE vidyalaya_id = $1`, [vid]);
    summary[table] = r.rowCount;
  }

  // Audit log (tenant-scoped)
  const rAudit = await client.query('DELETE FROM audit_log WHERE vidyalaya_id = $1', [vid]);
  summary.audit_log = rAudit.rowCount;

  return summary;
}

// ====================================================================
// POST /reset-data — Factory Reset (purge all data, preserve vidyalaya row)
// ====================================================================
router.post('/reset-data', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const vid = req.user.vidyalaya_id;
    const { password } = req.body;

    if (!vid) return res.status(400).json({ success: false, error: 'No Vidyalaya associated' });
    if (!password) return res.status(400).json({ success: false, error: 'Password is required for verification' });

    // Re-authenticate
    await reAuthenticate(client, req.user.userId, password);

    await client.query('BEGIN');

    // 1. Disable protective triggers
    await disableTriggers(client);

    // 2. Purge all transactional data
    const summary = await purgeTransactionalData(client, vid);

    // 3. Also purge configuration data (factory reset)
    const configTables = ['operational_department', 'location', 'supplier'];
    for (const table of configTables) {
      const r = await client.query(`DELETE FROM "${table}" WHERE vidyalaya_id = $1`, [vid]);
      summary[table] = r.rowCount;
    }

    // 4. Re-enable triggers
    await enableTriggers(client);

    await client.query('COMMIT');

    // Calculate total deleted
    const totalDeleted = Object.values(summary).reduce((a, b) => a + b, 0);

    success(res, {
      message: `Factory reset complete. ${totalDeleted} records deleted across ${Object.keys(summary).length} tables.`,
      summary,
      totalDeleted
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Always re-enable triggers even on failure
    await enableTriggers(client).catch(() => {});
    if (err.message === 'INVALID_PASSWORD') {
      return res.status(401).json({ success: false, error: 'Incorrect password. Operation cancelled.' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// ====================================================================
// POST /delete-account — Permanently delete Vidyalaya + all data
// Only the primary admin (lowest user ID) can perform this.
// ====================================================================
router.post('/delete-account', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const vid = req.user.vidyalaya_id;
    const { password, confirmPhrase } = req.body;

    if (!vid) return res.status(400).json({ success: false, error: 'No Vidyalaya associated' });
    if (!password) return res.status(400).json({ success: false, error: 'Password is required' });
    if (confirmPhrase !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({ success: false, error: 'Please type "DELETE MY ACCOUNT" to confirm' });
    }

    // Check if current user is the primary admin (lowest user ID for this vidyalaya)
    const { rows: primaryCheck } = await client.query(
      `SELECT MIN(u.id) as primary_admin_id
       FROM "user" u
       JOIN user_role ur ON ur.user_id = u.id
       JOIN role r ON r.id = ur.role_id AND r.name = 'Admin'
       WHERE u.vidyalaya_id = $1 AND u.is_deleted = false`,
      [vid]
    );
    if (!primaryCheck[0] || primaryCheck[0].primary_admin_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the primary administrator (the user who registered this Vidyalaya) can delete the account.'
      });
    }

    // Re-authenticate
    await reAuthenticate(client, req.user.userId, password);

    await client.query('BEGIN');

    // 1. Disable protective triggers
    await disableTriggers(client);

    // 2. Purge all transactional data
    await purgeTransactionalData(client, vid);

    // 3. Purge configuration data
    const configTables = ['operational_department', 'location', 'supplier'];
    for (const table of configTables) {
      await client.query(`DELETE FROM "${table}" WHERE vidyalaya_id = $1`, [vid]);
    }

    // 4. Delete user roles for all users of this vidyalaya
    await client.query(
      `DELETE FROM user_role WHERE user_id IN (SELECT id FROM "user" WHERE vidyalaya_id = $1)`,
      [vid]
    );

    // 5. Delete all users of this vidyalaya
    await client.query('DELETE FROM "user" WHERE vidyalaya_id = $1', [vid]);

    // 6. Delete the vidyalaya record itself
    await client.query('DELETE FROM vidyalaya WHERE id = $1', [vid]);

    // 7. Re-enable triggers
    await enableTriggers(client);

    await client.query('COMMIT');

    success(res, { message: 'Account deleted permanently. You will be logged out.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await enableTriggers(client).catch(() => {});
    if (err.message === 'INVALID_PASSWORD') {
      return res.status(401).json({ success: false, error: 'Incorrect password. Operation cancelled.' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// ==================== LIST VIDYALAYAS (SuperAdmin Only) ====================
router.get('/', withSuperAdmin(async (req, res) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Only System Administrators can manage Vidyalayas' });
  }

  const { rows } = await db.query(
    `SELECT v.*, 
            COUNT(DISTINCT u.id) as user_count,
            (SELECT u2.name FROM "user" u2 WHERE u2.vidyalaya_id = v.id AND u2.is_deleted = false ORDER BY u2.id ASC LIMIT 1) as admin_name,
            (SELECT u2.email FROM "user" u2 WHERE u2.vidyalaya_id = v.id AND u2.is_deleted = false ORDER BY u2.id ASC LIMIT 1) as admin_email,
            (SELECT u2.employee_code FROM "user" u2 WHERE u2.vidyalaya_id = v.id AND u2.is_deleted = false ORDER BY u2.id ASC LIMIT 1) as admin_emp_code
     FROM vidyalaya v
     LEFT JOIN "user" u ON u.vidyalaya_id = v.id AND u.is_deleted = false
     GROUP BY v.id
     ORDER BY CASE WHEN v.status = 'PENDING' THEN 0 ELSE 1 END, v.id DESC`
  );
  success(res, rows);
}));

// ==================== UPDATE VIDYALAYA ====================
router.put('/:id', withSuperAdmin(async (req, res) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Only System Administrators can manage Vidyalayas' });
  }

  let { kv_name_en, kv_name_hi, regional_office_en, regional_office_hi, status, is_active } = req.body;
  const vidyalayaId = parseInt(req.params.id, 10);

  // If status is being updated to APPROVED and is_active wasn't explicitly given, activate it
  if (status === 'APPROVED' && is_active === undefined) {
    is_active = true;
  } else if (status === 'REJECTED' && is_active === undefined) {
    is_active = false;
  }

  const { rows } = await db.query(
    `UPDATE vidyalaya 
     SET kv_name_en = COALESCE($1, kv_name_en),
         kv_name_hi = COALESCE($2, kv_name_hi),
         regional_office_en = COALESCE($3, regional_office_en),
         regional_office_hi = COALESCE($4, regional_office_hi),
         status = COALESCE($5, status),
         is_active = COALESCE($6, is_active)
     WHERE id = $7 
     RETURNING *`,
    [kv_name_en, kv_name_hi, regional_office_en, regional_office_hi, status, is_active, vidyalayaId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Vidyalaya not found' });
  }

  success(res, rows[0]);
}));

module.exports = router;
