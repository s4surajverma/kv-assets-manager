const router = require('express').Router();
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, paginated } = require('../utils/responseHelper');

// GET /api/v1/audit/logs (filter by vidyalaya_id on read)
router.get('/logs', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { table, record_id, user_id, from, to, page = 1, limit = 50 } = req.query;
    let sql = `SELECT al.*, u.name AS changed_by_name, u.employee_code AS changed_by_empcode
               FROM audit_log al
               LEFT JOIN "user" u ON u.id = al.changed_by`;
    const params = [vid];
    const where = ['al.vidyalaya_id = $1'];

    if (table) { params.push(table); where.push(`al.table_name = $${params.length}`); }
    if (record_id) { params.push(record_id); where.push(`al.record_id = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`al.changed_by = $${params.length}`); }
    if (from) { params.push(from); where.push(`al.changed_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`al.changed_at <= $${params.length}`); }
    sql += ' WHERE ' + where.join(' AND ');

    const countSql = sql.replace(/SELECT [\s\S]*? FROM/i, 'SELECT COUNT(*) FROM');
    const { rows: c } = await db.query(countSql, params);
    const total = parseInt(c[0].count, 10);

    sql += ' ORDER BY al.changed_at DESC';
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/v1/audit/trail/:table/:id
router.get('/trail/:table/:id', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query(
      `SELECT al.*, u.name AS changed_by_name, u.employee_code AS changed_by_empcode
       FROM audit_log al
       LEFT JOIN "user" u ON u.id = al.changed_by
       WHERE al.table_name = $1 AND al.record_id = $2 AND al.vidyalaya_id = $3
       ORDER BY al.changed_at ASC`,
      [req.params.table, req.params.id, vid]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

module.exports = router;
