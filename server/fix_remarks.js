require('dotenv').config();
const db = require('./config/db');
db.rawQuery(`
  WITH moved_data AS (
    SELECT id, stock_ledger_id, remarks 
    FROM asset 
    WHERE remarks ILIKE '%ISSUED%' OR remarks ILIKE '%RETURNED%'
  )
  UPDATE stock_ledger sl
  SET remarks = md.remarks
  FROM moved_data md
  WHERE sl.id = md.stock_ledger_id;
  
  UPDATE asset 
  SET remarks = NULL 
  WHERE remarks ILIKE '%ISSUED%' OR remarks ILIKE '%RETURNED%';
`).then(() => console.log('Fixed DB data!'))
  .catch(console.error)
  .finally(() => process.exit());
