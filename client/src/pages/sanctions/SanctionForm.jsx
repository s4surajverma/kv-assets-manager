import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createSanction } from '../../api/sanctions';
import { FormField, TextArea } from '../../components/FormFields';

const schema = z.object({ condemnation_ref: z.string().min(1, 'Condemnation Ref is required'), sanction_no: z.string().min(1), sanction_date: z.string().min(1), comments: z.string().optional() });

export default function SanctionForm() {
  const nav = useNavigate(); const [params] = useSearchParams();
  const [sub, setSub] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { condemnation_ref: params.get('condemnation_ref') || '', sanction_date: new Date().toISOString().split('T')[0] },
  });

  const onSubmit = async (data) => {
    setSub(true);
    try { await createSanction(data); toast.success('Sanction created (authority auto-routed)'); nav('/sanctions'); }
    catch {} finally { setSub(false); }
  };

  return (
    <div><h2 className="text-base font-semibold text-gray-800 mb-4">New Sanction</h2>
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg">
      <div className="form-section space-y-4">
        <FormField label="Condemnation Ref" name="condemnation_ref" type="text" register={register} errors={errors} required placeholder="e.g. master-1" helperText="The reference string of the board-reviewed condemnation entry." />
        <FormField label="Sanction No." name="sanction_no" register={register} errors={errors} required placeholder="e.g. SAN-2026-001" helperText="The official sanction order number." />
        <FormField label="Sanction Date" name="sanction_date" type="date" register={register} errors={errors} required helperText="Date of the sanction order." />
        <TextArea label="Comments" name="comments" register={register} errors={errors} placeholder="Any additional remarks..." />
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">ℹ️ Authority will be auto-assigned based on amount: ≤₹500 → Principal, ≤₹2L → VMC, else → Regional Officer</p>
      </div>
      <button type="submit" disabled={sub} className="bg-blue-600 text-white px-6 py-2 rounded text-sm disabled:opacity-50">{sub?'Creating...':'Create Sanction'}</button>
    </form></div>
  );
}
