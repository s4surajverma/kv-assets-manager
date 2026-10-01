import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSanctions, getLimits } from '../../api/sanctions';
import DataTable from '../../components/DataTable';
import RoleGate from '../../components/RoleGate';
import { formatCurrency, formatDate, current } from '../../utils/helpers';

export default function SanctionList() {
  const [data, setData] = useState([]); const [loading, setLoading] = useState(true);
  const [limits, setLimits] = useState(null);
  useEffect(() => {
    getSanctions({ fy: current() }).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
    getLimits({ authority: 'VMC', fy: current() }).then(r=>setLimits(r.data)).catch(()=>{});
  }, []);

  const cols = [
    { key: 'sanction_no', label: 'Sanction No.' }, { key: 'sanction_date', label: 'Date', render: v=>formatDate(v) },
    { key: 'asset_number', label: 'Asset' }, { key: 'sanctioning_authority', label: 'Authority' },
    { key: 'sanctioned_amount', label: 'Amount', render: v=>formatCurrency(v) },
    { key: 'sanctioned_by_name', label: 'Sanctioned By' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Sanctions</h2>
        <RoleGate roles={['Admin', 'Principal']}>
          <Link to="/sanctions/new" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm">+ New Sanction</Link>
        </RoleGate>
      </div>
      {limits && (
        <div className="bg-gray-50 border rounded p-3 mb-4 text-sm">
          <strong>VMC Limits ({current()}):</strong> Used {formatCurrency(limits.used)} / {formatCurrency(limits.limit)} — Remaining: {formatCurrency(limits.remaining)}
        </div>
      )}
      <DataTable columns={cols} data={data} loading={loading} />
    </div>
  );
}
