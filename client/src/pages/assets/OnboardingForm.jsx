import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { previewOnboarding, executeOnboarding } from '../../api/onboarding';
import { getFundingHeads, getDepartments, getCategories, getSuppliers } from '../../api/masters';
import { FormField, SelectField, TextArea } from '../../components/FormFields';
import { useAuth } from '../../context/AuthContext';

const schema = z.object({
  name: z.string().min(1, 'Asset name required'),
  category_id: z.string().min(1, 'Category required'),
  funding_head_id: z.string().min(1, 'Funding head required'),
  asset_head_id: z.string().min(1, 'Asset head required'),
  operational_department_id: z.string().min(1, 'Department required'),
  purchase_date: z.string().min(1, 'Purchase date required'),
  total_units: z.coerce.number().int().positive(),
  unit_cost: z.coerce.number().min(0),
  total_cost: z.coerce.number().positive('Total cost must be > 0'),
  stock_volume_no: z.coerce.number().int().positive().optional(),
  machine_no: z.string().optional(),
  accession_no: z.string().optional(),
  voucher_no: z.string().optional(),
  cheque_no: z.string().optional(),
  supplier_id: z.string().optional(),
  bill_no: z.string().optional(),
  bill_date: z.string().optional(),
  remarks: z.string().optional(),
});

export default function OnboardingForm() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [funds, setFunds] = useState([]);
  const [depts, setDepts] = useState([]);
  const [cats, setCats] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { total_units: 1 },
  });

  useEffect(() => {
    getFundingHeads().then(r => setFunds(r.data));
    getDepartments().then(r => setDepts(r.data));
    getCategories().then(r => setCats(r.data));
    getSuppliers().then(r => setSuppliers(r.data));
  }, []);

  const units = watch('total_units');
  const unitCost = watch('unit_cost');
  useEffect(() => {
    if (units && unitCost) setValue('total_cost', (units * unitCost).toFixed(2));
  }, [units, unitCost, setValue]);

  // ── Preview Handler ────────────────────────────
  const onPreview = async (data) => {
    setPreviewing(true);
    setPreviewData(null);
    try {
      const res = await previewOnboarding({
        purchase_date: data.purchase_date,
        total_cost: parseFloat(data.total_cost),
        category_id: parseInt(data.category_id),
      });
      setPreviewData(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Execute Handler ────────────────────────────
  const onSubmit = async (data) => {
    if (!previewData) {
      toast.error('Please preview the onboarding first');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...data };
      ['category_id', 'funding_head_id', 'asset_head_id', 'operational_department_id', 'supplier_id']
        .forEach(k => { if (payload[k]) payload[k] = parseInt(payload[k]); else delete payload[k]; });
      Object.keys(payload).forEach(k => payload[k] === '' && delete payload[k]);

      const res = await executeOnboarding(payload);
      const result = res.data;
      toast.success(
        `Asset ${result.asset.asset_number} onboarded successfully` +
        (result.depreciation_entries_count > 0
          ? ` — ${result.depreciation_entries_count} year(s) of depreciation auto-generated`
          : '')
      );
      nav('/assets');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-1">Opening Entry — Historical Asset Onboarding</h2>
      <p className="text-xs text-gray-500 mb-4">
        Use this form to onboard assets purchased before the system was adopted.
        The system will automatically generate the historical depreciation history.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-0">
        {/* Section 1: Asset Details */}
        <div className="form-section">
          <p className="form-section-title">Asset Details</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Asset Name" name="name" register={register} errors={errors} required
              placeholder="e.g. Dell Optiplex 7090 Desktop PC" />
            <SelectField label="Category (determines depreciation rate)" name="category_id" register={register} errors={errors} required
              options={cats.map(c => ({ value: String(c.id), label: `${c.code} — ${c.name} (${(c.wdv_rate * 100).toFixed(0)}% WDV)` }))} />
            <SelectField label="Funding Head" name="funding_head_id" register={register} errors={errors} required
              options={funds.map(f => ({ value: String(f.id), label: `${f.code} — ${f.name}` }))} />
            <SelectField label="Asset Head (Department)" name="asset_head_id" register={register} errors={errors} required
              options={depts.map(d => ({ value: String(d.id), label: `${d.code} — ${d.name}` }))} />
            <SelectField label="Operational Department" name="operational_department_id" register={register} errors={errors} required
              options={depts.map(d => ({ value: String(d.id), label: `${d.code} — ${d.name}` }))} />
            <FormField label="Machine / Serial No." name="machine_no" register={register} errors={errors}
              placeholder="e.g. SN-XYZ-123" />
            <FormField label="Accession No. (Library)" name="accession_no" register={register} errors={errors}
              placeholder="e.g. LIB-999" />
          </div>
        </div>

        {/* Section 2: Purchase Details */}
        <div className="form-section">
          <p className="form-section-title">Original Purchase Details</p>
          <div className="grid grid-cols-4 gap-4">
            <FormField label="Original Purchase Date" name="purchase_date" type="date" register={register} errors={errors} required
              helperText="The actual date the asset was originally purchased." />
            <FormField label="Units" name="total_units" type="number" register={register} errors={errors} required />
            <FormField label="Unit Cost (₹)" name="unit_cost" type="number" step="0.01" register={register} errors={errors} />
            <FormField label="Total Cost (₹)" name="total_cost" type="number" step="0.01" register={register} errors={errors} required />
          </div>
          <div className="grid grid-cols-4 gap-4 mt-3">
            <FormField label="Voucher No." name="voucher_no" register={register} errors={errors} />
            <FormField label="Cheque No." name="cheque_no" register={register} errors={errors} />
            <SelectField label="Supplier" name="supplier_id" register={register} errors={errors}
              options={suppliers.map(s => ({ value: String(s.id), label: s.name }))} />
            <FormField label="Bill No." name="bill_no" register={register} errors={errors} />
          </div>
          <div className="grid grid-cols-4 gap-4 mt-3">
            <FormField label="Stock Register Volume No." name="stock_volume_no" type="number" register={register} errors={errors} />
          </div>
        </div>

        {/* Section 3: Remarks */}
        <div className="form-section">
          <TextArea label="Remarks" name="remarks" register={register} errors={errors} />
        </div>

        {/* Preview Button */}
        <div className="flex gap-3 mb-4">
          <button type="button" disabled={previewing}
            onClick={handleSubmit(onPreview)}
            className="bg-amber-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
            {previewing ? 'Computing...' : '📊 Preview Onboarding'}
          </button>
        </div>

        {/* Preview Results */}
        {previewData && (
          <div className="form-section border-2 border-blue-200 bg-blue-50/30 rounded-lg">
            <p className="form-section-title text-blue-800">Onboarding Preview</p>

            {!previewData.is_historical ? (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                <strong>Current FY Asset</strong> — No historical depreciation needed.
                The asset will be registered at full cost.
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 mb-3">
                  <strong>Historical asset detected.</strong> System will generate depreciation
                  history from FY {previewData.purchase_fy} to FY {previewData.target_fy} automatically.
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">Original Cost</p>
                    <p className="text-lg font-bold text-gray-800">{formatCurrency(previewData.original_cost)}</p>
                  </div>
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">Accumulated Depreciation</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(previewData.final_accum_depreciation)}</p>
                  </div>
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">Opening Book Value</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(previewData.final_book_value)}</p>
                  </div>
                  <div className="bg-white rounded-lg border p-3 text-center">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">Years Generated</p>
                    <p className="text-lg font-bold text-blue-700">{previewData.entries_count}</p>
                  </div>
                </div>

                {/* Year-by-year table */}
                {previewData.entries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border px-2 py-1.5 text-left font-semibold">FY</th>
                          <th className="border px-2 py-1.5 text-right font-semibold">Opening (₹)</th>
                          <th className="border px-2 py-1.5 text-center font-semibold">Rate</th>
                          <th className="border px-2 py-1.5 text-right font-semibold">Depreciation (₹)</th>
                          <th className="border px-2 py-1.5 text-right font-semibold">Closing (₹)</th>
                          <th className="border px-2 py-1.5 text-center font-semibold">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.entries.map((e, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="border px-2 py-1">{e.financial_year}</td>
                            <td className="border px-2 py-1 text-right font-mono">{formatCurrency(e.opening_value)}</td>
                            <td className="border px-2 py-1 text-center">{(e.rate_applied * 100).toFixed(0)}%</td>
                            <td className="border px-2 py-1 text-right font-mono text-red-600">{formatCurrency(e.depreciation_amount)}</td>
                            <td className="border px-2 py-1 text-right font-mono">{formatCurrency(e.closing_value)}</td>
                            <td className="border px-2 py-1 text-center">
                              <span className="inline-block bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                SYSTEM
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 mt-4">
          <button type="submit" disabled={submitting || !previewData}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Onboarding...' : '✅ Confirm Opening Entry'}
          </button>
          <button type="button" onClick={() => nav('/assets')}
            className="border border-gray-300 px-6 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
