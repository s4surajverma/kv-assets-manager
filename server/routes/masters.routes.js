const router = require('express').Router();
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, created, error } = require('../utils/responseHelper');

// ============ FUNDING HEADS (global) ============
router.get('/funding-heads', async (_req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM funding_head WHERE is_active = true ORDER BY code');
    success(res, rows);
  } catch (e) { next(e); }
});

// ============ ASSET HEADS / Department (global) ============
router.get('/asset-heads', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT d.*, ac.name AS category_name, ac.wdv_rate
       FROM department d
       LEFT JOIN asset_category ac ON ac.id = d.category_id
       ORDER BY d.code`
    );
    success(res, rows);
  } catch (e) { next(e); }
});

// ============ OPERATIONAL DEPARTMENTS (tenant-scoped) ============
router.get('/departments', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT od.*, u.name AS incharge_name, u.employee_code AS incharge_employee_code
       FROM operational_department od
       LEFT JOIN "user" u ON u.id = od.incharge_id
       WHERE od.vidyalaya_id = $1
       ORDER BY od.name`,
      [req.user.vidyalaya_id]
    );
    success(res, rows);
  } catch (e) { next(e); }
});

router.post('/departments', authorize('Admin'), async (req, res, next) => {
  try {
    const { code, name, incharge_employee_code } = req.body;
    let inchargeId = null;
    if (incharge_employee_code) {
      const { rows: users } = await db.query(
        'SELECT id FROM "user" WHERE employee_code = $1 AND vidyalaya_id = $2 AND is_active = true AND is_deleted = false',
        [incharge_employee_code, req.user.vidyalaya_id]
      );
      if (users.length === 0) return error(res, `No active user found with employee code: ${incharge_employee_code}`, 400);
      inchargeId = users[0].id;
    }
    const { rows } = await db.query(
      'INSERT INTO operational_department (code, name, incharge_id, vidyalaya_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [code, name, inchargeId, req.user.vidyalaya_id]
    );
    created(res, rows[0]);
  } catch (e) { next(e); }
});

router.put('/departments/:id', authorize('Admin'), async (req, res, next) => {
  try {
    const { code, name, incharge_employee_code } = req.body;
    let inchargeId = null;
    if (incharge_employee_code) {
      const { rows: users } = await db.query(
        'SELECT id FROM "user" WHERE employee_code = $1 AND vidyalaya_id = $2 AND is_active = true AND is_deleted = false',
        [incharge_employee_code, req.user.vidyalaya_id]
      );
      if (users.length === 0) return error(res, `No active user found with employee code: ${incharge_employee_code}`, 400);
      inchargeId = users[0].id;
    }
    const { rows } = await db.query(
      `UPDATE operational_department SET code = $1, name = $2, incharge_id = $3 WHERE id = $4 AND vidyalaya_id = $5 RETURNING *`,
      [code, name, inchargeId, req.params.id, req.user.vidyalaya_id]
    );
    success(res, rows[0]);
  } catch (e) { next(e); }
});

// ============ ASSET CATEGORIES (global) ============
router.get('/asset-categories', async (_req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM asset_category ORDER BY code');
    success(res, rows);
  } catch (e) { next(e); }
});

router.put('/asset-categories/:id', async (req, res, next) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'Unauthorized to manage global asset rules' });
  }
  try {
    const { wdv_rate, slm_rate_pre_2011, slm_rate_post_2011 } = req.body;
    const { rows } = await db.query(
      `UPDATE asset_category SET wdv_rate = COALESCE($1, wdv_rate),
        slm_rate_pre_2011 = COALESCE($2, slm_rate_pre_2011),
        slm_rate_post_2011 = COALESCE($3, slm_rate_post_2011)
       WHERE id = $4 RETURNING *`,
      [wdv_rate, slm_rate_pre_2011, slm_rate_post_2011, req.params.id]
    );
    success(res, rows[0]);
  } catch (e) { next(e); }
});

// ============ LOCATIONS (tenant-scoped) ============
router.get('/locations', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { asset_head_id } = req.query;
    let sql = 'SELECT * FROM location WHERE vidyalaya_id = $1 AND is_active = true';
    const params = [vid];
    if (asset_head_id) { params.push(asset_head_id); sql += ` AND department_id = $${params.length}`; }
    sql += ' ORDER BY name';
    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (e) { next(e); }
});

router.post('/locations', authorize('Admin', 'StockHolder'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { name, building, room_number, department_id } = req.body;
    const { rows } = await db.query(
      'INSERT INTO location (name, building, room_number, department_id, vidyalaya_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, building, room_number, department_id, vid]
    );
    created(res, rows[0]);
  } catch (e) { next(e); }
});

// ============ SUPPLIERS (tenant-scoped) ============
router.get('/suppliers', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query('SELECT * FROM supplier WHERE vidyalaya_id = $1 AND is_active = true ORDER BY name', [vid]);
    success(res, rows);
  } catch (e) { next(e); }
});

router.post('/suppliers', authorize('Admin', 'StockHolder'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { name, address, contact, gstin, pan } = req.body;
    const { rows } = await db.query(
      'INSERT INTO supplier (name, address, contact, gstin, pan, vidyalaya_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, address, contact, gstin, pan, vid]
    );
    created(res, rows[0]);
  } catch (e) { next(e); }
});

// ============ DEPRECIATION RULES (global) ============
router.get('/depreciation-rules', async (req, res, next) => {
  try {
    const { category_id } = req.query;
    let sql = 'SELECT * FROM depreciation_rule';
    const params = [];
    if (category_id) { params.push(category_id); sql += ` WHERE category_id = $1`; }
    sql += ' ORDER BY asset_name';
    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (e) { next(e); }
});

router.post('/depreciation-rules', authorize('Admin'), async (req, res, next) => {
  try {
    const { asset_name, category_id, life_years, remarks } = req.body;
    const { rows } = await db.query(
      'INSERT INTO depreciation_rule (asset_name, category_id, life_years, remarks) VALUES ($1,$2,$3,$4) RETURNING *',
      [asset_name, category_id, life_years, remarks]
    );
    created(res, rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
