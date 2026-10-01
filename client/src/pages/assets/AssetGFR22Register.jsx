import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGFR22Register } from '../../api/assets';
import { getDepartments, getFundingHeads, getAssetHeads } from '../../api/masters';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatCurrency } from '../../utils/helpers';

export default function AssetGFR22Register() {
  const [entries, setEntries] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(false);
  const [depts, setDepts] = useState([]);
  const [assetHeads, setAssetHeads] = useState([]);
  const [funds, setFunds] = useState([]);
  const { user, hasRole } = useAuth();

  const isAdmin = hasRole('Admin');
  const [filters, setFilters] = useState({
    fund_id: '', asset_head_id: '', fy: ''
  });

  useEffect(() => {
    getDepartments().then(r => setDepts(r.data));
    getAssetHeads().then(r => setAssetHeads(r.data));
    getFundingHeads().then(r => setFunds(r.data));
  }, []);

  useEffect(() => { fetchData(); }, []);

  const fetchData = () => {
    setLoading(true);
    const params = { ...filters };
    if (!isAdmin) {
      params.operational_dept_id = user?.department_id || '';
      delete params.fund_id;
      delete params.asset_head_id;
    }
    Object.keys(params).forEach(k => !params[k] && delete params[k]);
    getGFR22Register(params)
      .then(r => { setEntries(r.data.entries || []); setGrouped(r.data.grouped || {}); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const groupEntries = Object.entries(grouped);
  const MIN_ROWS = 8;

  return (
    <div>
      {/* Sticky Header, Controls & Filters Bar (Screen Only) */}
      <div className="sticky top-16 z-20 -mt-3.5 sm:-mt-6 lg:-mt-8 -mx-3.5 sm:-mx-6 lg:-mx-8 px-3.5 sm:px-6 lg:px-8 pt-4 pb-3 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs mb-6 no-print">
        {/* Header & Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Register of Fixed Assets — Form GFR-22</h2>
            <p className="text-xs text-gray-500">
              True Physical Ledger Format • A4 Landscape • 1 Page per Asset Head/Category
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link to="/assets" className="border border-gray-300 bg-white px-3 py-1.5 rounded text-sm hover:bg-gray-50 font-medium shadow-2xs">
              ← List View
            </Link>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-4 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <span>🖨️</span>
              <span>Print Folios (A4 Landscape)</span>
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs flex gap-2.5 flex-wrap items-center">
          {isAdmin && (
            <>
              <select
                value={filters.fund_id}
                onChange={e => setFilters({ ...filters, fund_id: e.target.value })}
                className="border border-gray-300 rounded px-2.5 py-1 text-xs bg-blue-50 border-blue-300 font-medium text-blue-900"
              >
                <option value="">All Funds</option>
                {funds.map(f => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
              </select>
              <select
                value={filters.asset_head_id}
                onChange={e => setFilters({ ...filters, asset_head_id: e.target.value })}
                className="border border-gray-300 rounded px-2.5 py-1 text-xs bg-white"
              >
                <option value="">All Asset Heads</option>
                {assetHeads.map(a => <option key={a.id} value={a.id}>{a.code}</option>)}
              </select>
            </>
          )}

          <input
            type="text"
            value={filters.fy}
            onChange={e => setFilters({ ...filters, fy: e.target.value })}
            placeholder="FY (e.g. 2025-26)"
            className="border border-gray-300 rounded px-2.5 py-1 text-xs w-32 bg-white"
          />

          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-4 py-1 rounded text-xs font-semibold hover:bg-blue-700 ml-auto cursor-pointer"
          >
            Filter
          </button>
        </div>

        {/* Folio Count indicator (Screen Only) */}
        {!loading && groupEntries.length > 0 && (
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong>{groupEntries.length}</strong> folio(s). Each asset account will print on a fresh A4 landscape page with ruling & signature block.
            </span>
            <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              Orientation: Landscape A4
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500 text-sm">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mb-2"></div>
          <div>Loading Fixed Assets Folios...</div>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm">
          No assets found matching filters. Adjust criteria and click Filter.
        </div>
      )}

      {/* GFR-22 Register Folios */}
      {!loading && groupEntries.length > 0 && (
        <div className="print-area">

          <div className="space-y-8 print:space-y-0">
            {groupEntries.map(([groupKey, rows], folioIdx) => {
              const categoryName = groupKey.split('|')[1] || 'GENERAL';
              const emptyRowCount = Math.max(0, MIN_ROWS - rows.length);

              return (
                <div key={groupKey} className="register-folio">
                  {/* Folio Header */}
                  <div className="register-folio-header pt-1 print:pt-1.5">
                    {/* Top Bar: Folio Number | Bilingual School Heading | Form Badge */}
                    <div className="flex items-start justify-between mb-1 pb-1">
                      <div className="w-28 text-left text-[11px] font-mono text-gray-500 print:text-black pt-1">
                        FOLIO #{folioIdx + 1}
                      </div>

                      <div className="text-center flex-1">
                        <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-normal pt-1 register-heading-hindi">
                          {user?.kv_name_hi || rows[0]?.kv_name_hi || 'केन्द्रीय विद्यालय'}
                        </h1>
                        <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5 font-serif">
                          {user?.kv_name_en || rows[0]?.kv_name_en || 'KENDRIYA VIDYALAYA'}
                        </h2>
                      </div>

                      <div className="w-28 text-right shrink-0">
                        <span className="register-badge-box">FORM GFR-22</span>
                      </div>
                    </div>

                    {/* Banner Title */}
                    <div className="text-center border-t border-b border-black py-1 my-1.5">
                      <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-black font-serif">
                        REGISTER OF FIXED ASSETS
                      </h3>
                      <div className="text-[10px] text-gray-700 print:text-black font-serif italic">
                        [See Rule 211 (2) (a)]
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-black pt-0.5 px-1 gap-y-1 font-serif">
                      <div>
                        Name and description of the Fixed Assets: <strong className="font-bold uppercase text-black">{categoryName}</strong>
                      </div>
                      <div className="flex gap-4 text-xs font-serif">
                        <span>Fund: <strong>{rows[0]?.fund_code || '—'}</strong></span>
                        <span>Asset Head: <strong>{rows[0]?.asset_head_code || '—'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Register Table */}
                  <div className="overflow-x-auto">
                    <table className="register-view-table">
                      <thead>
                        <tr>
                          <th rowSpan="2" className="col-num">1</th>
                          <th rowSpan="2">Date</th>
                          <th rowSpan="2">Particulars<br />of Asset</th>
                          <th colSpan="2" className="border-b border-gray-400">Particulars of Supplier</th>
                          <th rowSpan="2">Cost of<br />the Asset</th>
                          <th rowSpan="2">Location of<br />the Asset</th>
                          <th rowSpan="2">Remarks</th>
                        </tr>
                        <tr>
                          <th>Name and<br />Address</th>
                          <th>Bill No.<br />and Date</th>
                        </tr>
                        <tr className="col-numbers">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <th key={n}>{n}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={row.id}>
                            {/* 1. Sr. No */}
                            <td className="text-center font-mono text-gray-500">{i + 1}</td>
                            {/* 2. Date */}
                            <td className="font-medium whitespace-nowrap">{formatDate(row.purchase_date)}</td>
                            {/* 3. Particulars of Asset */}
                            <td>
                              <div className="font-semibold text-black">{row.name}</div>
                              {row.description && <div className="text-[9px] text-gray-600 print:text-black">{row.description}</div>}
                              {row.machine_no && <div className="text-[9px] text-gray-500 print:text-black">M/C: {row.machine_no}</div>}
                              <div className="text-[9px] font-medium text-gray-500 print:text-black">Qty: {row.total_units} unit(s)</div>
                            </td>
                            {/* 4. Supplier Name & Address */}
                            <td className="text-xs max-w-[150px] !whitespace-normal break-words">
                              {row.supplier_name ? (
                                <>
                                  <div className="font-medium text-black">{row.supplier_name}</div>
                                  {row.supplier_address && <div className="text-[9px] text-gray-500 print:text-black">{row.supplier_address}</div>}
                                </>
                              ) : '—'}
                            </td>
                            {/* 5. Bill No. and Date */}
                            <td className="text-xs whitespace-nowrap">
                              {row.bill_no ? (
                                <>
                                  <div className="font-medium">{row.bill_no}</div>
                                  {row.bill_date && <div className="text-[9px] text-gray-500 print:text-black">{formatDate(row.bill_date)}</div>}
                                </>
                              ) : (
                                <>
                                  {row.voucher_no ? <div>{row.voucher_no}</div> : '—'}
                                </>
                              )}
                            </td>
                            {/* 6. Cost of Asset */}
                            <td className="text-right font-bold text-black">{formatCurrency(row.total_cost)}</td>
                            {/* 7. Location */}
                            <td className="text-xs max-w-[160px] !whitespace-normal break-words">
                              {row.location_name ? (
                                <>
                                  <div className="font-medium">{row.location_name}</div>
                                  {row.building && (
                                    <div className="text-[9px] text-gray-500 print:text-black">
                                      {row.building}{row.room_number ? `, ${row.room_number}` : ''}
                                    </div>
                                  )}
                                </>
                              ) : '—'}
                              {row.stock_remarks && (
                                <div className="mt-0.5 text-[9px] text-blue-700 print:text-black italic leading-tight whitespace-pre-wrap">
                                  {row.stock_remarks}
                                </div>
                              )}
                            </td>
                            {/* 8. Remarks */}
                            <td className="text-xs max-w-[160px] !whitespace-normal break-words">
                              {row.asset_number && <div className="text-[9px] font-mono text-gray-600 print:text-black">ID: {row.asset_number}</div>}
                              <div>{row.remarks || '—'}</div>
                            </td>
                          </tr>
                        ))}

                        {/* Blank ledger buffer lines for authentic folio look */}
                        {Array.from({ length: emptyRowCount }).map((_, idx) => (
                          <tr key={`empty-gfr-${idx}`} className="empty-ledger-row">
                            <td className="text-center text-gray-300 font-mono text-[9px] print:text-gray-400">{rows.length + idx + 1}</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Statutory GFR-22 Note */}
                  <div className="mt-2 text-[9.5px] text-gray-600 print:text-black italic font-serif leading-snug">
                    * NOTE: The items of similar nature but having significant distinctive features (e.g. study table, office table, computer table, etc.) should be accounted for separately in stock.
                  </div>

                  {/* Bottom Attestation & Signature Block */}
                  <div className="register-signature-block">
                    <div className="register-sig-item">
                      <div className="register-sig-line"></div>
                      <div className="font-bold">Custodian / Stock In-Charge</div>
                      <div className="text-[10px] text-gray-500 print:text-black mt-0.5">Date: _______________</div>
                    </div>

                    <div className="register-sig-item text-center">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-gray-600 print:text-black mb-1">
                        Annual Fixed Assets Verification
                      </div>
                      <div className="border border-dotted border-gray-400 px-3 py-1 text-[9px] text-gray-700 print:text-black print:border-black rounded-xs">
                        Certified that the fixed assets have been physically verified as per GFR rules.
                      </div>
                    </div>

                    <div className="register-sig-item">
                      <div className="register-sig-line"></div>
                      <div className="font-bold">Principal / Head of Office</div>
                      <div className="text-[10px] text-gray-500 print:text-black mt-0.5">Vidyalaya Seal</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
