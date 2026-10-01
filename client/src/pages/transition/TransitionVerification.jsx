import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTransition, verifyItems, finalizeTransition } from '../../api/transitions';
import api from '../../api/axios';
import StatusBadge from '../../components/StatusBadge';

const CONDITION_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'GOOD', label: '✅ Good' },
  { value: 'DAMAGED', label: '⚠️ Damaged' },
  { value: 'OBSOLETE', label: '🔶 Obsolete' },
  { value: 'MISSING', label: '❌ Missing' },
];

export default function TransitionVerification() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [transition, setTransition] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [finalizeForm, setFinalizeForm] = useState({ verified_by_user_id: '', principal_id: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTransition(id);
      setTransition(res.data.transition);
      setItems(res.data.items.map(item => ({
        ...item,
        quantity_verified: item.quantity_verified ?? item.quantity_system,
        condition_status: item.condition_status || '',
        remarks: item.remarks || '',
      })));
    } catch (err) {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data || [])).catch(() => {});
  }, []);

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleBulkVerify = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      quantity_verified: item.quantity_verified ?? item.quantity_system,
      condition_status: item.condition_status || 'GOOD',
    })));
    toast.success('All items marked as verified (Good)');
  };

  const handleSave = async () => {
    const toSave = items.filter(item => item.condition_status);
    if (toSave.length === 0) return toast.error('No items to save');

    // Validate mandatory remarks
    for (const item of toSave) {
      if ((item.condition_status === 'DAMAGED' || item.condition_status === 'MISSING') && !item.remarks) {
        toast.error(`Remarks are mandatory for items marked as ${item.condition_status}. Check: ${item.asset_name}`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = toSave.map(item => ({
        id: item.id,
        quantity_verified: parseFloat(item.quantity_verified),
        condition_status: item.condition_status,
        discrepancy_type: item.quantity_verified != item.quantity_system ? 'QUANTITY_MISMATCH' :
          (item.condition_status === 'DAMAGED' || item.condition_status === 'MISSING') ? item.condition_status : null,
        remarks: item.remarks || null,
      }));
      await verifyItems(id, { items: payload });
      toast.success(`${toSave.length} item(s) saved`);
      fetchData(); // Refresh to get updated counts
    } catch (err) {}
    finally { setSaving(false); }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await finalizeTransition(id, {
        verified_by_user_id: finalizeForm.verified_by_user_id ? parseInt(finalizeForm.verified_by_user_id) : undefined,
        principal_id: finalizeForm.principal_id ? parseInt(finalizeForm.principal_id) : undefined,
      });
      toast.success('Stock charge transfer completed successfully!');
      navigate(`/transitions/${id}`);
    } catch (err) {}
    finally { setFinalizing(false); }
  };

  if (loading) return <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>;
  if (!transition) return <div className="text-center py-8 text-gray-400">Transition not found</div>;

  const verifiedCount = items.filter(i => i.quantity_verified != null && i.condition_status).length;
  const totalCount = items.length;
  const discrepancyCount = items.filter(i =>
    i.condition_status === 'DAMAGED' || i.condition_status === 'MISSING' || (i.quantity_verified != null && i.quantity_verified != i.quantity_system)
  ).length;
  const allVerified = verifiedCount === totalCount && totalCount > 0;
  const progressPct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to="/transitions" className="text-blue-600 text-xs hover:underline">← Back to list</Link>
          <h2 className="text-base font-semibold text-gray-800 mt-1">Verify Stock Charge Transfer #{id}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {transition.operational_department_name} — {transition.handed_over_by_name} → {transition.taken_over_by_name}
          </p>
        </div>
        <StatusBadge status={transition.status} />
      </div>

      {/* Progress Bar */}
      <div className="bg-white border border-gray-200 rounded p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Verification Progress</span>
          <span className="text-sm font-bold text-blue-700">{verifiedCount} / {totalCount} items ({progressPct}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${progressPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex gap-4 mt-2">
          <span className="text-xs text-green-600">✅ Verified: {verifiedCount}</span>
          <span className="text-xs text-red-600">⚠️ Discrepancies: {discrepancyCount}</span>
          <span className="text-xs text-gray-500">📦 Remaining: {totalCount - verifiedCount}</span>
        </div>
      </div>

      {/* Actions */}
      {transition.status === 'UNDER_VERIFICATION' && (
        <div className="flex gap-2 mb-4">
          <button onClick={handleBulkVerify} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs hover:bg-gray-200 border">
            ✅ Mark All Verified (Good)
          </button>
          <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : '💾 Save Verification Progress'}
          </button>
          {allVerified && (
            <button onClick={() => setShowFinalizeModal(true)} className="bg-green-600 text-white px-4 py-1.5 rounded text-xs hover:bg-green-700">
              🔒 Finalize Transfer
            </button>
          )}
        </div>
      )}

      {/* Items Table */}
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="w-full register-table text-xs">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Asset No.</th>
              <th>Asset Name</th>
              <th>Asset Head</th>
              <th className="w-16">Vol/Pg</th>
              <th className="w-16">Sys Qty</th>
              <th className="w-20">Ver. Qty</th>
              <th className="w-32">Condition</th>
              <th className="w-40">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const hasDiscrepancy = item.condition_status === 'DAMAGED' || item.condition_status === 'MISSING' ||
                (item.quantity_verified != null && parseFloat(item.quantity_verified) !== parseFloat(item.quantity_system));
              return (
                <tr key={item.id} className={hasDiscrepancy ? 'bg-red-50' : ''}>
                  <td className="text-center">{idx + 1}</td>
                  <td className="font-mono text-xs">{item.asset_number || '—'}</td>
                  <td>{item.asset_name}</td>
                  <td className="text-xs text-gray-500">{item.asset_head_name || '—'}</td>
                  <td className="text-center text-xs text-gray-500">
                    {item.stock_volume_no || '—'}/{item.stock_page_no || '—'}
                  </td>
                  <td className="text-center font-medium">{item.quantity_system}</td>
                  <td>
                    {transition.status === 'UNDER_VERIFICATION' ? (
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={item.quantity_verified ?? ''}
                        onChange={e => updateItem(idx, 'quantity_verified', e.target.value)}
                        className="w-full border rounded px-1.5 py-0.5 text-xs text-center"
                      />
                    ) : (
                      <span className="text-center block">{item.quantity_verified ?? '—'}</span>
                    )}
                  </td>
                  <td>
                    {transition.status === 'UNDER_VERIFICATION' ? (
                      <select
                        value={item.condition_status}
                        onChange={e => updateItem(idx, 'condition_status', e.target.value)}
                        className={`w-full border rounded px-1 py-0.5 text-xs ${
                          item.condition_status === 'DAMAGED' || item.condition_status === 'MISSING'
                            ? 'border-red-300 bg-red-50'
                            : ''
                        }`}
                      >
                        {CONDITION_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={item.condition_status || 'PENDING'} />
                    )}
                  </td>
                  <td>
                    {transition.status === 'UNDER_VERIFICATION' ? (
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={e => updateItem(idx, 'remarks', e.target.value)}
                        className={`w-full border rounded px-1.5 py-0.5 text-xs ${
                          (item.condition_status === 'DAMAGED' || item.condition_status === 'MISSING') && !item.remarks
                            ? 'border-red-400 bg-red-50'
                            : ''
                        }`}
                        placeholder={
                          (item.condition_status === 'DAMAGED' || item.condition_status === 'MISSING')
                            ? 'Remarks required!'
                            : 'Optional'
                        }
                      />
                    ) : (
                      <span className="text-xs text-gray-500">{item.remarks || '—'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Finalize Stock Charge Transfer</h3>
            <p className="text-xs text-gray-600 mb-4">
              This action will permanently transfer the charge of <strong>{transition.operational_department_name}</strong> from
              <strong> {transition.handed_over_by_name}</strong> to <strong>{transition.taken_over_by_name}</strong>.
              This action cannot be undone.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Verified By (Optional)</label>
                <select
                  value={finalizeForm.verified_by_user_id}
                  onChange={e => setFinalizeForm({ ...finalizeForm, verified_by_user_id: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— Select Verifier —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} {u.designation ? `(${u.designation})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Principal / Countersigning Authority (Optional)</label>
                <select
                  value={finalizeForm.principal_id}
                  onChange={e => setFinalizeForm({ ...finalizeForm, principal_id: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— Select Principal —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} {u.designation ? `(${u.designation})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {discrepancyCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-4">
                <p className="text-xs text-yellow-800">⚠️ {discrepancyCount} discrepancy/discrepancies noted. The transfer will proceed with remarks recorded.</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowFinalizeModal(false)} className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-xs hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="bg-green-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {finalizing ? 'Finalizing...' : '🔒 Confirm & Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
