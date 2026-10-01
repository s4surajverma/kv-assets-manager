require('dotenv').config();
const db = require('./config/db');

const sql = `
ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS depreciation_method VARCHAR(20) DEFAULT 'BOTH'
    CHECK (depreciation_method IN ('SLM_PRE_2011', 'WDV_POST_2011', 'BOTH'));
ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS depr_pre_2011 DECIMAL(14,2) DEFAULT 0;
ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS depr_post_2011 DECIMAL(14,2) DEFAULT 0;
ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS years_pre_2011 INT DEFAULT 0;
ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS years_post_2011 INT DEFAULT 0;
ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS slm_rate_pre DECIMAL(5,4);
ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS wdv_rate_post DECIMAL(5,4);
`;

(async () => {
  try {
    await db.rawQuery(sql);
    console.log('Migration applied successfully.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
