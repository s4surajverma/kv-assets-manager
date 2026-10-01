import { useState, useEffect } from 'react';
import { getAuditLogs } from '../../api/audit';

// Maps technical table names to plain English module labels
const TABLE_LABELS = {
  asset:                    'Asset Register',
  asset_category:           'Asset Category',
  stock_ledger:             'Stock Ledger',
  stock_entry:              'Stock Entry',
  depreciation_ledger:      'Depreciation Ledger',
  condemnation_master:      'Condemnation (CS-49)',
  condemnation_item:        'Condemnation Item',
  stock_transition_master:  'Stock Charge Transfer',
  stock_transition_item:    'Transfer Item',
  vidyalaya:                'School (Vidyalaya)',
  verification_master:      'Verification',
  verification_item:        'Verification Item',
  sanction:                 'Sanction',
  disposal:                 'Disposal',
  users:                    'User Account',
  department:               'Department',
  funding_head:             'Funding Head',
  operational_department:   'Operational Department',
  depreciation_rule:        'Depreciation Rule',
};

const ACTION_META = {
  INSERT: { label: 'New Record Created',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', icon: '✚' },
  UPDATE: { label: 'Record Updated',       color: 'bg-blue-100 text-blue-800 border-blue-200',          dot: 'bg-blue-500',    icon: '✎' },
  DELETE: { label: 'Record Deleted',       color: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500',     icon: '✕' },
};

function describeAction(log) {
  const module = TABLE_LABELS[log.table_name] || log.table_name?.replace(/_/g, ' ');
  const who = log.changed_by_name || 'System';
  const action = log.action;
  if (action === 'INSERT') return `${who} added a new entry in ${module}`;
  if (action === 'UPDATE') return `${who} updated an entry in ${module}`;
  if (action === 'DELETE') return `${who} deleted an entry from ${module}`;
  return `${who} performed ${action} on ${module}`;
}

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const MODULE_OPTIONS = Object.entries(TABLE_LABELS).map(([k, v]) => ({ value: k, label: v }));

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ table: '', from: '', to: '' });
  const [pagination, setPagination] = useState({ page: 1, total: 0 });

  useEffect(() => { fetchData(); }, [pagination.page]);

  const fetchData = () => {
    setLoading(true);
    const params = { ...filters, page: pagination.page, limit: 50 };
    Object.keys(params).forEach(k => !params[k] && delete params[k]);
    getAuditLogs(params)
      .then(r => { setLogs(r.data); setPagination(p => ({ ...p, total: r.pagination?.total || 0 })); })
      .finally(() => setLoading(false));
  };

  const handleFilter = () => {
    if (pagination.page !== 1) setPagination({ ...pagination, page: 1 });
    else fetchData();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Activity Log</h2>
          <p className="text-sm text-gray-500 mt-1">A complete history of all actions performed in the system.</p>
        </div>
        {pagination.total > 0 && (
          <div className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
            {pagination.total} total activities
          </div>
        )}
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 transition-shadow hover:shadow-md">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Module / Area</label>
            <select
              value={filters.table}
              onChange={e => setFilters({ ...filters, table: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all"
            >
              <option value="">All Modules</option>
              {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">From Date</label>
            <input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To Date</label>
            <input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all" />
          </div>
          <button onClick={handleFilter}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Apply Filter
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
            <p className="text-sm text-gray-500">Loading activity history…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center px-4">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-base text-gray-600 font-medium">No activity found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log, idx) => {
              const meta = ACTION_META[log.action] || ACTION_META['UPDATE'];
              const module = TABLE_LABELS[log.table_name] || log.table_name?.replace(/_/g, ' ');
              return (
                <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  {/* Action dot */}
                  <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot} ring-4 ring-white shadow-sm`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {module}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{describeAction(log)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(log.changed_at)}</p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-gray-700">{log.changed_by_name || 'System'}</div>
                    {log.changed_by_empcode && (
                      <div className="text-xs text-gray-400 font-mono">{log.changed_by_empcode}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.total > 50 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Showing page <span className="text-slate-900">{pagination.page}</span> of{' '}
              <span className="text-slate-900">{Math.ceil(pagination.total / 50)}</span>
            </span>
            <div className="flex items-center gap-3">
              <button disabled={pagination.page <= 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors">
                ← Previous
              </button>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page * 50 >= pagination.total}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

