import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createDisposal, updateSale, completeDisposal } from '../../api/disposal';
import { FormField, SelectField, TextArea } from '../../components/FormFields';

const schema = z.object({
  condemnation_ref: z.string().min(1, 'Condemnation Ref is required'), sanction_id: z.coerce.number().positive(),
  disposal_mode: z.enum(['ADVERTISED_TENDER','PUBLIC_AUCTION','SCRAP_SALE','DESTRUCTION','TRANSFER','OTHER']),
  disposal_date: z.string().min(1), reserve_price: z.coerce.number().optional(),
  is_hazardous: z.boolean().optional(), recycler_registration: z.string().optional(), remarks: z.string().optional(),
});

export default function DisposalForm() {
  const nav = useNavigate(); const [params] = useSearchParams();
  const [sub, setSub] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      condemnation_ref: params.get('condemnation_ref') || '', sanction_id: params.get('sanction_id') || '',
      disposal_date: new Date().toISOString().split('T')[0], disposal_mode: 'SCRAP_SALE', is_hazardous: false,
    },
  });

  const onSubmit = async (data) => {
    setSub(true);
    try {
      Object.keys(data).forEach(k => data[k] === '' && delete data[k]);
      await createDisposal(data); toast.success('Disposal record created'); nav('/disposal');
    } catch {} finally { setSub(false); }
  };

  const MODES = ['ADVERTISED_TENDER','PUBLIC_AUCTION','SCRAP_SALE','DESTRUCTION','TRANSFER','OTHER'].map(v => ({ value: v, label: v.replace(/_/g, ' ') }));

  return (
    <div><h2 className="text-base font-semibold text-gray-800 mb-4">New Disposal</h2>
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
      <div className="form-section">
        <p className="form-section-title">References</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Condemnation Ref" name="condemnation_ref" type="text" register={register} errors={errors} required helperText="Reference ID of the condemned asset." />
          <FormField label="Sanction ID" name="sanction_id" type="number" register={register} errors={errors} required helperText="ID of the approved sanction." />
        </div>
      </div>
      <div className="form-section">
        <p className="form-section-title">Disposal Details</p>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Disposal Mode" name="disposal_mode" register={register} errors={errors} required options={MODES} helperText="Method used for disposal." />
          <FormField label="Disposal Date" name="disposal_date" type="date" register={register} errors={errors} required helperText="Date the disposal occurred." />
          <FormField label="Reserve Price (₹)" name="reserve_price" type="number" register={register} errors={errors} step="0.01" placeholder="e.g. 5000" helperText="If > ₹4,00,000, must be auction/tender (GFR 218)." />
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" {...register('is_hazardous')} id="haz" />
            <label htmlFor="haz" className="text-sm">Hazardous Material (e-Waste)</label>
          </div>
        </div>
        <div className="mt-3">
          <FormField label="Recycler Registration (if hazardous)" name="recycler_registration" register={register} errors={errors} placeholder="e.g. CPCB Reg No..." helperText="Required for hazardous waste (e.g. e-waste to registered recyclers)." />
        </div>
      </div>
      <div className="form-section"><TextArea label="Remarks" name="remarks" register={register} errors={errors} /></div>
      <button type="submit" disabled={sub} className="bg-blue-600 text-white px-6 py-2 rounded text-sm disabled:opacity-50">{sub?'Saving...':'Create Disposal'}</button>
    </form></div>
  );
}
