import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createVerification } from '../../api/verification';
import { getDepartments, getFinancialYears } from '../../api/masters';
import { SelectField } from '../../components/FormFields';
import { current } from '../../utils/helpers';

const schema = z.object({
  financial_year: z.string().min(1),
  operational_department_id: z.string().min(1, 'Department is required'),
  custodian_employee_code: z.string().min(1, 'Selected department has no Stock Holder assigned. Please assign an In-Charge in Department settings first.'),
});

export default function VerificationForm() {
  const nav = useNavigate();
  const [depts, setDepts] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [sub, setSub] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema), defaultValues: { financial_year: current() },
  });

  const selectedDeptId = watch('operational_department_id');

  useEffect(() => {
    getDepartments().then(r => setDepts(r.data));
    getFinancialYears().then(r => {
      const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : (r?.data?.data || []));
      setFinancialYears(list);
      const currentFY = list.find(y => y.is_current)?.code || (list[0]?.code || current());
      setValue('financial_year', currentFY);
    }).catch(err => console.error('Failed to load FYs in VerificationForm:', err));
  }, [setValue]);

  // Auto-set stock holder from department in-charge
  const selectedDept = depts.find(d => String(d.id) === String(selectedDeptId));
  const stockHolderName = selectedDept?.incharge_name || null;
  const stockHolderCode = selectedDept?.incharge_employee_code || '';

  useEffect(() => {
    setValue('custodian_employee_code', stockHolderCode);
  }, [stockHolderCode, setValue]);

  const onSubmit = async (data) => {
    setSub(true);
    try {
      const p = { ...data, operational_department_id: parseInt(data.operational_department_id) };
      await createVerification(p);
      toast.success('Verification created with checklist');
      nav('/verification');
    } catch {} finally { setSub(false); }
  };

  return (
    <div><h2 className="text-base font-semibold text-gray-800 mb-4">New Physical Verification</h2>
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <div className="form-section">
        <div className="space-y-4">
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
            helperText="The financial year this verification applies to (auto-detected)."
          />
          <SelectField label="Department" name="operational_department_id" register={register} errors={errors} required options={depts.map(d=>({value:String(d.id),label:`${d.code} — ${d.name}`}))} helperText="The operational department whose assets are being verified." />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Stock Holder</label>
            <input type="hidden" {...register('custodian_employee_code')} />
            {!selectedDeptId ? (
              <p className="border rounded px-2.5 py-1.5 text-sm w-full bg-gray-50 text-gray-400">Select a department first</p>
            ) : stockHolderName ? (
              <p className="border rounded px-2.5 py-1.5 text-sm w-full bg-gray-50 text-gray-800 font-medium">{stockHolderName} ({stockHolderCode})</p>
            ) : (
              <p className="border rounded px-2.5 py-1.5 text-sm w-full bg-red-50 text-red-600">No In-Charge assigned to this department</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">Automatically set from the department's In-Charge.</p>
            {errors.custodian_employee_code && <p className="text-xs text-red-500 mt-0.5">{errors.custodian_employee_code.message}</p>}
          </div>
        </div>
      </div>
      <button type="submit" disabled={sub} className="bg-blue-600 text-white px-6 py-2 rounded text-sm disabled:opacity-50">{sub?'Creating...':'Create & Generate Checklist'}</button>
    </form></div>
  );
}
