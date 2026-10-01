import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { returnConsumable, getActiveIssues } from '../../api/consumables';
import { FormField, SelectField } from '../../components/FormFields';

const schema = z.object({
  issue_id: z.coerce.number().positive('Issue ID required'),
  returned_qty: z.coerce.number().positive('Qty must be > 0'),
});

export default function ReturnForm() {
  const nav = useNavigate(); 
  const [sub, setSub] = useState(false);
  const [issues, setIssues] = useState([]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({ 
    resolver: zodResolver(schema),
    defaultValues: {
      issue_id: '',
      returned_qty: ''
    }
  });

  useEffect(() => {
    // Fetch only active issues (quantity > returned_qty)
    getActiveIssues().then(r => setIssues(r.data?.data || r.data)).catch(() => {});
  }, []);

  const selectedIssueId = watch('issue_id');
  const selectedIssue = issues.find(i => String(i.id) === String(selectedIssueId));
  const maxReturnable = selectedIssue ? Number(selectedIssue.max_returnable) : 0;

  const onSubmit = async (data) => {
    if (data.returned_qty > maxReturnable) {
      toast.error(`Quantity cannot exceed max returnable (${maxReturnable})`);
      return;
    }
    
    setSub(true);
    try { 
      await returnConsumable(data); 
      toast.success('Consumable returned successfully'); 
      nav('/stock?tab=CS24A'); 
    }
    catch (e) {
      toast.error(e.response?.data?.message || 'Failed to return consumable');
    } 
    finally { setSub(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Return Consumable</h2>
          <p className="text-sm text-gray-500 mt-1">Process the return of an unused consumable item back to stock.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">1</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Return Details</h3>
          </div>
          <div className="p-6 space-y-6">
            
            <SelectField 
              label="Select Active Issue Record" 
              name="issue_id" 
              register={register} 
              errors={errors} 
              required
              options={issues.map(i => ({
                value: String(i.id),
                label: `[#${i.id}] ${i.item_description} — Issued to ${i.issued_to_name} (Max Returnable: ${i.max_returnable})`
              }))}
              helperText="Only items that have been issued and not fully returned are shown."
            />

            {selectedIssue && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField 
                  label="Quantity to Return" 
                  name="returned_qty" 
                  type="number" 
                  register={register} 
                  errors={errors} 
                  required 
                  step="0.01" 
                  placeholder="e.g. 2" 
                  helperText={`Max returnable: ${maxReturnable}`}
                />
              </div>
            )}
            
            {!selectedIssue && (
              <div className="text-sm text-gray-400 italic">Select an issue record first to proceed.</div>
            )}

          </div>
        </div>

        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <button type="button" onClick={() => nav('/stock?tab=CS24A')} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={sub || !selectedIssue || maxReturnable <= 0} className="relative overflow-hidden group bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-[length:200%_auto] text-white font-medium px-8 py-2.5 rounded-lg shadow-lg shadow-indigo-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none">
            <span className="relative z-10 flex items-center gap-2">
              {sub ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Returning...</>) : (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Return Consumable</>)}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
