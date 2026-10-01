import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getIssues } from '../../api/nonConsumable';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function NonConsumableIssueList() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchIssues();
  }, [filter]);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const params = filter !== 'ALL' ? { status: filter } : {};
      const { data } = await getIssues(params);
      setIssues(data || []);
    } catch (err) {
      toast.error('Failed to load custody records');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ISSUED':
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-md border border-amber-200">ISSUED</span>;
      case 'PARTIALLY_RETURNED':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md border border-blue-200">PARTIAL</span>;
      case 'RETURNED':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md border border-emerald-200">RETURNED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-md border border-red-200">CANCELLED</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <Link to="/stock" className="p-2 hover:bg-slate-100 rounded-full transition-colors group">
            <svg className="w-6 h-6 text-slate-500 group-hover:text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Issue/Return Items</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">Track non-consumable item movements & temporary issues</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/stock/custody/return"
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            Process Return
          </Link>
          <Link
            to="/stock/custody/issue"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Issue Assets
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100 w-max">
        {['ALL', 'ISSUED', 'PARTIALLY_RETURNED', 'RETURNED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === f 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Issue No</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Target (To)</th>
                <th className="px-6 py-4">Purpose</th>
                <th className="px-6 py-4 text-center">Items (Out)</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">Loading records...</td>
                </tr>
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">No custody records found.</td>
                </tr>
              ) : (
                issues.map(issue => {
                  const targetName = issue.issue_target_type === 'DEPARTMENT' ? issue.to_department_name : issue.to_user_name;
                  const qtyOut = issue.total_qty_issued - issue.total_qty_returned;
                  
                  return (
                    <tr key={issue.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-slate-700">{issue.issue_no}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatDate(issue.issue_date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${issue.issue_target_type === 'USER' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                            {issue.issue_target_type.substring(0, 4)}
                          </span>
                          <span className="font-bold text-slate-800">{targetName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 truncate max-w-[200px]" title={issue.purpose}>
                        {issue.purpose}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-mono font-bold ${qtyOut > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {qtyOut}
                        </span>
                        <span className="text-slate-400 text-[10px] ml-1">/ {issue.total_qty_issued}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(issue.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
