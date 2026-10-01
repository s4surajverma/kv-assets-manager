import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRegister } from '../../api/stock';
import { getDepartments, getFundingHeads, getAssetHeads } from '../../api/masters';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatCurrency } from '../../utils/helpers';

export default function StockRegisterView() {
  const [entries, setEntries] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(false);
  const [depts, setDepts] = useState([]);
  const [funds, setFunds] = useState([]);
  const [ledgerType, setLedgerType] = useState('CS24');
  const { user, hasRole } = useAuth();
  const isStockHolder = hasRole('StockHolder') && !hasRole('Admin');
  const [filters, setFilters] = useState({
    operational_dept_id: isStockHolder && user?.department_id ? String(user.department_id) : '',
    asset_head_id: '',
    fund_id: '', fy: '', item: ''
  });

  const [assetHeads, setAssetHeads] = useState([]);

  useEffect(() => {
    getDepartments().then(r => setDepts(r.data));
    getFundingHeads().then(r => setFunds(r.data));
    getAssetHeads().then(r => setAssetHeads(r.data));
  }, []);

  // Auto-load on mount with default filters
  useEffect(() => { fetchData(); }, [ledgerType]);

  const fetchData = () => {
    setLoading(true);
    const params = { ...filters, ledger_type: ledgerType };
    Object.keys(params).forEach(k => !params[k] && delete params[k]);
    getRegister(params)
      .then(r => { setEntries(r.data.entries || []); setGrouped(r.data.grouped || {}); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const isCS24A = ledgerType === 'CS24A';
  const title = isCS24A
    ? 'STOCK ACCOUNT OF ARTICLES CONSUMABLE'
    : 'STOCK ACCOUNT OF ARTICLES (NON-CONSUMABLE)';
  const formLabel = isCS24A ? 'CS-24A' : 'CS-24';
  const groupEntries = Object.entries(grouped);

  return (
    <div>
      {/* Sticky Header, Controls & Filters Bar (Screen Only) */}
      <div className="sticky top-16 z-20 -mt-3.5 sm:-mt-6 lg:-mt-8 -mx-3.5 sm:-mx-6 lg:-mx-8 px-3.5 sm:px-6 lg:px-8 pt-4 pb-3 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs mb-6 no-print">
        {/* Header & Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Stock Register Folio View — {formLabel}</h2>
            <p className="text-xs text-gray-500">
              True Physical Ledger Format • A4 Landscape • 1 Page per Article Account
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link to="/stock" className="border border-gray-300 bg-white px-3 py-1.5 rounded text-sm hover:bg-gray-50 font-medium shadow-2xs">
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
          {/* Ledger Type Toggle */}
          <div className="flex rounded overflow-hidden border border-blue-600 shrink-0">
            <button
              onClick={() => setLedgerType('CS24')}
              className={`px-3 py-1 text-xs font-semibold ${ledgerType === 'CS24' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
            >
              CS-24 (Non-Consumable)
            </button>
            <button
              onClick={() => setLedgerType('CS24A')}
              className={`px-3 py-1 text-xs font-semibold ${ledgerType === 'CS24A' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
            >
              CS-24A (Consumable)
            </button>
          </div>

          {isStockHolder ? (
            <div className="border border-gray-300 rounded px-2.5 py-1 text-xs bg-gray-100 font-medium">
              Dept: {depts.find(d => String(d.id) === String(user?.department_id))?.name || 'Your Dept'}
            </div>
          ) : (
            <select
              value={filters.operational_dept_id}
              onChange={e => setFilters({ ...filters, operational_dept_id: e.target.value })}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="">All Departments</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          {!isCS24A && (
            <select
              value={filters.asset_head_id}
              onChange={e => setFilters({ ...filters, asset_head_id: e.target.value })}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="">All Asset Heads</option>
              {assetHeads.map(a => <option key={a.id} value={a.id}>{a.code}</option>)}
            </select>
          )}

          <select
            value={filters.fund_id}
            onChange={e => setFilters({ ...filters, fund_id: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            <option value="">All Funds</option>
            {funds.map(f => <option key={f.id} value={f.id}>{f.code}</option>)}
          </select>

          <input
            type="text"
            value={filters.fy}
            onChange={e => setFilters({ ...filters, fy: e.target.value })}
            placeholder="FY (e.g. 2025-26)"
            className="border border-gray-300 rounded px-2 py-1 text-xs w-28 bg-white"
          />

          <input
            type="text"
            value={filters.item}
            onChange={e => setFilters({ ...filters, item: e.target.value })}
            placeholder="Search article item..."
            className="border border-gray-300 rounded px-2 py-1 text-xs w-44 bg-white"
          />

          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-3.5 py-1 rounded text-xs font-semibold hover:bg-blue-700 ml-auto cursor-pointer"
          >
            Filter
          </button>
        </div>

        {/* Folio Count indicator (Screen Only) */}
        {!loading && groupEntries.length > 0 && (
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong>{groupEntries.length}</strong> folio(s). Each folio will print as an independent page with header, ruled lines, and signature attestations.
            </span>
            <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              Orientation: Landscape A4
            </span>
          </div>
        )}
      </div>

      {/* Loading / Empty */}
      {loading && (
        <div className="text-center py-12 text-gray-500 text-sm">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mb-2"></div>
          <div>Loading physical register folios...</div>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm">
          No stock records found matching filters. Adjust criteria and click Filter.
        </div>
      )}

      {/* Register Folios (1 Folio per Item) */}
      {!loading && groupEntries.length > 0 && (
        <div className="print-area">

          <div className="space-y-8 print:space-y-0">
            {groupEntries.map(([itemDesc, rows], folioIdx) => (
              <div key={itemDesc} className="register-folio">
                {/* Folio Paper Header */}
                <div className="register-folio-header pt-1 print:pt-1.5">
                  {/* Top Bar: Folio Number | Bilingual School Heading | Form Badge */}
                  <div className="flex items-start justify-between mb-1 pb-1">
                    <div className="w-24 text-left text-[11px] font-mono text-gray-500 print:text-black pt-1">
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

                    <div className="w-24 text-right shrink-0">
                      <span className="register-badge-box">{formLabel}</span>
                    </div>
                  </div>

                  {/* Register Title Banner */}
                  <div className="text-center border-t border-b border-black py-1 my-1.5">
                    <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-black font-serif">
                      {title}
                    </h3>
                  </div>

                  {/* Folio Article Meta */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-black pt-0.5 px-1 gap-y-1">
                    <div className="font-serif">
                      Description of the Article: <strong className="font-bold text-black uppercase">{itemDesc}</strong>
                    </div>
                    <div className="flex gap-4 text-xs font-serif">
                      <span>Dept: <strong>{rows[0]?.operational_dept_name || 'General'}</strong></span>
                      {!isCS24A && <span>Asset Head: <strong>{rows[0]?.asset_head_code || '—'}</strong></span>}
                      <span>Fund: <strong>{rows[0]?.fund_code || '—'}</strong></span>
                      <span>FY: <strong>{rows[0]?.financial_year || '—'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="overflow-x-auto">
                  {isCS24A ? renderCS24A(rows) : renderCS24(rows)}
                </div>

                {/* Bottom Attestation & Signature Block */}
                <div className="register-signature-block">
                  <div className="register-sig-item">
                    <div className="register-sig-line"></div>
                    <div className="font-bold">Stock In-Charge / Custodian</div>
                    <div className="text-[10px] text-gray-500 print:text-black mt-0.5">Date: _______________</div>
                  </div>

                  <div className="register-sig-item text-center">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-gray-600 print:text-black mb-1">
                      Annual Stock Verification
                    </div>
                    <div className="border border-dotted border-gray-400 px-3 py-1 text-[9px] text-gray-700 print:text-black print:border-black rounded-xs">
                      Certified that the physical stock has been verified and found in order.
                    </div>
                  </div>

                  <div className="register-sig-item">
                    <div className="register-sig-line"></div>
                    <div className="font-bold">Principal / Head of Office</div>
                    <div className="text-[10px] text-gray-500 print:text-black mt-0.5">Vidyalaya Seal</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CS-24: Non-Consumable Register ────────────────────────── */
function renderCS24(rows) {
  // Separate receipts and write-offs
  const receipts = rows.filter(r => ['RECEIPT', 'OPENING', 'RETURN'].includes(r.entry_type));
  const writeOffs = rows.filter(r => r.entry_type === 'WRITE_OFF');

  // Build combined rows: each receipt with its matching write-off if any
  const combined = receipts.map(rec => {
    const wo = writeOffs.find(w =>
      w.item_description === rec.item_description &&
      w.department_id === rec.department_id
    );
    return { receipt: rec, writeOff: wo || null };
  });

  // Also add any orphan write-offs
  const usedWoIds = new Set(combined.filter(c => c.writeOff).map(c => c.writeOff.id));
  const orphanWOs = writeOffs.filter(w => !usedWoIds.has(w.id));
  orphanWOs.forEach(wo => combined.push({ receipt: null, writeOff: wo }));

  const MIN_ROWS = 8;
  const emptyRowCount = Math.max(0, MIN_ROWS - combined.length);

  return (
    <table className="register-view-table">
      <thead>
        <tr>
          <th rowSpan="2" className="col-num">1</th>
          <th rowSpan="2">Date of<br />Receipt</th>
          <th rowSpan="2">From whom<br />received</th>
          <th rowSpan="2">Vr. No.<br />&amp; Date</th>
          <th rowSpan="2">Qty.<br />Recd.</th>
          <th rowSpan="2">Rate</th>
          <th rowSpan="2">Amount incl.<br />sales tax etc.</th>
          <th rowSpan="2">Total on<br />stock</th>
          <th colSpan="2" className="border-b border-gray-400">Articles written off</th>
          <th rowSpan="2">Balance<br />on Stock</th>
          <th colSpan="2" className="border-b border-gray-400">Initials of</th>
          <th rowSpan="2">Remarks /<br />Machine Nos.</th>
        </tr>
        <tr>
          <th>No. &amp; Date<br />of sanction</th>
          <th>Qty.<br />written off</th>
          <th>Teacher</th>
          <th>Principal</th>
        </tr>
        <tr className="col-numbers">
          {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(n => <th key={n}>{n}</th>)}
        </tr>
      </thead>
      <tbody>
        {combined.map((item, i) => {
          const row = item.receipt || item.writeOff;
          const isReceipt = Boolean(item.receipt);
          const isWriteOff = Boolean(item.writeOff);
          const wo = item.writeOff;
          return (
            <tr key={row?.id || i} className={isWriteOff && !isReceipt ? 'wo-row' : ''}>
              {/* 1. Sr. */}
              <td className="text-center font-mono text-gray-500">{i + 1}</td>
              {/* 2. Date of Receipt */}
              <td>
                {isReceipt && item.receipt ? (
                  <>
                    <div className="font-medium">{formatDate(item.receipt.entry_date)}</div>
                    {(item.receipt.stock_volume_no || item.receipt.stock_page_no) && (
                      <div className="text-[9px] text-gray-500 print:text-black">
                        Vol: {item.receipt.stock_volume_no || '-'}, Pg: {item.receipt.stock_page_no || '-'}
                      </div>
                    )}
                  </>
                ) : '—'}
              </td>
              {/* 3. From whom received */}
              <td className="text-xs max-w-[140px] !whitespace-normal break-words">{isReceipt && item.receipt ? (item.receipt.supplier_name || '—') : '—'}</td>
              {/* 4. Vr. No. & Date */}
              <td className="text-xs">{isReceipt && item.receipt ? (item.receipt.voucher_no || '—') : '—'}</td>
              {/* 5. Qty. Recd. */}
              <td className="text-right font-medium">{isReceipt && item.receipt ? item.receipt.quantity : ''}</td>
              {/* 6. Rate */}
              <td className="text-right">{isReceipt && item.receipt?.rate ? `₹${Number(item.receipt.rate).toLocaleString('en-IN')}` : ''}</td>
              {/* 7. Amount */}
              <td className="text-right font-medium">{isReceipt && item.receipt ? formatCurrency(item.receipt.amount) : ''}</td>
              {/* 8. Total on stock */}
              <td className="text-right font-semibold">{isReceipt && item.receipt ? item.receipt.balance_after : ''}</td>
              {/* 9. Write-off Sanction No & Date */}
              <td className="text-xs">{wo ? `${wo.sanction_no || '—'} / ${formatDate(wo.sanction_date)}` : ''}</td>
              {/* 10. Write-off Qty */}
              <td className="text-right font-medium text-red-600 print:text-black">{wo ? wo.quantity : ''}</td>
              {/* 11. Balance on stock */}
              <td className="text-right font-bold">{row?.balance_after ?? '—'}</td>
              {/* 12. Teacher Initials */}
              <td className="text-center text-xs">{row?.teacher_name ? row.teacher_name.split(' ').map(w => w[0]).join('') : ''}</td>
              {/* 13. Principal Initials */}
              <td className="text-center text-xs">{row?.principal_name ? row.principal_name.split(' ').map(w => w[0]).join('') : ''}</td>
              {/* 14. Remarks / Machine Nos */}
              <td className="text-xs max-w-[160px] !whitespace-normal break-words">
                {row?.machine_no || row?.code_no || row?.remarks || ''}
              </td>
            </tr>
          );
        })}

        {/* Empty buffer rows for authentic ledger appearance */}
        {Array.from({ length: emptyRowCount }).map((_, idx) => (
          <tr key={`empty-cs24-${idx}`} className="empty-ledger-row">
            <td className="text-center text-gray-300 font-mono text-[9px] print:text-gray-400">{combined.length + idx + 1}</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
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
  );
}

/* ─── CS-24A: Consumable Register ───────────────────────────── */
function renderCS24A(rows) {
  const MIN_ROWS = 8;
  const emptyRowCount = Math.max(0, MIN_ROWS - rows.length);

  return (
    <table className="register-view-table">
      <thead>
        <tr>
          <th rowSpan="2" className="col-num">1</th>
          <th rowSpan="2">Date of<br />Receipt</th>
          <th rowSpan="2">From whom<br />received</th>
          <th rowSpan="2">Vr. No.<br />&amp; Date</th>
          <th rowSpan="2">Qty.<br />Recd.</th>
          <th rowSpan="2">Rate</th>
          <th rowSpan="2">Amount incl.<br />sales tax etc.</th>
          <th rowSpan="2">Total on<br />stock</th>
          <th rowSpan="2">Date of<br />Issue</th>
          <th rowSpan="2">Qty.<br />Issued</th>
          <th rowSpan="2">Balance<br />on stock</th>
          <th colSpan="2" className="border-b border-gray-400">Articles written off</th>
          <th rowSpan="2">Balance<br />on stock</th>
          <th colSpan="2" className="border-b border-gray-400">Initials of</th>
          <th rowSpan="2">Remarks</th>
        </tr>
        <tr>
          <th>No. &amp; Date<br />of sanction</th>
          <th>Qty.<br />written off</th>
          <th>Teacher</th>
          <th>Principal</th>
        </tr>
        <tr className="col-numbers">
          {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].map(n => <th key={n}>{n}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const isReceipt = ['RECEIPT', 'OPENING', 'RETURN'].includes(row.entry_type);
          const isIssue = row.entry_type === 'ISSUE';
          const isWriteOff = row.entry_type === 'WRITE_OFF';
          return (
            <tr key={row.id} className={isWriteOff ? 'wo-row' : isIssue ? 'issue-row' : ''}>
              {/* 1. Sr. */}
              <td className="text-center font-mono text-gray-500">{i + 1}</td>
              {/* 2. Date of Receipt */}
              <td>
                {isReceipt ? (
                  <>
                    <div className="font-medium">{formatDate(row.entry_date)}</div>
                    {(row.stock_volume_no || row.stock_page_no) && (
                      <div className="text-[9px] text-gray-500 print:text-black">
                        Vol: {row.stock_volume_no || '-'}, Pg: {row.stock_page_no || '-'}
                      </div>
                    )}
                  </>
                ) : '—'}
              </td>
              {/* 3. From whom received */}
              <td className="text-xs max-w-[140px] !whitespace-normal break-words">{isReceipt ? (row.supplier_name || '—') : '—'}</td>
              {/* 4. Vr. No. */}
              <td className="text-xs">{isReceipt ? (row.voucher_no || '—') : '—'}</td>
              {/* 5. Qty Recd. */}
              <td className="text-right font-medium">{isReceipt ? row.quantity : ''}</td>
              {/* 6. Rate */}
              <td className="text-right">{isReceipt && row.rate ? `₹${Number(row.rate).toLocaleString('en-IN')}` : ''}</td>
              {/* 7. Amount */}
              <td className="text-right font-medium">{isReceipt ? formatCurrency(row.amount) : ''}</td>
              {/* 8. Total on stock (after receipt) */}
              <td className="text-right font-semibold">{isReceipt ? row.balance_after : ''}</td>
              {/* 9. Date of Issue */}
              <td>{isIssue ? formatDate(row.entry_date) : ''}</td>
              {/* 10. Qty Issued */}
              <td className="text-right text-amber-700 font-medium print:text-black">{isIssue ? row.quantity : ''}</td>
              {/* 11. Balance on stock (after issue) */}
              <td className="text-right">{isIssue ? row.balance_after : ''}</td>
              {/* 12. Write-off Sanction */}
              <td className="text-xs">{isWriteOff ? `${row.sanction_no || '—'} / ${formatDate(row.sanction_date)}` : ''}</td>
              {/* 13. Qty written off */}
              <td className="text-right text-red-600 font-medium print:text-black">{isWriteOff ? row.quantity : ''}</td>
              {/* 14. Balance on stock (final) */}
              <td className="text-right font-bold">{row.balance_after}</td>
              {/* 15. Teacher Initials */}
              <td className="text-center text-xs">{row.teacher_name ? row.teacher_name.split(' ').map(w => w[0]).join('') : ''}</td>
              {/* 16. Principal Initials */}
              <td className="text-center text-xs">{row.principal_name ? row.principal_name.split(' ').map(w => w[0]).join('') : ''}</td>
              {/* 17. Remarks */}
              <td className="text-xs max-w-[160px] !whitespace-normal break-words">{row.remarks || ''}</td>
            </tr>
          );
        })}

        {/* Empty buffer rows */}
        {Array.from({ length: emptyRowCount }).map((_, idx) => (
          <tr key={`empty-cs24a-${idx}`} className="empty-ledger-row">
            <td className="text-center text-gray-300 font-mono text-[9px] print:text-gray-400">{rows.length + idx + 1}</td>
            {Array.from({ length: 16 }).map((__, cIdx) => (
              <td key={cIdx}>&nbsp;</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
