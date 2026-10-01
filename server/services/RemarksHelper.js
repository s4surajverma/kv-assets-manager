/**
 * Centralized Remarks Helper for Stock Register
 * ──────────────────────────────────────────────
 * Generates and appends structured, timestamped remark entries
 * to the asset.remarks column. This is the SINGLE source of
 * remark formatting for the entire custody management module.
 *
 * IMPORTANT: This helper is transaction-safe — it must be called
 * within an existing DB transaction (client) to guarantee atomicity.
 */

/**
 * Append a structured remark to an asset's remarks column.
 * Uses a single UPDATE with COALESCE + concat to avoid race conditions.
 *
 * @param {object} client   - Transaction-aware DB client
 * @param {number} assetId  - The asset ID
 * @param {number} vid      - vidyalaya_id
 * @param {string} action   - 'ISSUED' | 'RETURNED' | 'PARTIALLY_RETURNED' | 'CANCELLED'
 * @param {object} details  - Movement details for the remark
 * @param {number} details.quantity   - Number of units
 * @param {string} details.targetName - Name of department/user
 * @param {string} details.purpose    - Purpose of movement
 * @param {string} details.issueNo    - Issue reference number
 * @param {string} [details.condition] - Condition at return (for return remarks)
 */
async function appendMovementRemark(client, assetId, vid, action, details) {
  const now = new Date();
  const ts = now.toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) + ' ' + now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const { rows } = await client.query('SELECT asset_number, stock_ledger_id FROM asset WHERE id = $1 AND vidyalaya_id = $2', [assetId, vid]);
  if (rows.length === 0) return;
  const assetNumber = rows[0].asset_number;
  const stockLedgerId = rows[0].stock_ledger_id;

  let line = '';
  const prefix = `[${ts}] ${assetNumber ? `${assetNumber} - ` : ''}`;

  switch (action) {
    case 'ISSUED':
      line = `${prefix}ISSUED: ${details.quantity} unit(s) to ${details.targetName} (Purpose: ${details.purpose}) vide No: ${details.issueNo}`;
      break;
    case 'RETURNED':
      line = `${prefix}RETURNED: ${details.quantity} unit(s) from ${details.targetName} (Condition: ${details.condition || 'N/A'}) vide No: ${details.issueNo}`;
      break;
    case 'PARTIALLY_RETURNED':
      line = `${prefix}PARTIAL RETURN: ${details.quantity} unit(s) from ${details.targetName} (Condition: ${details.condition || 'N/A'}) vide No: ${details.issueNo}`;
      break;
    case 'CANCELLED':
      line = `${prefix}CANCELLED: Issue No. ${details.issueNo} — ${details.quantity} unit(s) to ${details.targetName}`;
      break;
    default:
      line = `${prefix}MOVEMENT: ${action} — ${details.issueNo}`;
  }

  // Atomic append to stock_ledger
  await client.query(
    `UPDATE stock_ledger
     SET remarks = CASE
       WHEN (remarks IS NULL OR remarks = '') THEN $1
       ELSE remarks || E'\n' || $1
     END
     WHERE id = $2 AND vidyalaya_id = $3`,
    [line, stockLedgerId, vid]
  );
}

module.exports = { appendMovementRemark };
