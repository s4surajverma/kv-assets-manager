const db = require('../config/db');
const { getContext } = require('../config/tenantContext');

/**
 * Auto-generates asset numbers in format: KVS-{DEPT}-{FY}-{SEQ}
 */
class AssetNumberService {
  async generate(deptId, financialYear) {
    const { rows: deptRows } = await db.query(
      'SELECT code FROM department WHERE id = $1',
      [deptId]
    );
    if (deptRows.length === 0) throw new Error('Department not found');
    const deptCode = deptRows[0].code;

    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;
    const { rows: seqRows } = await db.query(
      `SELECT COUNT(*) AS cnt FROM asset a
       JOIN department d ON d.id = a.department_id
       WHERE d.code = $1 AND to_char(a.purchase_date, 'YYYY') = $2 AND a.vidyalaya_id = $3`,
      [deptCode, financialYear.split('-')[0], vid]
    );
    const seq = parseInt(seqRows[0].cnt, 10) + 1;

    return `KVS-${deptCode}-${financialYear}-${String(seq).padStart(4, '0')}`;
  }
}

module.exports = new AssetNumberService();
