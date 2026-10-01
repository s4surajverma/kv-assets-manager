import { useState, useEffect } from 'react';
import { getSchedule4Data } from '../../api/assets';
import { getFundingHeads } from '../../api/masters';
import { current } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

/* ── Indian currency formatter (no decimal, with ₹ separator) ── */
const fmt = (v) => {
  if (v === null || v === undefined) return '0';
  const n = Number(v);
  if (n === 0) return '0';
  // Negative values shown with minus sign
  const sign = n < 0 ? '-' : '';
  return sign + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n));
};

/* ── Fund-specific "Assets Written Off" header label ── */
const WO_LABELS = {
  'SF': 'Assets Written Off (SF)',
  'VVN': 'Assets Written Off (VVN)',
  'CCA': 'Assets Written Off (Plan)',
  'PM_SHRI': 'Assets Written Off (Specific Plan)',
  'ALL': 'Assets Written Off',
};

export default function RegisterView() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [funds, setFunds] = useState([]);
  const [filters, setFilters] = useState({ fund_id: '', fy: current() });

  useEffect(() => { getFundingHeads().then(r => setFunds(r.data)); }, []);

  const fetchData = () => {
    if (!filters.fund_id || !filters.fy) return;
    setLoading(true);
    getSchedule4Data(filters)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const woLabel = data ? (WO_LABELS[data.fund_code] || 'Assets Written Off') : '';

  /* ===================================================================
     GROSS BLOCK — data row renderer
     Columns: SN | Asset Heads | 1 | 2 | 3 | 4(1+2-3) | DonationInKind | WO_Gross | WO_Depr | WO_Loss
     =================================================================== */
  const GrossRow = ({ sn, label, row, bold }) => {
    const b = bold ? 'font-bold bg-gray-50' : '';
    return (
      <tr className={b}>
        <td className="s4-c text-center">{sn}</td>
        <td className="s4-c">{label}</td>
        <td className="s4-c text-right">{fmt(row.gb_opening)}</td>
        <td className="s4-c text-right">{fmt(row.gb_additions)}</td>
        <td className="s4-c text-right">{fmt(row.gb_deductions)}</td>
        <td className="s4-c text-right">{fmt(row.gb_closing)}</td>
        <td className="s4-c text-right">{fmt(row.donation_in_kind)}</td>
        <td className="s4-c text-right">{fmt(row.wo_gross)}</td>
        <td className="s4-c text-right">{fmt(row.wo_depr)}</td>
        <td className="s4-c text-right">{fmt(row.wo_loss)}</td>
      </tr>
    );
  };

  /* Section-heading row (e.g. "A. FIXED ASSETS") */
  const SectionRow = ({ label, cols = 10 }) => (
    <tr><td className="s4-c font-bold" colSpan={cols}>{label}</td></tr>
  );

  /* ===================================================================
     DEPRECIATION + NET BLOCK — data row renderer
     Columns: SN | Particulars | 5 | 6 | 7 | 8(5+6-7) | 9(4-8) | 10(1-5)
     =================================================================== */
  const DeprRow = ({ sn, label, row, bold }) => {
    const b = bold ? 'font-bold bg-gray-50' : '';
    return (
      <tr className={b}>
        <td className="s4-c text-center">{sn}</td>
        <td className="s4-c">{label}</td>
        <td className="s4-c text-right">{fmt(row.depr_opening)}</td>
        <td className="s4-c text-right">{fmt(row.depr_additions)}</td>
        <td className="s4-c text-right">{fmt(row.depr_adjustments)}</td>
        <td className="s4-c text-right">{fmt(row.depr_total)}</td>
        <td className="s4-c text-right">{fmt(row.net_current)}</td>
        <td className="s4-c text-right">{fmt(row.net_previous)}</td>
      </tr>
    );
  };

  /* ── Compute FY end date string for header ── */
  const fyEndStr = data?.fy_end_date
    ? new Date(data.fy_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return (
    <div>
      {/* ════════════ STICKY CONTROL TOOLBAR (no-print) ════════════ */}
      <div className="sticky top-16 z-20 -mt-3.5 sm:-mt-6 lg:-mt-8 -mx-3.5 sm:-mx-6 lg:-mx-8 px-3.5 sm:px-6 lg:px-8 pt-4 pb-3 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs mb-6 no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 tracking-tight">Schedule 4 — Fixed Assets</span>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
              FINANCIAL STATEMENT
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Annual gross block, additions, deductions, depreciation &amp; net block statement
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Fund:</label>
            <select
              value={filters.fund_id}
              onChange={e => setFilters({...filters, fund_id: e.target.value})}
              className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-800 shadow-2xs font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Select Fund —</option>
              <option value="all">ALL FUNDS (COMBINED)</option>
              {funds.map(f => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-700">FY:</label>
            <input
              type="text"
              value={filters.fy}
              onChange={e => setFilters({...filters, fy: e.target.value})}
              placeholder="e.g. 2025-26"
              className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-800 shadow-2xs font-medium w-24 text-center focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={loading || !filters.fund_id || !filters.fy}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded text-xs shadow-2xs transition-colors"
          >
            {loading ? 'Loading…' : 'Load Schedule'}
          </button>

          {data && (
            <button
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-black text-white font-semibold px-4 py-1.5 rounded text-xs shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <span>🖨️</span> Print Folio
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-500 text-sm bg-white rounded-lg border border-slate-200">
          Loading Schedule 4 Statement…
        </div>
      )}
      {!loading && !data && (
        <div className="text-center py-16 text-slate-500 text-sm bg-white rounded-lg border border-slate-200">
          Select a Fund and Financial Year above, then click <strong>Load Schedule</strong> to display the statement.
        </div>
      )}

      {/* Scoped print rules ensuring Schedule 4 prints strictly on ONE A4 Landscape page */}
      <style>{`
        @page {
          size: landscape;
          margin: 4mm 6mm;
        }
        @media print {
          @page {
            size: landscape;
            margin: 4mm 6mm;
          }
        }
      `}</style>

      {/* ════════════════════════════════════════════════
          SCHEDULE 4 — OFFICIAL FOLIO RENDER
          ════════════════════════════════════════════════ */}
      {data && (
        <div className="schedule4-folio print-area">

          {/* ──── OFFICIAL BILINGUAL FOLIO HEADER ──── */}
          <div className="register-folio-header pt-1 print:pt-1.5 print:mb-1 print:pb-1">
            <div className="flex items-start justify-between mb-1 pb-1">
              <div className="w-28 text-left text-[11px] font-mono font-bold text-black pt-1">
                {data.fund_code ? `FUND: ${data.fund_code}` : 'FUND: ALL'}
              </div>

              <div className="text-center flex-1">
                <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-normal pt-1 register-heading-hindi">
                  {user?.kv_name_hi || 'केन्द्रीय विद्यालय'}
                </h1>
                <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5 font-serif">
                  {user?.kv_name_en || 'KENDRIYA VIDYALAYA'}
                </h2>
                <div className="text-[10px] font-semibold text-slate-800 tracking-wider uppercase mt-0.5">
                  केन्द्रीय विद्यालय संगठन / KENDRIYA VIDYALAYA SANGATHAN
                </div>
              </div>

              <div className="w-28 text-right shrink-0">
                <span className="register-badge-box">SCHEDULE {data.schedule_label || '4'}</span>
              </div>
            </div>

            {/* Banner Title */}
            <div className="text-center border-t border-b border-black py-1 my-1">
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-black font-serif">
                SCHEDULE {data.schedule_label} - FIXED ASSETS AS ON {fyEndStr}
              </h3>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              TABLE 1 — GROSS BLOCK
              ═══════════════════════════════════════════ */}
          <div className="overflow-x-auto mb-3 print:mb-1">
            <table className="schedule4-table w-full">
              <thead>
                {/* Row 1: GROSS BLOCK + Assets Written Off */}
                <tr>
                  <th colSpan={6} className="s4-h text-center bg-gray-100 text-xs uppercase tracking-wide">Gross Block</th>
                  <th className="s4-h text-center bg-gray-100"></th>
                  <th colSpan={3} className="s4-h text-center bg-gray-100 text-xs uppercase tracking-wide">{woLabel}</th>
                </tr>

                {/* Row 2: Column descriptions */}
                <tr>
                  <th className="s4-h w-8 text-center">SN</th>
                  <th className="s4-h text-left">Assets Heads</th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    Cost / Valuation as at beginning of the year
                  </th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    Additions during the year
                  </th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    Deduction/ Adjustment during the year
                  </th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    Closing Balance at the year end
                  </th>
                  <th className="s4-h text-center text-[9px] leading-tight">
                    Donation in kind of assets
                  </th>
                  <th className="s4-h text-center text-[9px] leading-tight">
                    Deduction from gross block (100%)
                  </th>
                  <th className="s4-h text-center text-[9px] leading-tight">
                    Deduction from Depreciation Block (upto max. 95%)
                  </th>
                  <th className="s4-h text-center text-[9px] leading-tight">
                    Loss on disposal of fixed assets (min. 5%)
                  </th>
                </tr>

                {/* Row 3: Column numbers */}
                <tr className="col-numbers">
                  <th></th>
                  <th></th>
                  <th>1</th>
                  <th>2</th>
                  <th>3</th>
                  <th>4(1+2-3)</th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {/* A. FIXED ASSETS */}
                <SectionRow label="A.  FIXED ASSETS" />

                {/* 12 asset head rows — always rendered, even if zero */}
                {data.rows.map(r => (
                  <GrossRow key={r.sn} sn={r.sn} label={r.label} row={r} />
                ))}

                {/* TOTAL (A) */}
                <GrossRow label="TOTAL (A)" row={data.totalA} bold />

                {/* B. Capital Work in Progress */}
                <tr>
                  <td className="s4-c text-center font-bold">B</td>
                  <td className="s4-c font-semibold">{data.cwip.label}</td>
                  <td className="s4-c text-right">{fmt(data.cwip.gb_opening)}</td>
                  <td className="s4-c text-right">{fmt(data.cwip.gb_additions)}</td>
                  <td className="s4-c text-right">{fmt(data.cwip.gb_deductions)}</td>
                  <td className="s4-c text-right">{fmt(data.cwip.gb_closing)}</td>
                  <td className="s4-c" colSpan={4}></td>
                </tr>

                {/* Intangible Assets header */}
                <SectionRow label="    Intangible Assets" />

                {/* C. Computer Software etc. */}
                <GrossRow sn="C" label={data.intangible.label} row={data.intangible} />

                {/* GRAND TOTAL (A+B+C) */}
                <GrossRow label="GRAND TOTAL (A+B+C)" row={data.grandTotal} bold />
              </tbody>
            </table>
          </div>

          {/* ═══════════════════════════════════════════
              TABLE 2 — DEPRECIATION BLOCK + NET BLOCK
              ═══════════════════════════════════════════ */}
          <div className="overflow-x-auto mb-4 print:mb-0">
            <table className="schedule4-table">
              <thead>
                {/* Row 1: Section headers */}
                <tr>
                  <th colSpan={6} className="s4-h text-center bg-gray-100 text-xs uppercase tracking-wide">Depreciation Block</th>
                  <th colSpan={2} className="s4-h text-center bg-gray-100 text-xs uppercase tracking-wide">Net Block</th>
                </tr>

                {/* Row 2: Column descriptions */}
                <tr>
                  <th className="s4-h w-8 text-center">SN</th>
                  <th className="s4-h text-left">PARTICULARS</th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    As at the beginning of the year
                  </th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    Additions during the year
                  </th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    Adjustment/Deduction during the year
                  </th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    Total up to year end
                  </th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    As at the current year end
                  </th>
                  <th className="s4-h text-right text-[9px] leading-tight">
                    As at the previous year end
                  </th>
                </tr>

                {/* Row 3: Column numbers */}
                <tr className="col-numbers">
                  <th></th>
                  <th></th>
                  <th>5</th>
                  <th>6</th>
                  <th>7</th>
                  <th>8(5+6-7)</th>
                  <th>9(4-8)</th>
                  <th>10(1-5)</th>
                </tr>
              </thead>

              <tbody>
                {/* A. FIXED ASSETS */}
                <SectionRow label="A.  FIXED ASSETS" cols={8} />

                {/* 12 rows */}
                {data.rows.map(r => (
                  <DeprRow key={r.sn} sn={r.sn} label={r.label} row={r} />
                ))}

                {/* TOTAL (A) */}
                <DeprRow label="TOTAL (A)" row={data.totalA} bold />

                {/* B. Capital Work in Progress (no depr data — only net block) */}
                <tr>
                  <td className="s4-c text-center font-bold">B</td>
                  <td className="s4-c font-semibold">{data.cwip.label}</td>
                  <td className="s4-c" colSpan={4}></td>
                  <td className="s4-c text-right font-bold">{fmt(data.cwip.net_current)}</td>
                  <td className="s4-c text-right">{fmt(data.cwip.net_previous)}</td>
                </tr>

                {/* Intangible Assets header */}
                <SectionRow label="    Intangible Assets" cols={8} />

                {/* C. Computer Software etc. */}
                <DeprRow sn="C" label={data.intangible.label} row={data.intangible} />

                {/* GRAND TOTAL */}
                <DeprRow label="GRAND TOTAL (A+B+C)" row={data.grandTotal} bold />
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}
