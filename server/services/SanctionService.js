const db = require('../config/db');
const { getContext } = require('../config/tenantContext');

/**
 * Sanction authority routing and limit enforcement.
 * Limits are enforced at DB trigger level too (double safety).
 */
class SanctionService {
  static LIMITS = {
    PRINCIPAL: 500,
    VMC: 200000,
    REGIONAL_OFFICER: null,
    KVS_HQ: null,
  };

  /**
   * Validate sanction amount against authority limits.
   * Throws if limit would be exceeded.
   */
  async validateSanction(amount, authority, financialYear) {
    const limit = SanctionService.LIMITS[authority];
    if (limit === null) return true; // No cap for RO/HQ

    if (authority === 'PRINCIPAL') {
      if (amount > limit) {
        throw Object.assign(
          new Error(`Principal can only sanction up to Rs.${limit}. Amount Rs.${amount} requires VMC approval.`),
          { statusCode: 400 }
        );
      }
    } else if (authority === 'VMC') {
      const ctx = getContext();
      const vid = ctx ? ctx.vidyalayaId : 1;
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(sanctioned_amount), 0) AS used
         FROM sanction
         WHERE sanctioning_authority = 'VMC' AND financial_year = $1 AND vidyalaya_id = $2`,
        [financialYear, vid]
      );
      const used = parseFloat(rows[0].used);
      if (used + amount > limit) {
        throw Object.assign(
          new Error(
            `VMC yearly limit: Rs.${limit}. Used: Rs.${used}. Remaining: Rs.${limit - used}. ` +
            `Amount Rs.${amount} requires Regional Officer approval.`
          ),
          { statusCode: 400 }
        );
      }
    }

    return true;
  }

  /**
   * Auto-route to the correct authority based on amount.
   */
  async autoRoute(amount, financialYear, isFraud = false) {
    if (isFraud) return 'KVS_HQ';
    if (amount <= 500) return 'PRINCIPAL';

    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;
    const { rows } = await db.query(
      `SELECT COALESCE(SUM(sanctioned_amount), 0) AS used
       FROM sanction
       WHERE sanctioning_authority = 'VMC' AND financial_year = $1 AND vidyalaya_id = $2`,
      [financialYear, vid]
    );
    const vmcUsed = parseFloat(rows[0].used);
    if (vmcUsed + amount <= 200000) return 'VMC';

    return 'REGIONAL_OFFICER';
  }

  /**
   * Get current limits and usage for an authority.
   */
  async getLimits(authority, financialYear) {
    const limit = SanctionService.LIMITS[authority];
    if (limit === null) {
      return { authority, limit: 'UNLIMITED', used: 0, remaining: 'UNLIMITED' };
    }

    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;
    const { rows } = await db.query(
      `SELECT COALESCE(SUM(sanctioned_amount), 0) AS used
       FROM sanction
       WHERE sanctioning_authority = $1 AND financial_year = $2 AND vidyalaya_id = $3`,
      [authority, financialYear, vid]
    );
    const used = parseFloat(rows[0].used);

    return {
      authority,
      limit,
      used,
      remaining: +(limit - used).toFixed(2),
    };
  }
}

module.exports = new SanctionService();
