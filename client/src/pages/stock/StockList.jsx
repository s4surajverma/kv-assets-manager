import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getEntries, classifyEntry as apiClassifyEntry } from '../../api/stock';
import { getFundingHeads, getDepartments, getAssetHeads } from '../../api/masters';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import RoleGate from '../../components/RoleGate';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function StockList() {
  const { user, hasRole } = useAuth();
  const isStockHolder = hasRole('StockHolder') && !hasRole('Admin');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const defaultTab = new URLSearchParams(location.search).get('tab') || 'CS24';
  const [filters, setFilters] = useState({
    fy: '', operational_dept_id: isStockHolder && user?.department_id ? String(user.department_id) : '',
    asset_head_id: '', fund_id: '', type: '', ledger_type: defaultTab, classification_status: ''
  });
  const [funds, setFunds] = useState([]);
  const [depts, setDepts] = useState([]);
  const [assetHeads, setAssetHeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });

  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [classifyEntry, setClassifyEntry] = useState(null);
  const [classifyForm, setClassifyForm] = useState({ funding_head_id: '', asset_head_id: '' });
  const [classifying, setClassifying] = useState(false);

  useEffect(() => {
    getFundingHeads().then((r) => setFunds(r.data));
    getDepartments().then((r) => setDepts(r.data));
    getAssetHeads().then((r) => setAssetHeads(r.data));
  }, []);

  useEffect(() => { fetchData(); }, [filters, pagination.page]);

  const fetchData = () => {
    setLoading(true);
    const params = { ...filters, page: pagination.page, limit: 50 };
    Object.keys(params).forEach((k) => !params[k] && delete params[k]);
    getEntries(params)
      .then((res) => { setEntries(res.data); setPagination((p) => ({ ...p, total: res.pagination?.total || 0 })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleClassifySubmit = async (e) => {
    e.preventDefault();
    if (!classifyForm.funding_head_id) return toast.error('Funding Head required');
    if (classifyEntry.ledger_type === 'CS24' && !classifyForm.asset_head_id) return toast.error('Asset Head required');

    setClassifying(true);
    try {
      const payload = { funding_head_id: parseInt(classifyForm.funding_head_id) };
      if (classifyEntry.ledger_type === 'CS24') payload.asset_head_id = parseInt(classifyForm.asset_head_id);
      
      await apiClassifyEntry(classifyEntry.id, payload);
      toast.success('Entry classified successfully');
      setShowClassifyModal(false);
      fetchData();
    } catch (err) {}
    finally { setClassifying(false); }
  };

  const columns = [
    { key: 'id', label: '#', width: '50px' },
    { key: 'entry_date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'ledger_type', label: 'Ledger', render: (v) => <span className="text-xs font-mono">{v}</span> },
    { key: 'classification_status', label: 'Status', render: (v) => <span className={`px-2 py-1 text-[10px] rounded uppercase ${v === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{v}</span> },
    { key: 'entry_type', label: 'Type', render: (v) => <StatusBadge status={v} /> },
    { key: 'item_description', label: 'Item Description' },
    { key: 'asset_head_code', label: 'Asset Head' },
    { key: 'operational_dept_name', label: 'Dept' },
    { key: 'fund_code', label: 'Fund' },
    { key: 'voucher_no', label: 'Voucher No.' },
    { key: 'quantity', label: 'Qty', render: (v) => v },
    { key: 'rate', label: 'Rate', render: (v) => v ? `₹${v}` : '—' },
    { key: 'amount', label: 'Amount', render: (v) => formatCurrency(v) },
    { key: 'balance_after', label: 'Balance', render: (v) => <span className="font-semibold">{v}</span> },
    hasRole('Admin') ? {
      key: 'actions', label: 'Action', render: (_, row) => row.classification_status === 'PENDING' && (
        <button onClick={() => { setClassifyEntry(row); setClassifyForm({ funding_head_id: '', asset_head_id: '' }); setShowClassifyModal(true); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Classify</button>
      )
    } : null,
  ].filter(col => col && !(filters.ledger_type === 'CS24A' && col.key === 'asset_head_code'));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Stock Register</h2>
          <p className="text-sm text-gray-500 mt-1">Manage and track inventory for {filters.ledger_type === 'CS24' ? 'Capital Assets (CS24)' : 'Consumables (CS24A)'}.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented Control */}
          <div className="flex bg-slate-100 p-1 rounded-lg shadow-inner border border-slate-200/60">
            <button onClick={() => setFilters({...filters, ledger_type: 'CS24'})}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${filters.ledger_type === 'CS24' ? 'bg-white shadow-sm text-indigo-700 ring-1 ring-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}>
              CS24 (Non-Consumables)
            </button>
            <button onClick={() => setFilters({...filters, ledger_type: 'CS24A'})}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${filters.ledger_type === 'CS24A' ? 'bg-white shadow-sm text-indigo-700 ring-1 ring-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}>
              CS24A (Consumables)
            </button>
          </div>
        </div>
      </div>

      {/* ── ACTION BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Link to="/stock/register" className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-95">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            Register View
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {filters.ledger_type === 'CS24A' && (
             <RoleGate roles={['StockHolder']}>
               <Link to="/stock/issue" className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-indigo-50 transition-all active:scale-95">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                 Issue Items
               </Link>
               <Link to="/stock/return" className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-emerald-50 transition-all active:scale-95">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"></path></svg>
                 Return Items
               </Link>
             </RoleGate>
          )}
          {filters.ledger_type === 'CS24' && (
             <RoleGate roles={['StockHolder']}>
               <Link to="/stock/custody/issue" className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-indigo-50 transition-all active:scale-95">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                 Issue Items
               </Link>
               <Link to="/stock/custody/return" className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-emerald-50 transition-all active:scale-95">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"></path></svg>
                 Return Items
               </Link>
               <Link to="/stock/custody" title="View Custody Records" className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 w-9 h-9 rounded-lg shadow-sm hover:bg-gray-50 transition-all active:scale-95">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
               </Link>
             </RoleGate>
          )}
          <RoleGate roles={['StockHolder']}>
            <Link to={`/stock/new?tab=${filters.ledger_type}`} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              New Entry
            </Link>
          </RoleGate>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 transition-shadow hover:shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <input type="text" value={filters.fy} onChange={(e) => setFilters({ ...filters, fy: e.target.value })}
              placeholder="FY (e.g. 2025-26)" className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-36 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all" />
          </div>
          
          {isStockHolder ? (
            <div className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-gray-50 text-gray-700 font-medium shadow-sm">
              <span className="text-gray-400 mr-2">Dept:</span>
              {depts.find(d => String(d.id) === String(user?.department_id))?.name || 'Your Dept'}
            </div>
          ) : (
            <select value={filters.operational_dept_id} onChange={(e) => setFilters({ ...filters, operational_dept_id: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all min-w-[160px]">
              <option value="">All Departments</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          <select value={filters.classification_status} onChange={(e) => setFilters({ ...filters, classification_status: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
            <option value="">All Statuses</option>
            <option value="PENDING">Pending Classification</option>
            <option value="CLASSIFIED">Classified</option>
          </select>

          {filters.ledger_type === 'CS24' && (
            <select value={filters.asset_head_id} onChange={(e) => setFilters({ ...filters, asset_head_id: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
              <option value="">All Asset Heads</option>
              {assetHeads.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}
            </select>
          )}

          <select value={filters.fund_id} onChange={(e) => setFilters({ ...filters, fund_id: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
            <option value="">All Funds</option>
            {funds.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
          </select>
          
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
            <option value="">All Types</option>
            {['RECEIPT','ISSUE','RETURN','WRITE_OFF','ADJUSTMENT','OPENING'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ── TABLE CONTAINER ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <DataTable columns={columns} data={entries} loading={loading} emptyMessage={`No stock entries found for ${filters.ledger_type}.`} />
        
        {/* Pagination Footer */}
        {pagination.total > 50 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Entries: <span className="text-slate-900">{pagination.total}</span></span>
            <div className="flex items-center gap-3">
              <button disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors">
                Previous
              </button>
              <span className="text-sm font-medium text-slate-600">Page {pagination.page}</span>
              <button onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} disabled={pagination.page * 50 >= pagination.total}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CLASSIFY MODAL ── */}
      {showClassifyModal && classifyEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Classify Stock Entry</h3>
              <button onClick={() => setShowClassifyModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6 bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Item Description</span>
                  <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">{classifyEntry.ledger_type} - {classifyEntry.entry_type}</span>
                </div>
                <p className="font-medium text-slate-900">{classifyEntry.item_description}</p>
              </div>

              <form onSubmit={handleClassifySubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Funding Head <span className="text-red-500">*</span></label>
                  <select required value={classifyForm.funding_head_id} onChange={e => setClassifyForm({...classifyForm, funding_head_id: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
                    <option value="">— Select Funding Head —</option>
                    {funds.map(f => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
                  </select>
                </div>
                
                {classifyEntry.ledger_type === 'CS24' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Asset Head <span className="text-red-500">*</span></label>
                    <select required value={classifyForm.asset_head_id} onChange={e => setClassifyForm({...classifyForm, asset_head_id: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
                      <option value="">— Select Asset Head —</option>
                      {assetHeads.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                  </div>
                )}
                
                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setShowClassifyModal(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={classifying} className="relative overflow-hidden group px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100">
                    <span className="relative z-10 flex items-center gap-2">
                      {classifying ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...</>
                      ) : (
                        'Save Classification'
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
