import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTransition, submitForVerification, cancelTransition, getOfficeOrderReport, getVerificationReport } from '../../api/transitions';

const STATUS_META = {
  DRAFT:              { label: 'Draft',              color: 'bg-slate-100 text-slate-700 border-slate-200' },
  UNDER_VERIFICATION: { label: 'Under Verification', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  COMPLETED:          { label: 'Completed',           color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CANCELLED:          { label: 'Cancelled',           color: 'bg-red-100 text-red-700 border-red-200' },
};

const REASON_LABELS = {
  TRANSFER: 'Transfer',
  RETIREMENT: 'Retirement',
  ADDITIONAL_CHARGE: 'Additional Charge',
  INTERNAL_REALLOCATION: 'Internal Reallocation',
  LONG_LEAVE: 'Long Leave',
};

export default function TransitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [transition, setTransition] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [submittingVerif, setSubmittingVerif] = useState(false);
  const [showReport, setShowReport] = useState(null); // 'office-order' | 'verification' | null
  const [reportData, setReportData] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    getTransition(id)
      .then(r => {
        setTransition(r.data.transition);
        setItems(r.data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const handleSubmitVerification = async () => {
    setSubmittingVerif(true);
    try {
      await submitForVerification(id);
      toast.success('Transition submitted for verification');
      navigate(`/transitions/${id}/verify`);
    } catch (err) {}
    finally { setSubmittingVerif(false); }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return toast.error('Cancellation reason is required');
    setCancelling(true);
    try {
      await cancelTransition(id, { cancellation_reason: cancelReason });
      toast.success('Transfer cancelled');
      setShowCancelModal(false);
      // Reload
      const r = await getTransition(id);
      setTransition(r.data.transition);
    } catch (err) {}
    finally { setCancelling(false); }
  };

  const handlePrintReport = async (type) => {
    try {
      const res = type === 'office-order'
        ? await getOfficeOrderReport(id)
        : await getVerificationReport(id);
      setReportData(res.data);
      setShowReport(type);
    } catch (err) {}
  };

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  if (!transition) return <div className="text-center py-8 text-gray-400">Transition not found</div>;

  const isFinalized = transition.status === 'COMPLETED' || transition.status === 'CANCELLED';
  const isDraft = transition.status === 'DRAFT';
  const isUnderVerification = transition.status === 'UNDER_VERIFICATION';

  const itemCols = [
    { key: 'id', label: '#', render: (_v, _r, i) => i + 1 },
    { key: 'asset_number', label: 'Asset No.', render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'asset_name', label: 'Asset Name' },
    { key: 'asset_head_name', label: 'Asset Head' },
    { key: 'asset_classification', label: 'Category' },
    { key: 'funding_head_name', label: 'Funding Head' },
    { key: 'stock_volume_no', label: 'Vol/Pg', render: (v, row) => `${v || '—'}/${row.stock_page_no || '—'}` },
    { key: 'quantity_system', label: 'Sys Qty' },
    { key: 'quantity_verified', label: 'Ver Qty', render: v => v != null ? v : '—' },
    { key: 'condition_status', label: 'Condition', render: v => v ? <StatusBadge status={v} /> : '—' },
    { key: 'remarks', label: 'Remarks', render: v => <span className="text-xs text-gray-500">{v || '—'}</span> },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="no-print space-y-5">
      <button onClick={() => navigate('/transitions')} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to Transfers
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Stock Charge Transfer #{id}</h2>
          {transition.official_order_number && (
            <span className="inline-flex mt-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              Order: {transition.official_order_number}
            </span>
          )}
        </div>
        {(() => { const m = STATUS_META[transition.status] || STATUS_META.DRAFT; return (
          <span className={`self-start sm:self-center text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${m.color}`}>{m.label}</span>
        ); })()}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{ label: 'Department', val: transition.operational_department_name, icon: '🏷️' },
          { label: 'Handed Over By', val: transition.handed_over_by_name, icon: '👤' },
          { label: 'Taken Over By', val: transition.taken_over_by_name, icon: '👤', accent: true },
          { label: 'Transfer Date', val: fmtDate(transition.transition_date), icon: '📅' }]
          .map(c => (
          <div key={c.label} className={`bg-white rounded-xl shadow-sm border p-4 ${c.accent ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-200'}`}>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{c.label}</div>
            <div className={`text-sm font-semibold ${c.accent ? 'text-indigo-800' : 'text-gray-900'}`}>{c.val || '—'}</div>
          </div>
        ))}
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-gray-100">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Transfer Details</h3>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[['Reason', REASON_LABELS[transition.handover_reason] || '—'],
            ['Effective From', fmtDate(transition.effective_from_date)],
            ['Verified By', transition.verified_by_name || '—'],
            ['Principal', transition.principal_name || '—'],
            ['Snapshot Generated', fmtDateTime(transition.snapshot_generated_at)],
            ['Total Items', transition.total_items],
            ['Verified Items', transition.verified_items],
            ['Discrepancies', transition.discrepancy_count],
            ...(transition.completed_at ? [['Completed At', fmtDateTime(transition.completed_at)]] : []),
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{k}</div>
              <div className={`font-semibold ${k === 'Discrepancies' && v > 0 ? 'text-red-600' : 'text-gray-800'}`}>{v ?? '—'}</div>
            </div>
          ))}
        </div>
        {transition.administrative_remarks && (
          <div className="px-6 pb-5 pt-0 border-t border-gray-100 mt-0">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Administrative Remarks</div>
            <p className="text-sm text-gray-700">{transition.administrative_remarks}</p>
          </div>
        )}
      </div>

      {/* Cancellation Info */}
      {transition.status === 'CANCELLED' && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-5">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <div className="font-semibold text-red-700 mb-1">Transfer Cancelled</div>
            <div className="text-sm text-red-600">{transition.cancellation_reason}</div>
            <div className="text-xs text-red-400 mt-1">{fmtDateTime(transition.cancelled_at)}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <button onClick={handleSubmitVerification} disabled={submittingVerif || items.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none">
            {submittingVerif ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</> : <>📋 Submit for Verification</>}
          </button>
        )}
        {isUnderVerification && (
          <Link to={`/transitions/${id}/verify`}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all">
            📝 Continue Verification
          </Link>
        )}
        {transition.status === 'COMPLETED' && (<>
          <button onClick={() => handlePrintReport('office-order')}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
            📄 Office Order
          </button>
          <button onClick={() => handlePrintReport('verification')}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
            📋 Verification Report
          </button>
        </>)}
        {!isFinalized && (
          <button onClick={() => setShowCancelModal(true)}
            className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
            ✕ Cancel Transfer
          </button>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Stock Snapshot</h3>
          <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full">{items.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-slate-50 border-b border-gray-200">
              {['#','Asset No.','Asset Name','Asset Head','Category','Funding Head','Vol/Pg','Sys Qty','Ver Qty','Condition','Remarks']
                .map(h => <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-10 text-gray-400 text-sm">No items in snapshot.</td></tr>
              ) : items.map((item, i) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.asset_number || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.asset_name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.asset_head_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{item.asset_classification || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{item.funding_head_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.stock_volume_no || '—'}/{item.stock_page_no || '—'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{item.quantity_system}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{item.quantity_verified ?? '—'}</td>
                  <td className="px-4 py-3">{item.condition_status ? (
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      item.condition_status === 'GOOD' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      item.condition_status === 'DAMAGED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'}`}>{item.condition_status}</span>
                  ) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Cancel Transfer</h3>
                <p className="text-xs text-gray-500 mt-0.5">This cannot be undone. Record will remain for audit.</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cancellation Reason <span className="text-red-500">*</span></label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              placeholder="Provide a reason for cancellation…" required />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Go Back</button>
              <button onClick={handleCancel} disabled={cancelling}
                className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Report Modal */}
      {showReport && reportData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:static print:block print:p-0 print:bg-transparent">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:rounded-none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 no-print sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-bold text-gray-900">{showReport === 'office-order' ? 'Office Order' : 'Verification Report'}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all">
                  🖨️ Print
                </button>
                <button onClick={() => { setShowReport(null); setReportData(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg">✕</button>
              </div>
            </div>
            <div ref={printRef} className="p-10 print-area">
              {showReport === 'office-order'
                ? <OfficeOrderPrint data={reportData.officeOrder || reportData.report} />
                : <VerificationReportPrint data={reportData.report} items={reportData.items} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== OFFICE ORDER PRINT COMPONENT ========== */
function OfficeOrderPrint({ data }) {
  if (!data) return null;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '____________';
  const reasonText = {
    TRANSFER: 'transfer', RETIREMENT: 'retirement', ADDITIONAL_CHARGE: 'additional charge assignment',
    INTERNAL_REALLOCATION: 'internal reallocation', LONG_LEAVE: 'long leave',
  };
  const signers = [
    { name: data.handed_over_by_name, role: 'Handed Over By' },
    { name: data.taken_over_by_name,  role: 'Taken Over By' },
    { name: data.verified_by_name || '________________', role: 'Verified By' },
    { name: data.principal_name || '________________',  role: 'Principal (with Seal)' },
  ];
  return (
    <div className="font-serif text-[13px] leading-relaxed text-black max-w-[800px] mx-auto p-4 bg-white">
      {/* Folio Header */}
      <div className="border-b-2 border-black pb-3 mb-5 text-center relative">
        <div className="absolute right-0 top-0">
          <span className="register-badge-box">OFFICE ORDER</span>
          <span className="text-[9px] font-mono text-slate-700 block mt-0.5">KVS ADMN CODE</span>
        </div>
        {data.kv_name_hi && (
          <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-tight">
            {data.kv_name_hi}
          </h1>
        )}
        <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5">
          {data.kv_name_en || 'KENDRIYA VIDYALAYA'}
        </h2>
        <div className="text-[10px] font-semibold text-slate-800 tracking-wider uppercase mt-0.5">
          केन्द्रीय विद्यालय संगठन / KENDRIYA VIDYALAYA SANGATHAN
        </div>
        {data.regional_office_en && (
          <div className="text-[10px] text-slate-600 mt-0.5">{data.regional_office_en}</div>
        )}
      </div>

      {/* Title */}
      <div className="text-center mb-5">
        <p className="text-sm font-bold underline tracking-widest uppercase">
          कार्यालय आदेश / OFFICE ORDER
        </p>
      </div>

      {/* Ref & Date */}
      <div className="flex justify-between items-center mb-4 text-xs font-semibold">
        <span><strong>Order No.:</strong> <span className="font-mono">{data.official_order_number || '___________'}</span></span>
        <span><strong>Date:</strong> {fmtDate(data.transition_date)}</span>
      </div>

      {/* Subject */}
      <p className="mb-4 text-xs leading-normal">
        <strong>Sub:</strong> <u>Handing Over and Taking Over of Charge — Operational Department: <strong>{data.operational_department_name}</strong></u>
      </p>

      {/* Body */}
      <div className="space-y-3 text-justify text-xs leading-relaxed">
        <p className="indent-8">
          Consequent upon the {reasonText[data.handover_reason] || 'change of charge'} of <strong>{data.handed_over_by_name}</strong>, the charge of the Operational Department "<strong>{data.operational_department_name}</strong>" is hereby transferred.
        </p>
        <p className="indent-8">
          Mr./Ms. <strong>{data.taken_over_by_name}</strong> will take over the charge of the said Operational Department with effect from <strong>{fmtDate(data.effective_from_date)}</strong>.
        </p>
        <p className="indent-8">
          A physical verification of the stock associated with the Operational Department has been conducted and the verification report is annexed herewith.
        </p>
        {data.discrepancy_count > 0 && (
          <p className="indent-8 italic text-amber-900 bg-amber-50 p-2 border border-amber-200 rounded">
            <strong>Note:</strong> {data.discrepancy_count} discrepancy/discrepancies were noted during verification and have been documented in the annexure.
          </p>
        )}
        {data.administrative_remarks && (
          <p><strong>Administrative Remarks:</strong> {data.administrative_remarks}</p>
        )}
      </div>

      {/* Signatures */}
      <div className="mt-12 grid grid-cols-2 gap-x-12 gap-y-8 break-inside-avoid">
        {signers.map(s => (
          <div key={s.role} className="text-center">
            <div className="border border-black p-3 rounded bg-white">
              <div className="h-10"></div>
              <div className="border-t border-dotted border-black pt-1">
                <p className="font-bold text-xs">{s.name}</p>
                <p className="text-[10px] text-slate-600">({s.role})</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== VERIFICATION REPORT PRINT COMPONENT ========== */
function VerificationReportPrint({ data, items }) {
  if (!data) return null;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const missing = items?.filter(i => i.condition_status === 'MISSING').length || 0;
  const damaged = items?.filter(i => i.condition_status === 'DAMAGED').length || 0;
  const COLS = ['S.No','Vol/Pg','Asset No.','Asset Name','Category','Sys Qty','Ver Qty','Condition','Remarks'];

  return (
    <div className="font-serif text-[12px] leading-relaxed text-black max-w-[850px] mx-auto p-4 bg-white">
      {/* Folio Header */}
      <div className="border-b-2 border-black pb-3 mb-4 text-center relative">
        <div className="absolute right-0 top-0">
          <span className="register-badge-box">TRANSFER REPORT</span>
          <span className="text-[9px] font-mono text-slate-700 block mt-0.5">FORM CS-48</span>
        </div>
        {data.kv_name_hi && (
          <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-tight">
            {data.kv_name_hi}
          </h1>
        )}
        <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5">
          {data.kv_name_en || 'KENDRIYA VIDYALAYA'}
        </h2>
        <div className="text-[10px] font-semibold text-slate-800 tracking-wider uppercase mt-0.5">
          केन्द्रीय विद्यालय संगठन / KENDRIYA VIDYALAYA SANGATHAN
        </div>
        <p className="text-xs font-bold underline tracking-wider uppercase mt-1">
          STOCK VERIFICATION &amp; CHARGE TRANSFER REPORT
        </p>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 text-xs border border-black p-2.5 rounded bg-slate-50/50">
        <p><strong>Operational Dept.:</strong> {data.operational_department_name}</p>
        <p><strong>Date of Verification:</strong> {fmtDate(data.verification_date)}</p>
        <p><strong>Handed Over By:</strong> {data.handed_over_by_name}</p>
        <p><strong>Taken Over By:</strong> {data.taken_over_by_name}</p>
      </div>

      {/* Summary Box */}
      <div className="flex gap-4 mb-3 text-xs font-bold px-3 py-1.5 bg-slate-100 border border-black rounded">
        <span>Total Articles: {data.total_items}</span>
        <span className="text-emerald-800">Verified: {data.verified_items}</span>
        <span className={missing > 0 ? 'text-rose-700 font-bold' : 'text-slate-600'}>Missing: {missing}</span>
        <span className={damaged > 0 ? 'text-amber-800 font-bold' : 'text-slate-600'}>Damaged: {damaged}</span>
      </div>

      {/* Table with crisp black borders */}
      <table className="register-view-table mb-4">
        <thead>
          <tr>
            {COLS.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
          <tr className="col-numbers">
            {COLS.map((_, i) => (
              <th key={i}>{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items?.map((item, idx) => (
            <tr key={item.id} className={item.condition_status === 'DAMAGED' || item.condition_status === 'MISSING' ? 'wo-row' : ''}>
              <td className="text-center font-mono text-[7.5pt]">{idx + 1}</td>
              <td className="text-center font-mono text-[7.5pt]">{item.stock_volume_no || '—'}/{item.stock_page_no || '—'}</td>
              <td className="text-center font-mono text-[7.5pt]">{item.asset_number || '—'}</td>
              <td className="font-medium text-left">{item.asset_name}</td>
              <td className="text-left text-[7.5pt]">{item.asset_classification || '—'}</td>
              <td className="text-center font-semibold">{item.quantity_system}</td>
              <td className="text-center font-semibold">{item.quantity_verified ?? '—'}</td>
              <td className={`text-center font-bold ${item.condition_status === 'GOOD' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {item.condition_status || '—'}
              </td>
              <td className="text-left text-[7.5pt]">{item.remarks || '—'}</td>
            </tr>
          ))}
          {/* Buffer rows */}
          {Array.from({ length: Math.max(0, 6 - (items?.length || 0)) }).map((_, i) => (
            <tr key={`buf-${i}`} className="empty-ledger-row h-6">
              {COLS.map((_, ci) => <td key={ci}></td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures */}
      <div className="register-signature-block break-inside-avoid">
        {[
          { name: data.handed_over_by_name, role: 'Handed Over By (Relieved In-Charge)' },
          { name: data.taken_over_by_name,  role: 'Taken Over By (New In-Charge)' },
          { name: data.verified_by_name || '________________', role: 'Verified By (Stock Checker)' }
        ].map(s => (
          <div key={s.role} className="register-sig-item">
            <div className="h-10"></div>
            <div className="register-sig-line"></div>
            <div className="font-bold text-xs">{s.name}</div>
            <div className="text-[10px] text-slate-600">{s.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

