import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDisposal, updateSale, completeDisposal } from '../../api/disposal';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function DisposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [saleForm, setSaleForm] = useState({ buyer_name: '', buyer_address: '', sale_amount: '', earnest_money: '' });
  const [completeForm, setCompleteForm] = useState({ payment_date: new Date().toISOString().split('T')[0], supervised_by: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const load = () => {
    setLoading(true);
    getDisposal(id)
      .then(r => { setData(r.data.disposal); setItems(r.data.items || []); })
      .catch(() => toast.error('Failed to load disposal'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    if (!saleForm.buyer_name.trim() || !saleForm.sale_amount) return toast.error('Buyer name and sale amount are required');
    setSubmitting(true);
    try {
      await updateSale(id, saleForm);
      toast.success('Sale details recorded');
      setShowSaleForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record sale');
    } finally { setSubmitting(false); }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!completeForm.payment_date || !completeForm.supervised_by) return toast.error('All fields required');
    setSubmitting(true);
    try {
      await completeDisposal(id, { payment_date: completeForm.payment_date, supervised_by: parseInt(completeForm.supervised_by) });
      toast.success('Disposal completed — assets marked as DISPOSED');
      setShowCompleteForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to complete disposal');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  if (!data) return <div className="text-center py-8 text-gray-400">Disposal not found</div>;

  const d = data;
  const isCompleted = d.payment_received;
  const hasSale = d.sale_amount != null;
  const condemnValue = d.master_condemn_value || d.legacy_condemn_value || 0;
  const condemnRef = d.condemnation_master_id ? `Master #${d.condemnation_master_id}` : `Legacy #${d.condemnation_id}`;
  const assetHead = d.master_asset_head_name || d.legacy_dept_name || '—';
  const fundCode = d.master_fund_code || d.legacy_fund_code || '—';

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="no-print space-y-5">
        <button onClick={() => navigate('/disposal')} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Disposals
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Disposal #{id}</h2>
            <span className="text-xs text-gray-500 mt-1">{condemnRef} • {assetHead} • {fundCode}</span>
          </div>
          <div className="flex items-center gap-2">
            {isCompleted ? <StatusBadge status="DISPOSED" /> : hasSale ? <StatusBadge status="SALE_RECORDED" /> : <StatusBadge status="PENDING" />}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Disposal Mode', val: d.disposal_mode?.replace(/_/g, ' '), icon: '📦' },
            { label: 'Disposal Date', val: fmtDate(d.disposal_date), icon: '📅' },
            { label: 'Condemnation Value', val: formatCurrency(condemnValue), icon: '💰' },
            { label: 'Sanction No.', val: d.sanction_no || '—', icon: '📋' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{c.label}</div>
              <div className="text-sm font-semibold text-gray-900">{c.val || '—'}</div>
            </div>
          ))}
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-gray-100">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Disposal Details</h3>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ['Reserve Price', d.reserve_price ? formatCurrency(d.reserve_price) : '—'],
              ['Hazardous', d.is_hazardous ? 'Yes' : 'No'],
              ['Recycler Reg.', d.recycler_registration || '—'],
              ['Sanctioning Authority', d.sanctioning_authority || '—'],
              ['Sanctioned Amount', d.sanctioned_amount ? formatCurrency(d.sanctioned_amount) : '—'],
              ['Sanction Date', fmtDate(d.sanction_date)],
              ...(hasSale ? [
                ['Buyer', d.buyer_name || '—'],
                ['Sale Amount', formatCurrency(d.sale_amount)],
                ['Earnest Money', d.earnest_money ? formatCurrency(d.earnest_money) : '—'],
              ] : []),
              ...(isCompleted ? [
                ['Payment Date', fmtDate(d.payment_date)],
                ['Supervised By', d.supervised_by_name || '—'],
              ] : []),
              ['Created By', d.created_by_name || '—'],
              ['Created At', fmtDateTime(d.created_at)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{k}</div>
                <div className="font-semibold text-gray-800">{v}</div>
              </div>
            ))}
          </div>
          {d.remarks && (
            <div className="px-6 pb-5 pt-0 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Remarks</div>
              <p className="text-sm text-gray-700">{d.remarks}</p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Condemned Items</h3>
            <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full">{items.length} item(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-slate-50 border-b border-gray-200">
                {['#','Asset No.','Name','Purchase Date','Original Cost','Condemn. Value','Vol/Pg'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No items found.</td></tr>
                ) : items.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.asset_number || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.asset_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(item.purchase_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(item.original_cost)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{formatCurrency(item.condemnation_cost)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.stock_volume_no || '—'}/{item.stock_page_no || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowPrint(true)} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all shadow-sm">
            🖨️ Print Report
          </button>
          {hasRole('Admin') && !hasSale && !isCompleted && (
            <button onClick={() => setShowSaleForm(true)} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all">
              💳 Record Sale
            </button>
          )}
          {hasRole('Admin') && hasSale && !isCompleted && (
            <button onClick={() => setShowCompleteForm(true)} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all">
              ✅ Complete Disposal
            </button>
          )}
        </div>
      </div>

      {/* Sale Form Modal */}
      {showSaleForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Record Sale Details</h3>
            <form onSubmit={handleSaleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Name <span className="text-red-500">*</span></label>
                <input type="text" value={saleForm.buyer_name} onChange={e => setSaleForm(p => ({ ...p, buyer_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Address</label>
                <input type="text" value={saleForm.buyer_address} onChange={e => setSaleForm(p => ({ ...p, buyer_address: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Amount (₹) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" value={saleForm.sale_amount} onChange={e => setSaleForm(p => ({ ...p, sale_amount: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Earnest Money (₹)</label>
                <input type="number" step="0.01" value={saleForm.earnest_money} onChange={e => setSaleForm(p => ({ ...p, earnest_money: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                {d.reserve_price && <p className="text-xs text-gray-500 mt-1">Min 10% of reserve price: ₹{(parseFloat(d.reserve_price) * 0.10).toFixed(2)}</p>}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowSaleForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Saving…' : 'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Form Modal */}
      {showCompleteForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">✅</div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Complete Disposal</h3>
                <p className="text-xs text-gray-500 mt-0.5">This will mark all condemned assets as DISPOSED.</p>
              </div>
            </div>
            <form onSubmit={handleCompleteSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                <input type="date" value={completeForm.payment_date} onChange={e => setCompleteForm(p => ({ ...p, payment_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supervised By (User ID) <span className="text-red-500">*</span></label>
                <input type="number" value={completeForm.supervised_by} onChange={e => setCompleteForm(p => ({ ...p, supervised_by: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" required />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowCompleteForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {submitting ? 'Processing…' : 'Confirm Completion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Report Modal */}
      {showPrint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:static print:block print:p-0 print:bg-transparent">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:rounded-none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 no-print sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-bold text-gray-900">Disposal Report</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all">
                  🖨️ Print
                </button>
                <button onClick={() => setShowPrint(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg">✕</button>
              </div>
            </div>
            <div className="p-10 print-area">
              <DisposalPrintReport data={d} items={items} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== PRINT REPORT COMPONENT ========== */
function DisposalPrintReport({ data, items }) {
  if (!data) return null;
  const d = data;
  const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '____________';
  const fmtCurrency = (v) => v != null ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
  const condemnRef = d.condemnation_master_id ? `Master #${d.condemnation_master_id}` : `Legacy #${d.condemnation_id}`;
  const assetHead = d.master_asset_head_name || d.legacy_dept_name || '—';
  const fundCode = d.master_fund_code || d.legacy_fund_code || '—';
  const condemnValue = d.master_condemn_value || d.legacy_condemn_value || 0;

  return (
    <div className="font-serif text-[12px] leading-relaxed text-black max-w-[850px] mx-auto p-4 bg-white">
      {/* Folio Header */}
      <div className="border-b-2 border-black pb-3 mb-4 text-center relative">
        <div className="absolute right-0 top-0">
          <span className="register-badge-box">DISPOSAL ORDER</span>
          <span className="text-[9px] font-mono text-slate-700 block mt-0.5">FORM GFR-24</span>
        </div>
        {d.kv_name_hi && (
          <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-tight">
            {d.kv_name_hi}
          </h1>
        )}
        <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5">
          {d.kv_name_en || 'KENDRIYA VIDYALAYA'}
        </h2>
        <div className="text-[10px] font-semibold text-slate-800 tracking-wider uppercase mt-0.5">
          केन्द्रीय विद्यालय संगठन / KENDRIYA VIDYALAYA SANGATHAN
        </div>
        <p className="text-xs font-bold underline tracking-wider uppercase mt-1">
          उपकरण निस्तारण एवं विक्रय रिपोर्ट / ASSET DISPOSAL &amp; SALE REPORT
        </p>
      </div>

      {/* Meta Information */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 text-xs border border-black p-2.5 rounded bg-slate-50/50">
        <p><strong>Condemnation Ref:</strong> {condemnRef}</p>
        <p><strong>Disposal Date:</strong> {fmtDate(d.disposal_date)}</p>
        <p><strong>Disposal Mode:</strong> {d.disposal_mode?.replace(/_/g, ' ')}</p>
        <p><strong>Asset Head:</strong> {assetHead}</p>
        <p><strong>Sanction No:</strong> {d.sanction_no || '—'}</p>
        <p><strong>Sanction Date:</strong> {fmtDate(d.sanction_date)}</p>
        <p><strong>Funding Head:</strong> {fundCode}</p>
        <p><strong>Sanctioning Authority:</strong> {d.sanctioning_authority || '—'}</p>
      </div>

      {/* Financial Summary */}
      <div className="flex gap-4 mb-3 text-xs font-bold px-3 py-1.5 bg-slate-100 border border-black rounded">
        <span>Condemnation Value: {fmtCurrency(condemnValue)}</span>
        {d.reserve_price && <span>Reserve Price: {fmtCurrency(d.reserve_price)}</span>}
        {d.sale_amount && <span className="text-emerald-800 font-bold">Sale Amount: {fmtCurrency(d.sale_amount)}</span>}
      </div>

      {/* Items Table */}
      <table className="register-view-table mb-4">
        <thead>
          <tr>
            <th className="w-12 text-center">Sl.No.</th>
            <th className="w-28 text-center">Asset No.</th>
            <th className="text-left" style={{minWidth: 160}}>Name of Article</th>
            <th className="w-24 text-center">Date of Purchase</th>
            <th className="w-24 text-right">Original Cost</th>
            <th className="w-24 text-right">Condemn. Value</th>
          </tr>
          <tr className="col-numbers">
            <th>1</th>
            <th>2</th>
            <th>3</th>
            <th>4</th>
            <th>5</th>
            <th>6</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="text-center font-mono text-[7.5pt]">{idx + 1}</td>
              <td className="text-center font-mono text-[7.5pt]">{item.asset_number || '—'}</td>
              <td className="font-medium text-left">{item.asset_name || '—'}</td>
              <td className="text-center text-[7.5pt]">{item.purchase_date ? fmtDate(item.purchase_date) : '—'}</td>
              <td className="text-right font-mono">{fmtCurrency(item.original_cost)}</td>
              <td className="text-right font-mono">{fmtCurrency(item.condemnation_cost)}</td>
            </tr>
          ))}
          {/* Buffer rows */}
          {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
            <tr key={`buf-${i}`} className="empty-ledger-row h-6">
              <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sale / Buyer Information */}
      {d.buyer_name && (
        <div className="mb-4 border border-black p-2.5 rounded bg-slate-50/50">
          <p className="font-bold underline mb-1.5 text-xs">SALE &amp; REALIZATION DETAILS</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <p><strong>Buyer Name:</strong> {d.buyer_name}</p>
            <p><strong>Sale Amount Realized:</strong> {fmtCurrency(d.sale_amount)}</p>
            {d.buyer_address && <p><strong>Buyer Address:</strong> {d.buyer_address}</p>}
            {d.earnest_money && <p><strong>Earnest Money / Security:</strong> {fmtCurrency(d.earnest_money)}</p>}
          </div>
        </div>
      )}

      {d.is_hazardous && (
        <p className="text-xs mb-3 italic text-amber-900 bg-amber-50 p-2 border border-amber-200 rounded">
          <strong>Note:</strong> This disposal involves hazardous material (e-waste). Authorized Recycler Registration: {d.recycler_registration || '—'}
        </p>
      )}

      {d.remarks && (
        <p className="text-xs mb-4"><strong>Administrative Remarks:</strong> {d.remarks}</p>
      )}

      {/* Signatures */}
      <div className="register-signature-block break-inside-avoid">
        <div className="register-sig-item">
          <div className="h-10"></div>
          <div className="register-sig-line"></div>
          <div className="font-bold text-xs">{d.created_by_name || '________________'}</div>
          <div className="text-[10px] text-slate-600">Disposal Officer / In-Charge</div>
        </div>
        <div className="register-sig-item">
          <div className="h-10"></div>
          <div className="register-sig-line"></div>
          <div className="font-bold text-xs">{d.supervised_by_name || '________________'}</div>
          <div className="text-[10px] text-slate-600">Supervising Committee Member</div>
        </div>
        <div className="register-sig-item">
          <div className="h-10"></div>
          <div className="register-sig-line"></div>
          <div className="font-bold text-xs">Principal / Head of Office</div>
          <div className="text-[10px] text-slate-600">(with Official School Seal)</div>
        </div>
      </div>
    </div>
  );
}
