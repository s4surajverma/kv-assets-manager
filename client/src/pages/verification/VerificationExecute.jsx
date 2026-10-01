import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getVerificationItems, updateItems, completeVerification } from '../../api/verification';

export default function VerificationExecute() {
  const { id } = useParams(); const nav = useNavigate();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(false);

  useEffect(() => {
    getVerificationItems(id)
      .then(r => setItems(r.data || []))
      .catch(() => toast.error('Failed to load verification items'))
      .finally(() => setLoading(false));
  }, [id]);

  const CONDITIONS = ['GOOD','FAIR','DAMAGED','UNSERVICEABLE','MISSING'];

  const updateField = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const save = async () => {
    setSub(true);
    try {
      const res = await updateItems(id, { items: items.map(i => ({ asset_id: i.asset_id, physical_qty: parseInt(i.physical_qty||0), condition: i.condition || 'GOOD', remarks: i.remarks })) });
      setItems(res.data || []);
      toast.success('Items saved');
    } catch {} finally { setSub(false); }
  };

  const complete = async () => {
    const cert = window.prompt('Enter verification certificate text:');
    if (!cert) return;
    try {
      await completeVerification(id, { certificate_text: cert });
      toast.success('Verification completed'); nav('/verification');
    } catch {}
  };

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-4">Execute Verification #{id}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No assets found for this department. Verify that assets are assigned to the correct operational department.</p>
      ) : (
        <div className="overflow-x-auto border rounded mb-4">
          <table className="w-full register-table">
            <thead><tr>
              <th>Asset No.</th><th>Name</th><th>Stock Qty</th><th>Physical Qty</th><th>Discrepancy</th><th>Condition</th><th>Remarks</th>
            </tr></thead>
            <tbody>
              {items.map((item, i) => {
                const disc = (parseInt(item.physical_qty) || 0) - (parseInt(item.stock_qty) || 0);
                return (
                <tr key={item.asset_id}>
                  <td>{item.asset_number}</td><td>{item.asset_name}</td>
                  <td className="text-center">{item.stock_qty}</td>
                  <td><input type="number" value={item.physical_qty||''} onChange={e=>updateField(i,'physical_qty',e.target.value)} className="border rounded px-1.5 py-0.5 text-sm w-16" /></td>
                  <td className={`text-center ${disc !== 0 ? 'text-red-600 font-semibold' : ''}`}>{disc}</td>
                  <td><select value={item.condition||'GOOD'} onChange={e=>updateField(i,'condition',e.target.value)} className="border rounded px-1 py-0.5 text-xs">
                    {CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select></td>
                  <td><input value={item.remarks||''} onChange={e=>updateField(i,'remarks',e.target.value)} className="border rounded px-1.5 py-0.5 text-sm w-32" /></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={save} disabled={sub || items.length === 0} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">Save Items</button>
        <button onClick={complete} disabled={items.length === 0} className="bg-green-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">Complete Verification</button>
        <button onClick={() => nav(`/verification/${id}/report`)} className="bg-gray-600 text-white px-4 py-1.5 rounded text-sm hover:bg-gray-700">View/Print Report</button>
      </div>
    </div>
  );
}
