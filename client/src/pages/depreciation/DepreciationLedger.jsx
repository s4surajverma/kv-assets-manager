import { useState, useEffect } from 'react';
import { getLedger } from '../../api/depreciation';
import { getDepartments } from '../../api/masters';
import DataTable from '../../components/DataTable';
import DepreciationBreakdownModal from '../../components/DepreciationBreakdownModal';
import { formatCurrency, current } from '../../utils/helpers';

export default function DepreciationLedger() {
  const [data, setData] = useState([]); const [loading, setLoading] = useState(true);
  const [depts, setDepts] = useState([]);
  const [filters, setFilters] = useState({ fy: current(), dept_id: '' });
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  useEffect(() => { getDepartments().then(r=>setDepts(r.data)); }, []);
  useEffect(() => {
    setLoading(true);
    const p = { ...filters }; Object.keys(p).forEach(k => !p[k] && delete p[k]);
    getLedger(p).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, [filters]);

  const cols = [
    { key: 'asset_number', label: 'Asset No.', render: v => <span className="font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{v}</span> },
    { key: 'asset_name', label: 'Asset Name', render: v => <span className="font-semibold text-slate-800">{v}</span> },
    { key: 'financial_year', label: 'FY', render: v => <span className="font-medium text-slate-600">{v}</span> },
    { key: 'method', label: 'Method', render: v => <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{v}</span> },
    { key: 'rate_applied', label: 'Rate', render: v => <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold text-[10px]">{`${(v*100).toFixed(1)}%`}</span> },
    { key: 'opening_value', label: 'Opening', render: v => <span className="font-medium text-slate-600">{formatCurrency(v)}</span> },
    { key: 'depreciation_amount', label: 'Depr. Amount', render: v => <span className="font-bold text-red-600">-{formatCurrency(v)}</span> },
    { key: 'closing_value', label: 'Closing Value', render: v => <span className="font-bold text-emerald-700">{formatCurrency(v)}</span> },
    { key: 'accum_depreciation', label: 'Accum. Depr.', render: v => <span className="text-xs text-slate-500">{formatCurrency(v)}</span> },
    { key: 'is_fully_depreciated', label: 'Status', render: v => v ? <span className="text-[10px] uppercase tracking-wider font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">Written Off</span> : <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Active</span> },
    { 
      key: 'actions', label: '', render: (_, row) => (
        <button 
          onClick={() => setSelectedAssetId(row.asset_id)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded transition-colors border border-indigo-100"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Details
        </button>
      )
    },
  ];

  return (
    <div className="max-w-[100rem] mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md">
            <span className="text-xl">📚</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Depreciation Ledger</h2>
            <p className="text-sm text-gray-500 mt-0.5">Historical records of all executed asset depreciation events.</p>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100 text-sm font-semibold text-gray-500 mr-2">
          <span>🔍</span> Filter Records
        </div>
        <div className="w-full sm:w-48">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Financial Year</label>
          <input type="text" value={filters.fy} onChange={e=>setFilters({...filters,fy:e.target.value})} 
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50" 
            placeholder="e.g. 2025-26" />
        </div>
        <div className="w-full sm:w-64">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Department</label>
          <select value={filters.dept_id} onChange={e=>setFilters({...filters,dept_id:e.target.value})} 
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white">
            <option value="">— All Departments —</option>
            {depts.map(d=><option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <DataTable columns={cols} data={data} loading={loading} emptyMessage="No depreciation records found for the selected filters." />
      </div>

      {selectedAssetId && (
        <DepreciationBreakdownModal 
          assetId={selectedAssetId} 
          onClose={() => setSelectedAssetId(null)} 
        />
      )}
    </div>
  );
}
