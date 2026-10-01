import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { runDepreciation, previewDepreciation, getLedger } from '../../api/depreciation';
import DataTable from '../../components/DataTable';
import RoleGate from '../../components/RoleGate';
import { formatCurrency, current } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function DepreciationRun() {
  const [fy, setFy] = useState(current());
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alreadyRun, setAlreadyRun] = useState(false);

  // Check if depreciation already executed for this FY
  useEffect(() => {
    setAlreadyRun(false);
    if (!fy) return;
    getLedger({ fy }).then(r => {
      if (r.data && r.data.length > 0) setAlreadyRun(true);
    }).catch(() => {});
  }, [fy]);

  const doPreview = async () => {
    setLoading(true); setResult(null);
    try {
      const r = await previewDepreciation({ financial_year: fy });
      setPreview(r.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (msg.includes('not found')) toast.error(`Financial year "${fy}" not found. Please check the FY code.`);
      else if (msg.includes('already')) toast.error(`Depreciation has already been executed for ${fy}.`);
    } finally { setLoading(false); }
  };

  const doRun = async () => {
    if (!window.confirm(`Run depreciation for ${fy}? This action is irreversible and will update all asset book values.`)) return;
    setLoading(true);
    try {
      const r = await runDepreciation({ financial_year: fy });
      setResult(r.data); setPreview(null); setAlreadyRun(true);
      toast.success('Depreciation completed successfully');
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (msg.includes('not found')) toast.error(`Financial year "${fy}" does not exist in the system.`);
      else if (msg.includes('already')) toast.error(`Depreciation has already been executed for ${fy}. Cannot run again.`);
      else if (msg.includes('created_by')) toast.error('Database schema issue. Please contact the administrator.');
    } finally { setLoading(false); }
  };

  const cols = [
    { key: 'asset_number', label: 'Asset No.', render: v => <span className="font-mono text-[11px] text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">{v}</span> },
    { key: 'name', label: 'Asset Name', render: v => <span className="font-semibold text-gray-800">{v}</span> },
    { key: 'current_book_value', label: 'Current Value', render: v => <span className="font-medium text-gray-700">{formatCurrency(v)}</span> },
    { key: 'depreciation_amount', label: 'Depr. Amount', render: v => <span className="font-bold text-red-600">-{formatCurrency(v)}</span> },
    { key: 'new_book_value', label: 'New Value', render: v => <span className="font-bold text-emerald-700">{formatCurrency(v)}</span> },
    { key: 'is_fully_depreciated', label: 'Status', render: v => v ? <span className="text-[10px] uppercase tracking-wider font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">Fully Depr.</span> : <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Active</span> },
  ];

  return (
    <div className="max-w-[90rem] mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white flex items-center justify-center shadow-md">
            <span className="text-xl">📉</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Annual Depreciation</h2>
            <p className="text-sm text-gray-500 mt-0.5">Calculate and apply statutory depreciation to the asset registry.</p>
          </div>
        </div>
        <Link to="/depreciation/ledger" 
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md hover:border-purple-300 transition-all group">
          <span>View Ledger</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>

      {/* Explanation */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">ℹ️</span>
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">How Depreciation Works</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              Depreciation runs <strong>once per financial year</strong> and reduces the book value of all active assets based on their category-wise WDV/SLM rates (as per KVS Appendix-5). Assets falling below ₹2,000 are automatically fully written off. <span className="text-red-600 font-medium">This action is irreversible — once executed, it cannot be undone for the given financial year.</span>
            </p>
          </div>
        </div>
      </div>

      {alreadyRun && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p className="text-sm text-amber-800">
              Depreciation has <strong>already been executed</strong> for FY <strong>{fy}</strong>. You cannot run it again.
            </p>
          </div>
          <Link to="/depreciation/ledger" className="text-sm font-bold text-amber-700 hover:text-amber-900 underline">View ledger</Link>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="flex-1 max-w-xs">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Financial Year</label>
          <input type="text" value={fy} onChange={e => { setFy(e.target.value); setPreview(null); setResult(null); }}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow bg-gray-50" 
            placeholder="e.g. 2025-26" />
        </div>
        <div className="flex items-end gap-3 mt-5">
          <button onClick={doPreview} disabled={loading || alreadyRun}
            className="border border-purple-600 text-purple-700 bg-purple-50 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-100 disabled:opacity-50 disabled:hover:bg-purple-50 transition-colors shadow-sm">
            {loading && !result && !preview ? 'Loading...' : 'Preview Impact'}
          </button>
          
          <RoleGate roles={['Admin']}>
            <button onClick={doRun} disabled={loading || !preview || alreadyRun}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5 transition-all">
              {alreadyRun ? 'Already Executed' : 'Execute Depreciation'}
            </button>
          </RoleGate>
        </div>
      </div>

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">✅</span>
            <h3 className="text-lg font-bold text-emerald-900">Depreciation Run Successful</h3>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Assets Processed</div>
              <div className="text-2xl font-extrabold text-emerald-900">{result.processed}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Depreciation</div>
              <div className="text-2xl font-extrabold text-emerald-900">{formatCurrency(result.totalDepr)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Fully Written Off</div>
              <div className="text-2xl font-extrabold text-emerald-900">{result.fullyDepreciated}</div>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
          <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Depreciation Preview</h3>
            <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">{preview.length} eligible assets</span>
          </div>
          <DataTable columns={cols} data={preview} loading={loading} />
        </div>
      )}
    </div>
  );
}
