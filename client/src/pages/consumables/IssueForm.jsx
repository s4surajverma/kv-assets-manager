import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { issueConsumable, getAvailableStock } from '../../api/consumables';
import { getUsers } from '../../api/users';
import { FormField, SelectField, TextArea } from '../../components/FormFields';

const schema = z.object({
  stock_ledger_id: z.coerce.number().positive('Stock Ledger ID required'),
  issued_to: z.coerce.number().positive('Issued To user ID required'),
  quantity: z.coerce.number().positive('Qty must be > 0'),
  purpose: z.string().min(1, 'Purpose required'),
});

export default function IssueForm() {
  const nav = useNavigate(); 
  const [sub, setSub] = useState(false);
  const [users, setUsers] = useState([]);
  const [stockItems, setStockItems] = useState([]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({ 
    resolver: zodResolver(schema),
    defaultValues: {
      stock_ledger_id: '',
      issued_to: '',
      quantity: '',
      purpose: ''
    }
  });

  useEffect(() => {
    // Fetch available users to issue to
    getUsers({ limit: 500 }).then(r => setUsers(r.data.data || r.data)).catch(() => {});
    getAvailableStock().then(r => setStockItems(r.data?.data || r.data)).catch(() => {});
  }, []);

  const selectedStockId = watch('stock_ledger_id');
  const maxAvailable = stockItems.find(s => String(s.stock_ledger_id) === String(selectedStockId))?.remaining_balance || 0;

  const onSubmit = async (data) => {
    if (data.quantity > maxAvailable) {
      toast.error(`Quantity cannot exceed available balance (${maxAvailable})`);
      return;
    }
    
    setSub(true);
    try { 
      await issueConsumable(data); 
      toast.success('Consumable issued successfully'); 
      nav('/stock?tab=CS24A'); 
    }
    catch (e) {
      toast.error(e.response?.data?.message || 'Failed to issue consumable');
    } 
    finally { setSub(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Issue Consumable (CS-24A)</h2>
          <p className="text-sm text-gray-500 mt-1">Dispense stock items to staff members for operational use.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">1</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Issue Details</h3>
          </div>
          <div className="p-6 space-y-6">
            
            <SelectField 
              label="Select Consumable Item" 
              name="stock_ledger_id" 
              register={register} 
              errors={errors} 
              required
              options={stockItems.map(s => ({
                value: String(s.stock_ledger_id),
                label: `${s.item_description} (Available: ${s.remaining_balance})`
              }))}
              helperText="Only items with a positive stock balance are shown."
            />

            <SelectField 
              label="Issue To (Staff Member)" 
              name="issued_to" 
              register={register} 
              errors={errors} 
              required
              options={users.map(u => ({
                value: String(u.id),
                label: `${u.name} (${u.employee_code || u.role})`
              }))}
              helperText="Select the person receiving the item."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                label="Quantity to Issue" 
                name="quantity" 
                type="number" 
                register={register} 
                errors={errors} 
                required 
                step="0.01" 
                placeholder="e.g. 5" 
                helperText={selectedStockId ? `Max available: ${maxAvailable}` : "Select an item first."}
              />
            </div>

            <TextArea 
              label="Purpose / Remarks" 
              name="purpose" 
              register={register} 
              errors={errors} 
              required 
              placeholder="e.g. For computer lab use..." 
              helperText="Briefly explain why this item is being issued." 
            />

          </div>
        </div>

        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <button type="button" onClick={() => nav('/stock?tab=CS24A')} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={sub || (selectedStockId && maxAvailable <= 0)} className="relative overflow-hidden group bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-[length:200%_auto] text-white font-medium px-8 py-2.5 rounded-lg shadow-lg shadow-indigo-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none">
            <span className="relative z-10 flex items-center gap-2">
              {sub ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Issuing...</>) : (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>Issue Consumable</>)}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
