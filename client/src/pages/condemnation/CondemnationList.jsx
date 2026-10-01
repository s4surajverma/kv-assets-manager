import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCondemnations } from '../../api/condemnation';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import RoleGate from '../../components/RoleGate';
import { formatCurrency } from '../../utils/helpers';

export default function CondemnationList() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState('');
  const [type, setType]       = useState('');

  useEffect(() => {
    setLoading(true);
    const p = {};
    if (status) p.status = status;
    if (type)   p.type   = type;
    getCondemnations(p).then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [status, type]);

  const cols = [
    { key: 'id',    label: '#' },
    { key: 'type',  label: 'Type', render: v => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v === 'master' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
        {v === 'master' ? 'New' : 'Legacy'}
      </span>
    )},
    { key: 'operational_department_name', label: 'Operational Dept.',
      render: (v, row) => v || row.asset_name || '—' },
    { key: 'asset_head_name', label: 'Asset Head' },
    { key: 'fund_code',       label: 'Fund' },
    { key: 'item_count',      label: 'Items', render: v => <span className="font-semibold">{v}</span> },
    { key: 'total_original_cost',     label: 'Original Cost', render: v => formatCurrency(v) },
    { key: 'total_condemnation_cost', label: 'Condemn. Value', render: v => formatCurrency(v) },
    { key: 'financial_year', label: 'F.Y.' },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'id', label: '', render: (_v, row) => (
      <Link to={`/condemnation/${row.type}-${row.id}`} className="text-blue-600 text-xs hover:underline">View →</Link>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Condemnation Register (CS-49)</h2>
        <RoleGate roles={['StockHolder']}>
          <Link to="/condemnation/new" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">+ New Condemnation</Link>
        </RoleGate>
      </div>

      <div className="flex gap-3 mb-4">
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">All Status</option>
          {['PENDING','BOARD_REVIEWED','SANCTIONED','REJECTED','DISPOSED'].map(s =>
            <option key={s} value={s}>{s}</option>
          )}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">All Types</option>
          <option value="new">New (Multi-Asset)</option>
          <option value="legacy">Legacy (Single-Asset)</option>
        </select>
      </div>

      <DataTable columns={cols} data={data} loading={loading} />
    </div>
  );
}
