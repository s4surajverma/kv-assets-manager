require('dotenv').config();
const db = require('./config/db');
db.rawQuery(`
  SELECT m.*,
         od_from.name AS from_department_name,
         od_to.name   AS to_department_name,
         u_to.name    AS to_user_name,
         u_by.name    AS issued_by_name,
         (SELECT SUM(quantity_issued) FROM non_consumable_issue_items WHERE issue_master_id = m.id) AS total_qty_issued,
         (SELECT SUM(quantity_returned) FROM non_consumable_issue_items WHERE issue_master_id = m.id) AS total_qty_returned
  FROM non_consumable_issue_master m
  LEFT JOIN operational_department od_from ON od_from.id = m.issued_from_department_id
  LEFT JOIN operational_department od_to ON od_to.id = m.issued_to_department_id
  LEFT JOIN "user" u_to ON u_to.id = m.issued_to_user_id
  LEFT JOIN "user" u_by ON u_by.id = m.issued_by_user_id
`).then(r => console.log(JSON.stringify(r.rows, null, 2)))
  .catch(console.error)
  .finally(() => process.exit());
