import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDepartments } from '../../api/masters';
import { createTransition } from '../../api/transitions';
import api from '../../api/axios';

const REASON_OPTIONS = [
  { value: '', label: '— Select Reason (Optional) —' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'ADDITIONAL_CHARGE', label: 'Additional Charge' },
  { value: 'INTERNAL_REALLOCATION', label: 'Internal Reallocation' },
  { value: 'LONG_LEAVE', label: 'Long Leave' },
];

function StepBadge({ number, label, active, done }) {
  return (
    <div className={`flex items-center gap-3 ${active ? '' : 'opacity-60'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ring-4 flex-shrink-0 shadow-sm ${done ? 'bg-emerald-500 text-white ring-emerald-100' : active ? 'bg-indigo-600 text-white ring-indigo-100' : 'bg-gray-200 text-gray-500 ring-gray-50'}`}>
        {done ? '✓' : number}
      </div>
      <span className={`text-sm font-semibold ${active ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

export default function TransitionForm() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [currentIncharge, setCurrentIncharge] = useState(null);
  const [form, setForm] = useState({
    taken_over_by_user_id: '',
    handover_reason: '',
    effective_from_date: '',
    administrative_remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getDepartments().then(r => setDepartments(r.data || [])).catch(() => {});
    api.get('/users').then(r => setUsers(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDept) { setCurrentIncharge(null); return; }
    const dept = departments.find(d => d.id === parseInt(selectedDept));
    if (dept && dept.incharge_id) {
      const incharge = users.find(u => u.id === dept.incharge_id);
      setCurrentIncharge(incharge || { id: dept.incharge_id, name: `User #${dept.incharge_id}` });
    } else {
      setCurrentIncharge(null);
    }
  }, [selectedDept, departments, users]);

  const availableUsers = users.filter(u => u.is_active && u.id !== currentIncharge?.id);

  const step1Done = !!selectedDept && !!currentIncharge;
  const step2Done = !!form.taken_over_by_user_id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDept) return toast.error('Please select an operational department');
    if (!form.taken_over_by_user_id) return toast.error('Please select the incoming stock holder');
    setSubmitting(true);
    try {
      const res = await createTransition({
        operational_department_id: parseInt(selectedDept),
        taken_over_by_user_id: parseInt(form.taken_over_by_user_id),
        handover_reason: form.handover_reason || undefined,
        effective_from_date: form.effective_from_date || undefined,
        administrative_remarks: form.administrative_remarks || undefined,
      });
      toast.success(`Transfer initiated with ${res.data.items?.length || 0} items snapshotted`);
      navigate(`/transitions/${res.data.transition.id}`);
    } catch (err) {
      // handled by axios interceptor
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Initiate Stock Charge Transfer</h2>
        <p className="text-sm text-gray-500 mt-1">Transfer stock custodianship from one incharge to another.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3">
        <StepBadge number="1" label="Select Department" active={true} done={step1Done} />
        <div className="flex-1 h-px bg-gray-200 mx-1" />
        <StepBadge number="2" label="Select Incoming Holder" active={step1Done} done={step2Done} />
        <div className="flex-1 h-px bg-gray-200 mx-1" />
        <StepBadge number="3" label="Transfer Details" active={step1Done && step2Done} done={false} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-shadow hover:shadow-md">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-gray-100 flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ${step1Done ? 'bg-emerald-500 text-white ring-emerald-50' : 'bg-indigo-600 text-white ring-indigo-50'}`}>
              {step1Done ? '✓' : '1'}
            </div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Select Operational Department</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Operational Department <span className="text-red-500">*</span>
              </label>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
                <option value="">— Select Department —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            </div>

            {currentIncharge && (
              <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <div className="w-9 h-9 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Current Incharge (Handing Over)</div>
                  <div className="font-semibold text-indigo-900 mt-0.5">{currentIncharge.name}</div>
                  {currentIncharge.employee_code && (
                    <div className="text-xs text-indigo-600 font-mono mt-0.5">{currentIncharge.employee_code}</div>
                  )}
                </div>
              </div>
            )}

            {selectedDept && !currentIncharge && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-800 font-medium">No incharge currently assigned to this department. Assign an incharge first.</p>
              </div>
            )}
          </div>
        </div>

        {/* Step 2 */}
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all ${!step1Done ? 'opacity-50 pointer-events-none' : 'hover:shadow-md'}`}>
          <div className="px-6 py-4 bg-slate-50/50 border-b border-gray-100 flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ${step2Done ? 'bg-emerald-500 text-white ring-emerald-50' : 'bg-indigo-600 text-white ring-indigo-50'}`}>
              {step2Done ? '✓' : '2'}
            </div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Incoming Stock Holder</h3>
          </div>
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Taking Over By <span className="text-red-500">*</span>
            </label>
            <select value={form.taken_over_by_user_id} onChange={e => setForm({ ...form, taken_over_by_user_id: e.target.value })} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
              <option value="">— Select User —</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}{u.employee_code ? ` (${u.employee_code})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 3 */}
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all ${!(step1Done && step2Done) ? 'opacity-50 pointer-events-none' : 'hover:shadow-md'}`}>
          <div className="px-6 py-4 bg-slate-50/50 border-b border-gray-100 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 bg-indigo-600 text-white ring-indigo-50">3</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Transfer Details</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Handover Reason</label>
                <select value={form.handover_reason} onChange={e => setForm({ ...form, handover_reason: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all">
                  {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Effective From Date</label>
                <input type="date" value={form.effective_from_date} onChange={e => setForm({ ...form, effective_from_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Administrative Remarks <span className="text-gray-400 font-normal">(Optional)</span></label>
              <textarea value={form.administrative_remarks} onChange={e => setForm({ ...form, administrative_remarks: e.target.value })}
                rows={3} placeholder="Optional remarks about this transfer…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all resize-none" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit"
            disabled={submitting || !selectedDept || !form.taken_over_by_user_id || !currentIncharge}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-7 py-2.5 rounded-lg text-sm font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed">
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Creating…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>Initiate Transfer &amp; Generate Snapshot</>
            )}
          </button>
          <button type="button" onClick={() => navigate('/transitions')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
