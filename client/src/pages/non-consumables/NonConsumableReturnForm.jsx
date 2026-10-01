import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getActiveIssues, getIssueById, returnAssets } from '../../api/nonConsumable';
import { SelectField, FormField, TextArea } from '../../components/FormFields';
import { formatDate } from '../../utils/helpers';

const schema = z.object({
  issue_master_id: z.coerce.number().positive('Select an active issue'),
  returns: z.array(z.object({
    issue_item_id: z.coerce.number(),
    quantity_returning: z.coerce.number().int('Must be whole number').min(0, 'Cannot be negative'),
    condition_at_return: z.enum(['GOOD', 'FAIR', 'DAMAGED', 'UNSERVICEABLE']).optional(),
    return_remarks: z.string().optional()
  })).min(1, 'No items to return')
}).superRefine((data, ctx) => {
  const totalReturning = data.returns.reduce((sum, r) => sum + r.quantity_returning, 0);
  if (totalReturning === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must return at least 1 unit across all items', path: ['issue_master_id'] });
  }
});

export default function NonConsumableReturnForm() {
  const nav = useNavigate();
  const [sub, setSub] = useState(false);
  const [activeIssues, setActiveIssues] = useState([]);
  const [issueDetails, setIssueDetails] = useState(null);

  const { register, control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      issue_master_id: '',
      returns: []
    }
  });

  const { fields, replace } = useFieldArray({ control, name: 'returns' });

  const selectedMasterId = watch('issue_master_id');

  useEffect(() => {
    getActiveIssues().then(r => setActiveIssues(r.data.data || r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedMasterId) {
      getIssueById(selectedMasterId).then(r => {
        const details = r.data.data || r.data;
        setIssueDetails(details);
        replace(details.items.map(item => ({
          issue_item_id: item.id,
          quantity_returning: 0,
          condition_at_return: 'GOOD',
          return_remarks: ''
        })));
      }).catch(() => toast.error('Failed to load issue details'));
    } else {
      setIssueDetails(null);
      replace([]);
    }
  }, [selectedMasterId, replace]);

  const onSubmit = async (data) => {
    // Filter out returns with 0 quantity
    const validReturns = data.returns.filter(r => r.quantity_returning > 0);
    
    // Validate that we aren't returning more than outstanding
    if (issueDetails) {
      for (const ret of validReturns) {
        const item = issueDetails.items.find(i => i.id === ret.issue_item_id);
        if (item) {
          const outstanding = item.quantity_issued - item.quantity_returned;
          if (ret.quantity_returning > outstanding) {
            toast.error(`Cannot return more than ${outstanding} for item ${item.asset_name_snapshot}`);
            return;
          }
        }
      }
    }

    setSub(true);
    try {
      await returnAssets({
        issue_master_id: data.issue_master_id,
        returns: validReturns
      });
      toast.success('Assets returned successfully');
      nav('/stock/custody');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to process return');
    } finally {
      setSub(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
        <Link to="/stock/custody" className="p-2 hover:bg-gray-100 rounded-full transition-colors group">
          <svg className="w-6 h-6 text-gray-500 group-hover:text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Return Item</h2>
          <p className="text-sm text-gray-500 mt-1">Process a partial or full return for an active issue.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Select Issue</h3>
          </div>
          <div className="p-6">
            <SelectField 
              label="Active Issue" name="issue_master_id" 
              register={register} errors={errors} required
              options={activeIssues.map(i => ({
                value: String(i.id),
                label: `${i.issue_no} — Issued to ${i.target_name} on ${formatDate(i.issue_date)} (Outstanding: ${i.total_outstanding})`
              }))}
            />
          </div>
        </div>

        {issueDetails && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Items to Return</h3>
              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded">
                Target: {issueDetails.issue_target_type === 'USER' ? issueDetails.to_user_name : issueDetails.to_department_name}
              </span>
            </div>
            
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-4">Asset Details</th>
                    <th className="p-4 text-center">Outstanding</th>
                    <th className="p-4 w-32">Return Qty</th>
                    <th className="p-4 w-40">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fields.map((field, index) => {
                    const item = issueDetails.items.find(i => i.id === field.issue_item_id);
                    if (!item) return null;
                    const outstanding = item.quantity_issued - item.quantity_returned;
                    if (outstanding === 0) return null; // Already fully returned

                    return (
                      <tr key={field.id} className="hover:bg-slate-50/50">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{item.asset_name_snapshot}</p>
                          <p className="text-xs text-slate-500 mt-1 font-mono">{item.asset_number_snapshot || 'No Asset Number'}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-base font-black text-amber-600">{outstanding}</span>
                        </td>
                        <td className="p-4">
                          <FormField 
                            name={`returns.${index}.quantity_returning`} 
                            type="number" 
                            register={register} 
                            errors={errors} 
                            placeholder="0"
                            min="0"
                            max={outstanding}
                          />
                        </td>
                        <td className="p-4">
                          <SelectField 
                            name={`returns.${index}.condition_at_return`} 
                            register={register} 
                            errors={errors}
                            options={[
                              { value: 'GOOD', label: 'Good' },
                              { value: 'FAIR', label: 'Fair' },
                              { value: 'DAMAGED', label: 'Damaged' },
                              { value: 'UNSERVICEABLE', label: 'Unserviceable' }
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {errors.issue_master_id && errors.issue_master_id.type === 'custom' && (
                <p className="p-4 text-red-500 text-sm font-bold text-center border-t border-red-100 bg-red-50">
                  {errors.issue_master_id.message}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 pt-4">
          <button type="button" onClick={() => nav('/stock/custody')} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={sub || !issueDetails} className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg shadow font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2">
            {sub ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
            {sub ? 'Processing...' : 'Process Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
