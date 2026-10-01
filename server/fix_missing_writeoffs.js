require('dotenv').config();
const db = require('./config/db');

async function fix() {
  try {
    // Legacy sanctions
    const { rows: legacySanctions } = await db.rawQuery(`
      SELECT s.sanction_no, s.sanction_date, s.financial_year, s.vidyalaya_id, s.sanctioned_by, ce.asset_id, ce.id as condemnation_id
      FROM sanction s
      JOIN condemnation_entry ce ON ce.id = s.condemnation_id
    `);

    for (const s of legacySanctions) {
      const { rows: assetRow } = await db.rawQuery(`
        SELECT sl.* FROM asset a 
        JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
        WHERE a.id = $1
      `, [s.asset_id]);

      if (assetRow.length > 0) {
        const o = assetRow[0];
        
        // Check if write-off already exists for this sanction
        const { rows: existing } = await db.rawQuery(`
          SELECT id FROM stock_ledger 
          WHERE entry_type = 'WRITE_OFF' 
          AND sanction_no = $1 
          AND item_description = $2
        `, [s.sanction_no, o.item_description]);

        if (existing.length === 0) {
          await db.rawQuery(
            `INSERT INTO stock_ledger
             (ledger_type, entry_type, is_consumable, funding_head_id, department_id, operational_department_id,
              financial_year, entry_date, item_description, machine_no, code_no,
              quantity, rate, amount, location_id, in_charge_id,
              sanction_no, sanction_date, remarks, created_by, classification_status, vidyalaya_id)
             VALUES ($1, 'WRITE_OFF', $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'CLASSIFIED', $19)`,
            [
              o.ledger_type, o.is_consumable, o.funding_head_id, o.department_id, o.operational_department_id,
              s.financial_year, o.item_description, o.machine_no, o.code_no,
              1, o.rate, o.amount, o.location_id, o.in_charge_id,
              s.sanction_no, s.sanction_date,
              `Condemnation Sanctioned`, s.sanctioned_by, s.vidyalaya_id
            ]
          );
          console.log(`Created legacy write-off for asset ${s.asset_id}`);
        }
      }
    }

    // Master sanctions
    const { rows: masterSanctions } = await db.rawQuery(`
      SELECT s.sanction_no, s.sanction_date, s.financial_year, s.vidyalaya_id, s.sanctioned_by, s.condemnation_master_id
      FROM sanction s
      WHERE s.condemnation_master_id IS NOT NULL
    `);

    for (const s of masterSanctions) {
      const { rows: items } = await db.rawQuery(`
        SELECT ci.quantity_condemned, a.id as asset_id, sl.*
        FROM condemnation_items ci
        JOIN asset a ON a.id = ci.asset_id
        JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
        WHERE ci.condemnation_master_id = $1
      `, [s.condemnation_master_id]);

      for (const o of items) {
        // Check if exists
        const { rows: existing } = await db.rawQuery(`
          SELECT id FROM stock_ledger 
          WHERE entry_type = 'WRITE_OFF' 
          AND sanction_no = $1 
          AND item_description = $2
        `, [s.sanction_no, o.item_description]);

        if (existing.length === 0) {
          await db.rawQuery(
            `INSERT INTO stock_ledger
             (ledger_type, entry_type, is_consumable, funding_head_id, department_id, operational_department_id,
              financial_year, entry_date, item_description, machine_no, code_no,
              quantity, rate, amount, location_id, in_charge_id,
              sanction_no, sanction_date, remarks, created_by, classification_status, vidyalaya_id)
             VALUES ($1, 'WRITE_OFF', $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'CLASSIFIED', $19)`,
            [
              o.ledger_type, o.is_consumable, o.funding_head_id, o.department_id, o.operational_department_id,
              s.financial_year, o.item_description, o.machine_no, o.code_no,
              o.quantity_condemned || 1, o.rate, o.amount, o.location_id, o.in_charge_id,
              s.sanction_no, s.sanction_date,
              `Condemnation Sanctioned`, s.sanctioned_by, s.vidyalaya_id
            ]
          );
          console.log(`Created master write-off for asset ${o.asset_id}`);
        }
      }
    }

    console.log('Done fixing write-offs.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

fix();
