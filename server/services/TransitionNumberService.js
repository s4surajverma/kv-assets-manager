const db = require('../config/db');

/**
 * Centralized numbering service for Stock Charge Transfer official order numbers.
 * Format: SCT/{VIDYALAYA_ID}/{YEAR}/{SEQ}
 *
 * The generated number is immutable once assigned — it is written exactly once
 * during finalization and persisted permanently.
 */
class TransitionNumberService {
  /**
   * Generate the next official order number for a given vidyalaya.
   * @param {object} client - Transaction-aware DB client (for SELECT ... FOR UPDATE safety)
   * @param {number} vidyalayaId
   * @returns {string} e.g. "SCT/2/2026/0001"
   */
  async generate(client, vidyalayaId) {
    const year = new Date().getFullYear();

    // Count existing COMPLETED transitions for this vidyalaya in the current calendar year
    const { rows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM stock_transition_master
       WHERE vidyalaya_id = $1
         AND status = 'COMPLETED'
         AND EXTRACT(YEAR FROM completed_at) = $2`,
      [vidyalayaId, year]
    );

    const seq = parseInt(rows[0].cnt, 10) + 1;
    return `SCT/${vidyalayaId}/${year}/${String(seq).padStart(4, '0')}`;
  }
}

module.exports = new TransitionNumberService();
