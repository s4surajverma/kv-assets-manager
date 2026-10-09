import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createEntry } from '../../api/stock';
import { getDepartments, getFinancialYears } from '../../api/masters';
import { FormField, SelectField, TextArea } from '../../components/FormFields';
import { useAuth } from '../../context/AuthContext';
import { current } from '../../utils/helpers';

const schema = z.object({
  ledger_type: z.enum(['CS24', 'CS24A']),
  entry_type: z.enum(['RECEIPT', 'ISSUE', 'RETURN', 'WRITE_OFF', 'ADJUSTMENT', 'OPENING']),
  operational_department_id: z.string().min(1, 'Required'),
  financial_year: z.string().min(1, 'Required'),
  entry_date: z.string().min(1, 'Required'),
  item_description: z.string().min(1, 'Required'),
  stock_volume_no: z.coerce.number().int().positive('Volume number is required'),
  stock_page_no: z.coerce.number().int().positive('Page number is required'),
  quantity: z.coerce.number().positive('Must be > 0'),
  rate: z.coerce.number().min(0).optional(),
  amount: z.coerce.number().min(0, 'Must be >= 0'),
  is_donation: z.boolean().optional(),
  machine_no: z.string().optional(),
  code_no: z.string().optional(),
  voucher_no: z.string().optional(),
  cheque_no: z.string().optional(),
  from_whom: z.string().optional(),
  bill_no: z.string().optional(),
  bill_date: z.string().optional(),
  sanction_no: z.string().optional(),
  sanction_date: z.string().optional(),
  remarks: z.string().optional(),
});

export default function StockForm() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [depts, setDepts] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const location = useLocation();
  const currentTab = new URLSearchParams(location.search).get('tab') || 'CS24';
  const [submitting, setSubmitting] = useState(false);

  const isStockHolder = hasRole('StockHolder') && !hasRole('Admin');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ledger_type: currentTab, entry_type: 'RECEIPT', financial_year: current(),
      entry_date: new Date().toISOString().split('T')[0],
      operational_department_id: isStockHolder && user?.department_id ? String(user.department_id) : '',
      quantity: '', rate: '', amount: '', stock_page_no: '',
    },
  });

  useEffect(() => {
    getDepartments().then((r) => setDepts(r.data));
    getFinancialYears().then((r) => {
      const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : (r?.data?.data || []));
      setFinancialYears(list);
      const curr = list.find((y) => y.is_current)?.code || (list[0]?.code || current());
      setValue('financial_year', curr);
    }).catch((err) => console.error('Failed to load FYs in StockForm:', err));
  }, [setValue]);

  // Auto-calculate amount = qty * rate
  const qty = watch('quantity');
  const rate = watch('rate');
  useEffect(() => {
    if (qty && rate) setValue('amount', (parseFloat(qty) * parseFloat(rate)).toFixed(2));
  }, [qty, rate, setValue]);

  const entryType = watch('entry_type');

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = { ...data };
      payload.operational_department_id = parseInt(payload.operational_department_id);
      // Store "from whom received" in remarks if provided
      if (payload.from_whom) {
        payload.remarks = payload.from_whom + (payload.remarks ? ' | ' + payload.remarks : '');
      }
      delete payload.from_whom;
      // Clean empty optional fields
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      // Ensure boolean is true/false, not undefined
      payload.is_donation = !!payload.is_donation;
      await createEntry(payload);
      toast.success('Stock entry created');
      navigate(`/stock?tab=${payload.ledger_type}`);
    } catch { }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">New Stock Entry</h2>
          <p className="text-sm text-gray-500 mt-1">Record a new asset receipt, issue, return, or write-off into the stock ledger.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        {/* Section 1: Entry Type */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">1</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Entry Classification</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <SelectField label="Ledger Type" name="ledger_type" register={register} errors={errors} required
              options={[{ value: 'CS24', label: 'CS24 (Non-Consumable)' }, { value: 'CS24A', label: 'CS24A (Consumable)' }]} />
            <SelectField label="Entry Type" name="entry_type" register={register} errors={errors} required
              options={['RECEIPT', 'ISSUE', 'RETURN', 'WRITE_OFF', 'ADJUSTMENT', 'OPENING'].map((v) => ({ value: v, label: v }))} />
            {isStockHolder ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <input type="text" readOnly value={depts.find(d => String(d.id) === String(user?.department_id))?.name || '—'}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                <input type="hidden" {...register('operational_department_id')} />
                <p className="text-[11px] text-gray-400 mt-1">Auto-assigned</p>
              </div>
            ) : (
              <SelectField label="Department" name="operational_department_id" register={register} errors={errors} required
                options={depts.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.name}` }))}
                helperText="Select the operational unit." />
            )}
          </div>
        </div>

        {/* Section 2: Item Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">2</div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Item Details</h3>
            </div>
            {entryType === 'RECEIPT' && (
              <label className="flex items-center text-sm text-gray-700 font-medium cursor-pointer">
                <input type="checkbox" {...register('is_donation')} className="mr-2 h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 transition-all" />
                Received as Donation in kind of assets
              </label>
            )}
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2">
              <TextArea label="Item Description" name="item_description" register={register} errors={errors} required placeholder="e.g. Dell Optiplex 7090 Desktop PC..." helperText="Full details of the item." />
            </div>
            <FormField label="Machine / Serial No." name="machine_no" register={register} errors={errors} placeholder="e.g. SN-XYZ-123" helperText="Leave blank if not applicable." />
            <FormField label="Code No." name="code_no" register={register} errors={errors} placeholder="e.g. KV/CS/001" helperText="Internal code number." />
          </div>
        </div>

        {/* Section 3: Transaction */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">3</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Transaction Details</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SelectField
              label="Financial Year"
              name="financial_year"
              register={register}
              errors={errors}
              required
              options={financialYears.map((fy) => ({
                value: fy.code,
                label: `FY ${fy.code}${fy.is_current ? ' (Current)' : ''}${fy.is_closed ? ' [Closed]' : ''}`,
              }))}
              helperText="Financial Year for this transaction (auto-detected)."
            />
            <FormField label="Entry Date" name="entry_date" type="date" register={register} errors={errors} required />
            <FormField label="Volume No." name="stock_volume_no" type="number" register={register} errors={errors} required placeholder="e.g. 1" helperText="Physical stock register volume." />
            <FormField label="Page No." name="stock_page_no" type="number" register={register} errors={errors} required placeholder="e.g. 12" helperText="Page number in register." />
            <FormField label="Voucher No." name="voucher_no" register={register} errors={errors} placeholder="e.g. V-001" />
            <FormField label="Cheque No." name="cheque_no" register={register} errors={errors} placeholder="e.g. CHQ-5678" />
          </div>
        </div>

        {/* Section 4: Supplier (for RECEIPT) */}
        {entryType === 'RECEIPT' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
            <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">4</div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Supplier / Invoice</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField label="From whom received" name="from_whom" register={register} errors={errors}
                placeholder="e.g. Dell India Pvt. Ltd., Hyderabad" helperText="Name and address of the seller/supplier." />
              <FormField label="Bill No." name="bill_no" register={register} errors={errors} />
              <FormField label="Bill Date" name="bill_date" type="date" register={register} errors={errors} />
            </div>
          </div>
        )}

        {/* Section 5: Quantities */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">{entryType === 'RECEIPT' ? '5' : '4'}</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Quantities & Amount</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField label="Quantity" name="quantity" type="number" register={register} errors={errors} required step="0.01" placeholder="e.g. 10" helperText="Number of units." />
            <FormField label="Rate (₹)" name="rate" type="number" step="0.01" register={register} errors={errors} placeholder="0.00" />
            <FormField label={watch('is_donation') ? "Estimated Valuation (₹)" : "Total Amount (₹)"} name="amount" type="number" step="0.01" register={register} errors={errors} required placeholder="0.00" />
          </div>
        </div>

        {/* Section 6: Write-off sanction */}
        {entryType === 'WRITE_OFF' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
            <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">4</div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Write-off Sanction</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Sanction No." name="sanction_no" register={register} errors={errors} required />
              <FormField label="Sanction Date" name="sanction_date" type="date" register={register} errors={errors} required />
            </div>
          </div>
        )}

        {/* Remarks */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="p-6">
            <TextArea label="Remarks / Additional Notes" name="remarks" register={register} errors={errors} />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <button type="button" onClick={() => navigate(`/stock?tab=${currentTab}`)} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="relative overflow-hidden group bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-[length:200%_auto] text-white font-medium px-8 py-2.5 rounded-lg shadow-lg shadow-indigo-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none">
            <span className="relative z-10 flex items-center gap-2">
              {submitting ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...</>) : (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>Save Entry</>)}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
