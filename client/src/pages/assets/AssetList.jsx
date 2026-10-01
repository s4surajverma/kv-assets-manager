import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAssets } from '../../api/assets';
import { getDepartments, getFundingHeads, getAssetHeads } from '../../api/masters';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function AssetList() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('Admin');
  const isStockHolder = hasRole('StockHolder') && !isAdmin;
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'ACTIVE',
    operational_dept_id: isStockHolder && user?.department_id ? String(user.department_id) : '',
    asset_head_id: '',
    fund_id: ''
  });
  const [depts, setDepts] = useState([]);
  const [assetHeads, setAssetHeads] = useState([]);
  const [funds, setFunds] = useState([]);

  useEffect(() => {
    getDepartments().then((r) => setDepts(r.data));
    getAssetHeads().then((r) => setAssetHeads(r.data));
    getFundingHeads().then((r) => setFunds(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = { ...filters }; Object.keys(p).forEach((k) => !p[k] && delete p[k]);
    getAssets(p).then((r) => setAssets(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [filters]);

  const columns = [
    { key: 'asset_number', label: 'Asset No.', render: (v, row) => (
        <div className="flex flex-col gap-1">
          <Link to={`/assets/${row.id}`} className="text-blue-600 hover:underline font-medium">{v}</Link>
          {row.total_issued_quantity > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold w-max">
              ISSUED ({row.total_issued_quantity}/{row.total_units})
            </span>
          )}
        </div>
      ) 
    },
    { key: 'name', label: 'Name' },
    { key: 'asset_head_code', label: 'Asset Head' },
    { key: 'operational_dept_name', label: 'Dept' },
    { key: 'fund_code', label: 'Fund' },
    { key: 'purchase_date', label: 'Purchase Date', render: (v) => formatDate(v) },
    { key: 'total_cost', label: 'Cost', render: (v) => formatCurrency(v) },
    { key: 'book_value', label: 'Book Value', render: (v) => formatCurrency(v) },
    { key: 'accum_depreciation', label: 'Accum. Depr.', render: (v) => formatCurrency(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'is_small_value', label: 'Small Value', render: (_, row) => (row.total_cost <= 2000 && !row.is_library) ? 'Yes' : '' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Asset Register (GFR-22)</h2>
        <Link to="/assets/register" className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50">Register View</Link>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-4 text-xs text-blue-700">
        ℹ️ Assets are automatically generated from stock entries where applicable. Use the Stock Register to add new items.
      </div>
      <div className="flex gap-3 mb-4">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
          <option value="">All Status</option>
          {['ACTIVE','CONDEMNED','DISPOSED','TRANSFERRED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {isStockHolder ? (
          <div className="border border-gray-300 rounded px-3 py-1 text-sm bg-gray-100">
            {depts.find(d => String(d.id) === String(user?.department_id))?.name || 'Your Dept'}
          </div>
        ) : (
          <select value={filters.operational_dept_id} onChange={(e) => setFilters({ ...filters, operational_dept_id: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
            <option value="">All Departments</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {isAdmin && (
          <>
            <select value={filters.asset_head_id} onChange={(e) => setFilters({ ...filters, asset_head_id: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="">All Asset Heads</option>
              {assetHeads.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}
            </select>
            <select value={filters.fund_id} onChange={(e) => setFilters({ ...filters, fund_id: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="">All Funds</option>
              {funds.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
            </select>
          </>
        )}
      </div>
      <DataTable columns={columns} data={assets} loading={loading} />
    </div>
  );
}
