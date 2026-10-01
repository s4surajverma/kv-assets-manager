import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTransitions } from '../../api/transitions';
import { getDepartments } from '../../api/masters';
import RoleGate from '../../components/RoleGate';

const REASON_LABELS = {
  TRANSFER: 'Transfer',
  RETIREMENT: 'Retirement',
  ADDITIONAL_CHARGE: 'Additional Charge',
  INTERNAL_REALLOCATION: 'Internal Reallocation',
  LONG_LEAVE: 'Long Leave',
};

const STATUS_META = {
  DRAFT:              { label: 'Draft',              color: 'bg-slate-100 text-slate-600 border-slate-200' },
  UNDER_VERIFICATION: { label: 'Under Verification', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  COMPLETED:          { label: 'Completed',           color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CANCELLED:          { label: 'Cancelled',           color: 'bg-red-100 text-red-600 border-red-200' },
};

const STATUS_OPTIONS = ['', 'DRAFT', 'UNDER_VERIFICATION', 'COMPLETED', 'CANCELLED'];

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function TransitionList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    getDepartments().then(r => setDepartments(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = {};
    if (statusFilter) p.status = statusFilter;
    if (deptFilter) p.operational_department_id = deptFilter;
    getTransitions(p)
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, deptFilter]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Stock Charge Transfers</h2>
          <p className="text-sm text-gray-500 mt-1">Manage handover of stock charge between department incharges.</p>
        </div>
        <RoleGate roles={['Admin']}>
          <Link to="/transitions/new"
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Initiate Transfer
          </Link>
        </RoleGate>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-wrap items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg shadow-inner border border-slate-200/60 flex-wrap gap-0.5">
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${statusFilter === s ? 'bg-white shadow-sm text-indigo-700 ring-1 ring-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}>
              {s === '' ? 'All Status' : STATUS_META[s]?.label || s}
            </button>
          ))}
        </div>

        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all min-w-[180px]">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
            <p className="text-sm text-gray-500">Loading transfers…</p>
          </div>
        ) : data.length === 0 ? (
          <div className="py-16 text-center px-4">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <p className="text-base text-gray-600 font-medium">No transfers found</p>
            <p className="text-sm text-gray-400 mt-1">Try changing your filters or initiate a new transfer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-10">#</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Handed Over By</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Taken Over By</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, idx) => {
                  const meta = STATUS_META[row.status] || STATUS_META['DRAFT'];
                  const isVerify = row.status === 'UNDER_VERIFICATION';
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-5 py-4 font-semibold text-gray-900">{row.operational_department_name || '—'}</td>
                      <td className="px-5 py-4 text-gray-700">{row.handed_over_by_name || '—'}</td>
                      <td className="px-5 py-4 text-indigo-700 font-medium">{row.taken_over_by_name || '—'}</td>
                      <td className="px-5 py-4 text-gray-600">{REASON_LABELS[row.handover_reason] || '—'}</td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{fmtDate(row.transition_date)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="font-bold text-gray-800">
                          {isVerify ? `${row.verified_items || 0}/${row.total_items || 0}` : (row.total_items || 0)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={isVerify ? `/transitions/${row.id}/verify` : `/transitions/${row.id}`}
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${isVerify ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'}`}>
                          {isVerify ? 'Verify' : 'View'}
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
