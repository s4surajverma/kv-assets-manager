import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createAsset } from '../../api/assets';
import { getFundingHeads, getDepartments, getCategories, getSuppliers } from '../../api/masters';
import { FormField, SelectField, TextArea } from '../../components/FormFields';
import { current, fromDate } from '../../utils/helpers';

const schema = z.object({
  stock_ledger_id: z.coerce.number().positive('Stock Ledger ID required'),
  name: z.string().min(1), category_id: z.string().min(1), funding_head_id: z.string().min(1),
  department_id: z.string().min(1), purchase_date: z.string().min(1),
  total_units: z.coerce.number().int().positive(), unit_cost: z.coerce.number().min(0),
  total_cost: z.coerce.number().min(0), machine_no: z.string().optional(), accession_no: z.string().optional(),
  voucher_no: z.string().optional(), cheque_no: z.string().optional(), supplier_id: z.string().optional(),
  bill_no: z.string().optional(), bill_date: z.string().optional(), remarks: z.string().optional(),
});

export default function AssetForm() {
  const nav = useNavigate();
  const [funds, setFunds] = useState([]); const [depts, setDepts] = useState([]);
  const [cats, setCats] = useState([]); const [suppliers, setSuppliers] = useState([]);
  const [sub, setSub] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema), defaultValues: { total_units: 1, purchase_date: new Date().toISOString().split('T')[0] },
  });

  useEffect(() => {
    getFundingHeads().then(r => setFunds(r.data)); getDepartments().then(r => setDepts(r.data));
    getCategories().then(r => setCats(r.data)); getSuppliers().then(r => setSuppliers(r.data));
  }, []);

  const units = watch('total_units'), unitCost = watch('unit_cost');
  useEffect(() => { if (units && unitCost) setValue('total_cost', (units * unitCost).toFixed(2)); }, [units, unitCost, setValue]);

  const onSubmit = async (data) => {
    setSub(true);
    try {
      const p = { ...data }; ['category_id','funding_head_id','department_id','supplier_id'].forEach(k => { if(p[k]) p[k]=parseInt(p[k]); else delete p[k]; });
      Object.keys(p).forEach(k => p[k]==='' && delete p[k]);
      await createAsset(p); toast.success('Asset created'); nav('/assets');
    } catch{} finally { setSub(false); }
  };

  return (
    <div><h2 className="text-base font-semibold text-gray-800 mb-4">New Asset (GFR-22)</h2>
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-0">
      <div className="form-section"><p className="form-section-title">Link to Stock Register</p>
        <FormField label="Stock Ledger Entry ID" name="stock_ledger_id" type="number" register={register} errors={errors} required placeholder="e.g. 1" helperText="The ID of the fixed asset from the CS-24 stock register." />
      </div>
      <div className="form-section"><p className="form-section-title">Asset Details</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Asset Name" name="name" register={register} errors={errors} required placeholder="e.g. Dell Optiplex 7090 Desktop PC" helperText="Descriptive name of the asset." />
          <SelectField label="Category" name="category_id" register={register} errors={errors} required options={cats.map(c=>({value:String(c.id),label:`${c.code} — ${c.name} (${c.wdv_rate*100}%)`}))} helperText="Asset category determines the depreciation rate." />
          <SelectField label="Funding Head" name="funding_head_id" register={register} errors={errors} required options={funds.map(f=>({value:String(f.id),label:f.code}))} />
          <SelectField label="Department" name="department_id" register={register} errors={errors} required options={depts.map(d=>({value:String(d.id),label:d.code}))} />
          <FormField label="Machine / Serial No." name="machine_no" register={register} errors={errors} placeholder="e.g. SN-XYZ-123" />
          <FormField label="Accession No. (Library)" name="accession_no" register={register} errors={errors} placeholder="e.g. LIB-999" helperText="Only applicable for library books." />
        </div>
      </div>
      <div className="form-section"><p className="form-section-title">Purchase</p>
        <div className="grid grid-cols-4 gap-4">
          <FormField label="Purchase Date" name="purchase_date" type="date" register={register} errors={errors} required helperText="Date of acquisition." />
          <FormField label="Units" name="total_units" type="number" register={register} errors={errors} required placeholder="e.g. 1" />
          <FormField label="Unit Cost (₹)" name="unit_cost" type="number" register={register} errors={errors} step="0.01" placeholder="e.g. 1500" />
          <FormField label="Total Cost (₹)" name="total_cost" type="number" register={register} errors={errors} required step="0.01" placeholder="e.g. 1500" helperText="Total capitalized cost." />
        </div>
        <div className="grid grid-cols-4 gap-4 mt-3">
          <FormField label="Voucher No." name="voucher_no" register={register} errors={errors} />
          <FormField label="Cheque No." name="cheque_no" register={register} errors={errors} />
          <SelectField label="Supplier" name="supplier_id" register={register} errors={errors} options={suppliers.map(s=>({value:String(s.id),label:s.name}))} />
          <FormField label="Bill No." name="bill_no" register={register} errors={errors} />
        </div>
      </div>
      <div className="form-section"><TextArea label="Remarks" name="remarks" register={register} errors={errors} /></div>
      <div className="flex gap-3">
        <button type="submit" disabled={sub} className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{sub?'Saving...':'Save Asset'}</button>
        <button type="button" onClick={()=>nav('/assets')} className="border border-gray-300 px-6 py-2 rounded text-sm text-gray-600">Cancel</button>
      </div>
    </form></div>
  );
}
