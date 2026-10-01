import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDisposals } from '../../api/disposal';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import RoleGate from '../../components/RoleGate';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function DisposalList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDisposals()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: 'id', label: '#' },
    {
      key: 'asset_info', label: 'Condemnation Ref',
      render: (_v, row) => {
        if (row.condemnation_master_id) {
          return (
            <div>
              <span className="font-mono text-xs text-blue-700">Master #{row.condemnation_master_id}</span>
              <div className="text-[10px] text-gray-500">{row.master_item_count || '—'} item(s) • {row.operational_department_name || '—'}</div>
            </div>
          );
        }
        return (
          <div>
            <span className="font-mono text-xs text-blue-700">{row.legacy_asset_number || `Legacy #${row.condemnation_id}`}</span>
            <div className="text-[10px] text-gray-500">{row.legacy_asset_name || '—'}</div>
          </div>
        );
      }
    },
    {
      key: 'disposal_mode', label: 'Mode',
      render: v => <span className="text-xs uppercase tracking-wider">{v?.replace(/_/g, ' ') || '—'}</span>
    },
    {
      key: 'disposal_date', label: 'Date',
      render: v => v ? formatDate(v) : '—'
    },
    {
      key: 'condemn_value', label: 'Condemn. Value',
      render: (_v, row) => formatCurrency(row.master_condemn_value || row.legacy_condemn_value || 0)
    },
    {
      key: 'sanction_no', label: 'Sanction',
      render: (v, row) => v ? (
        <span className="text-xs">{v} ({formatDate(row.sanction_date)})</span>
      ) : '—'
    },
    {
      key: 'status', label: 'Status',
      render: (_v, row) => {
        if (row.payment_received) return <StatusBadge status="DISPOSED" />;
        if (row.sale_amount) return <StatusBadge status="SALE_RECORDED" />;
        return <StatusBadge status="PENDING" />;
      }
    },
    {
      key: 'actions', label: '',
      render: (_v, row) => (
        <Link to={`/disposal/${row.id}`} className="text-blue-600 text-xs hover:underline">
          View Details →
        </Link>
      )
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Disposal Records</h2>
        <RoleGate roles={['Admin', 'Principal']}>
          <Link to="/disposal/new" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm">+ New Disposal</Link>
        </RoleGate>
      </div>
      <DataTable columns={cols} data={data} loading={loading} />
    </div>
  );
}
