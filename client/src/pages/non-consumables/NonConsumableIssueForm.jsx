import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { issueAssets, getAvailableAssets } from '../../api/nonConsumable';
import { getDepartments } from '../../api/masters';
import { getUsers } from '../../api/users';
import { FormField, SelectField, TextArea } from '../../components/FormFields';

const schema = z.object({
  issued_from_department_id: z.coerce.number().positive('Issuing department required'),
  asset_id: z.coerce.number().positive('Asset selection required'),
  quantity: z.coerce.number().int('Must be whole number').positive('Quantity must be > 0'),
  issue_target_type: z.enum(['DEPARTMENT', 'USER']),
  issued_to_department_id: z.coerce.number().optional().or(z.literal('')),
  issued_to_user_id: z.coerce.number().optional().or(z.literal('')),
  purpose: z.string().min(1, 'Purpose is required'),
  issue_date: z.string().optional(),
  expected_return_date: z.string().optional(),
  remarks: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.issue_target_type === 'DEPARTMENT' && !data.issued_to_department_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Target department required', path: ['issued_to_department_id'] });
  }
  if (data.issue_target_type === 'USER' && !data.issued_to_user_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Target user required', path: ['issued_to_user_id'] });
  }
});

export default function NonConsumableIssueForm() {
  const nav = useNavigate();
  const [sub, setSub] = useState(false);
  const [depts, setDepts] = useState([]);
  const [users, setUsers] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  const { register, handleSubmit, watch, resetField, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      issue_target_type: 'USER',
      quantity: 1,
      issue_date: new Date().toISOString().split('T')[0]
    }
  });

  const fromDeptId = watch('issued_from_department_id');
  const targetType = watch('issue_target_type');
  const selectedAssetId = watch('asset_id');

  useEffect(() => {
    getDepartments().then(r => setDepts(r.data)).catch(() => {});
    getUsers({ limit: 500 }).then(r => setUsers(r.data.data || r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (fromDeptId) {
      setLoadingAssets(true);
      resetField('asset_id');
      getAvailableAssets({ dept_id: fromDeptId })
        .then(r => setAvailableAssets(r.data.data || r.data))
        .catch(() => toast.error('Failed to load assets'))
        .finally(() => setLoadingAssets(false));
    } else {
      setAvailableAssets([]);
    }
  }, [fromDeptId, resetField]);

  const selectedAsset = availableAssets.find(a => String(a.id) === String(selectedAssetId));

  const onSubmit = async (data) => {
    if (selectedAsset && data.quantity > selectedAsset.available_quantity) {
      toast.error(`Quantity exceeds available balance (${selectedAsset.available_quantity})`);
      return;
    }

    setSub(true);
    try {
      const payload = {
        issued_from_department_id: data.issued_from_department_id,
        issue_target_type: data.issue_target_type,
        issued_to_department_id: data.issue_target_type === 'DEPARTMENT' ? data.issued_to_department_id : undefined,
        issued_to_user_id: data.issue_target_type === 'USER' ? data.issued_to_user_id : undefined,
        purpose: data.purpose,
        issue_date: data.issue_date,
        expected_return_date: data.expected_return_date || undefined,
        remarks: data.remarks || undefined,
        items: [{
          asset_id: data.asset_id,
          quantity: data.quantity
        }]
      };

      await issueAssets(payload);
      toast.success('Asset issued successfully');
      nav('/stock/custody');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to issue asset');
    } finally {
      setSub(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
        <Link to="/stock/custody" className="p-2 hover:bg-gray-100 rounded-full transition-colors group">
          <svg className="w-6 h-6 text-gray-500 group-hover:text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Issue Item</h2>
          <p className="text-sm text-gray-500 mt-1">Temporarily assign a non-consumable item to a user or department.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        {/* Step 1: Asset Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">1</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Source & Item</h3>
          </div>
          <div className="p-6 space-y-6">
            <SelectField 
              label="Issuing From Department" 
              name="issued_from_department_id" 
              register={register} errors={errors} required
              options={depts.map(d => ({ value: String(d.id), label: d.name }))}
              helperText="Select the department currently holding the asset."
            />

            <SelectField 
              label={loadingAssets ? 'Loading Assets...' : 'Select Asset'} 
              name="asset_id" 
              register={register} errors={errors} required
              disabled={!fromDeptId || loadingAssets}
              options={availableAssets.map(a => ({
                value: String(a.id),
                label: `${a.name} [${a.asset_number}] — (Available: ${a.available_quantity})`
              }))}
              helperText="Only active assets with available quantity are shown."
            />

            {selectedAsset && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Asset Status</p>
                  <p className="text-sm text-indigo-900 mt-1 font-medium">{selectedAsset.name} ({selectedAsset.asset_number})</p>
                </div>
                <div className="text-right flex gap-6">
                  <div>
                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Total Units</p>
                    <p className="text-xl text-indigo-900 font-black">{selectedAsset.total_units}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Already Issued</p>
                    <p className="text-xl text-amber-900 font-black">{selectedAsset.total_issued_quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Available</p>
                    <p className="text-xl text-emerald-900 font-black">{selectedAsset.available_quantity}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="w-1/3">
              <FormField 
                label="Quantity to Issue" name="quantity" type="number" 
                register={register} errors={errors} required 
                helperText={selectedAsset ? `Max: ${selectedAsset.available_quantity}` : ''}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Target Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">2</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Target & Purpose</h3>
          </div>
          <div className="p-6 space-y-6">
            <SelectField 
              label="Issue To (Target Type)" 
              name="issue_target_type" 
              register={register} errors={errors} required
              options={[
                { value: 'USER', label: 'Individual User / Staff' },
                { value: 'DEPARTMENT', label: 'Operational Department' }
              ]}
            />

            {targetType === 'USER' && (
              <SelectField 
                label="Select User" name="issued_to_user_id" 
                register={register} errors={errors} required
                options={users.map(u => ({ value: String(u.id), label: `${u.name} (${u.employee_code || 'N/A'})` }))}
              />
            )}

            {targetType === 'DEPARTMENT' && (
              <SelectField 
                label="Select Target Department" name="issued_to_department_id" 
                register={register} errors={errors} required
                options={depts.map(d => ({ value: String(d.id), label: d.name }))}
              />
            )}

            <TextArea 
              label="Purpose of Issue" name="purpose" 
              register={register} errors={errors} required 
              placeholder="e.g. For official school presentation..." 
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Issue Date" name="issue_date" type="date" register={register} errors={errors} />
              <FormField label="Expected Return Date" name="expected_return_date" type="date" register={register} errors={errors} helperText="Optional" />
            </div>
            <TextArea label="Additional Remarks" name="remarks" register={register} errors={errors} placeholder="Optional notes" />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={() => nav('/stock/custody')} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={sub} className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg shadow font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2">
            {sub ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
            {sub ? 'Processing...' : 'Issue Asset'}
          </button>
        </div>
      </form>
    </div>
  );
}
