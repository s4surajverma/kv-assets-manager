import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getVerifications } from '../../api/verification';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import RoleGate from '../../components/RoleGate';
import { formatDate, current } from '../../utils/helpers';
import { Calendar, PlusCircle } from 'lucide-react';
import { getFinancialYears } from '../../api/masters';

export default function VerificationList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFy, setSelectedFy] = useState(current());
  const [availableFys, setAvailableFys] = useState([]);

  useEffect(() => {
    getFinancialYears({ include_all: true })
      .then((r) => {
        const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : (r?.data?.data || []));
        setAvailableFys(list);
      })
      .catch((err) => console.error('Failed to load FYs in VerificationList:', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = selectedFy ? { fy: selectedFy } : {};
    getVerifications(params)
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedFy]);

  const cols = [
    { key: 'id', label: '#' },
    { key: 'financial_year', label: 'FY' },
    { key: 'dept_code', label: 'Department' },
    { key: 'verification_date', label: 'Date', render: (v) => formatDate(v) },
    { key: 'verified_by_name', label: 'Verified By' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'id',
      label: 'Actions',
      render: (_v, row) => (
        <div className="flex items-center gap-3">
          <Link
            to={`/verification/${row.id}`}
            className="text-blue-600 text-xs font-semibold hover:underline"
          >
            Execute →
          </Link>
          {row.status === 'COMPLETED' && (
            <>
              <Link
                to={`/verification/${row.id}/report?type=proforma`}
                className="text-slate-600 text-xs hover:underline"
              >
                Proforma →
              </Link>
              <Link
                to={`/verification/${row.id}/report?type=certificate`}
                className="text-emerald-600 text-xs hover:underline"
              >
                Certificate →
              </Link>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Physical Verification
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Annual board verification certificates, reconciliation, and audit records
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Financial Year Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedFy}
              onChange={(e) => setSelectedFy(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">All Financial Years</option>
              {availableFys.map((fy) => {
                const code = typeof fy === 'string' ? fy : fy.code;
                const isCurrent = typeof fy === 'object' && fy.is_current;
                const isClosed = typeof fy === 'object' && fy.is_closed;
                return (
                  <option key={code} value={code}>
                    FY {code} {isCurrent ? '(Current)' : ''} {isClosed ? '[Closed]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <RoleGate roles={['Admin']}>
            <Link
              to="/verification/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Verification</span>
            </Link>
          </RoleGate>
        </div>
      </div>

      <DataTable
        columns={cols}
        data={data}
        loading={loading}
        emptyMessage={
          selectedFy
            ? `No physical verifications recorded for FY ${selectedFy}. Click "+ New Verification" to initiate one.`
            : 'No physical verifications found. Click "+ New Verification" to initiate one.'
        }
      />
    </div>
  );
}
