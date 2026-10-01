import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConsumables } from '../../api/consumables';
import DataTable from '../../components/DataTable';
import RoleGate from '../../components/RoleGate';
import { formatDate } from '../../utils/helpers';

export default function ConsumableList() {
  const [data, setData] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    getConsumables({}).then(r=>setData(r.data?.data || r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const cols = [
    { key: 'id', label: '#' }, { key: 'item_description', label: 'Item' },
    { key: 'issued_to_name', label: 'Issued To' }, { key: 'issue_date', label: 'Issue Date', render: v => formatDate(v) },
    { key: 'quantity', label: 'Qty Issued' }, { key: 'returned_qty', label: 'Returned' },
    { key: 'purpose', label: 'Purpose', render: v => v?.slice(0,30) },
    { key: 'attested_by', label: 'Attested', render: v => v ? '✓' : '✗' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Consumables (CS-24A)</h2>
        <RoleGate roles={['StockHolder']}>
          <div className="flex gap-2">
            <Link to="/consumables/issue" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm">+ Issue</Link>
            <Link to="/consumables/return" className="border border-gray-300 px-4 py-1.5 rounded text-sm">Return</Link>
          </div>
        </RoleGate>
      </div>
      <DataTable columns={cols} data={data} loading={loading} />
    </div>
  );
}
