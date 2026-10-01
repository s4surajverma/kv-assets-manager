import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDepartments, getFundingHeads } from '../../api/masters';
import { getEligibleAssets, calculateBulk, createCondemnation } from '../../api/condemnation';
import DepreciationBreakdownModal from '../../components/DepreciationBreakdownModal';
import { formatCurrency, formatDate } from '../../utils/helpers';

const METHOD_OPTIONS = [
  { value: 'WDV_POST_2011', label: 'WDV Only — Written Down Value (2011 Onwards Rate)' },
  { value: 'SLM_PRE_2011',  label: 'SLM Only — Straight Line Method (Pre-2011 Rate)' },
  { value: 'BOTH',          label: 'Both — SLM Pre-2011 + WDV 2011 onwards' },
];

export default function CondemnationForm() {
  const nav = useNavigate();

  // ── Step 1 state
  const [opDepts, setOpDepts]       = useState([]);
  const [fundHeads, setFundHeads]   = useState([]);
  const [opDeptId, setOpDeptId]     = useState('');
  const [fundId, setFundId]         = useState('');
  const [method, setMethod]         = useState('WDV_POST_2011');
  const [reason, setReason]         = useState('');
  const [dateUnsvc, setDateUnsvc]   = useState('');

  // ── Step 2 state
  const [assets, setAssets]         = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [selected, setSelected]     = useState(new Set());
  const [search, setSearch]         = useState('');

  // ── Step 3 state
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  useEffect(() => {
    getDepartments().then(r => setOpDepts(r.data)).catch(() => {});
    getFundingHeads().then(r => setFundHeads(r.data)).catch(() => {});
  }, []);

  // Load assets when dept + fund both selected
  useEffect(() => {
    if (!opDeptId || !fundId) { setAssets([]); setSelected(new Set()); setCalcResult(null); return; }
    setAssetLoading(true);
    setSelected(new Set());
    setCalcResult(null);
    getEligibleAssets({ operational_department_id: opDeptId, funding_head_id: fundId })
      .then(r => setAssets(r.data))
      .catch(() => toast.error('Failed to load assets'))
      .finally(() => setAssetLoading(false));
  }, [opDeptId, fundId]);

  const filteredAssets = assets.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.asset_number?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (selected.size === filteredAssets.length) setSelected(new Set());
    else setSelected(new Set(filteredAssets.map(a => a.id)));
  };
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    setCalcResult(null);
  };

  // Derive asset head from loaded assets (read-only, all same)
  const assetHead = assets.length > 0 ? assets[0] : null;

  const handleCalculate = async () => {
    if (selected.size === 0) return toast.error('Select at least one asset');
    setCalcLoading(true);
    try {
      const r = await calculateBulk({ asset_ids: [...selected], depreciation_method: method });
      setCalcResult(r.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Calculation failed');
    } finally { setCalcLoading(false); }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return toast.error('Reason for condemnation is required');
    if (!calcResult) return toast.error('Please calculate first');
    setSubmitting(true);
    try {
      const items = [...selected].map(id => ({
        asset_id: id,
        quantity_condemned: 1,
        date_unserviceable: dateUnsvc || null,
      }));
      const r = await createCondemnation({
        operational_department_id: parseInt(opDeptId),
        funding_head_id: parseInt(fundId),
        depreciation_method: method,
        reason,
        date_unserviceable: dateUnsvc || null,
        items,
      });
      toast.success('Condemnation created successfully');
      nav(`/condemnation/${r.data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create condemnation');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">New Condemnation (CS-49)</h2>
          <p className="text-sm text-gray-500 mt-1">Initiate a formal write-off workflow for end-of-life assets.</p>
        </div>
      </div>

      {/* ── SECTION 1: Department, Fund, Method, Reason ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
        <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">1</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Department &amp; Details</h3>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Operational Department <span className="text-red-500">*</span></label>
              <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 focus:bg-white" value={opDeptId} onChange={e => setOpDeptId(e.target.value)}>
                <option value="">Select Operational Department…</option>
                {opDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Funding Head <span className="text-red-500">*</span></label>
              <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 focus:bg-white" value={fundId} onChange={e => setFundId(e.target.value)}>
                <option value="">Select Funding Head…</option>
                {fundHeads.map(f => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
              </select>
            </div>
          </div>

          {assetHead && (
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-900 shadow-sm">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div>
                <span className="font-semibold text-blue-800">Asset Head (Schedule 4):</span> {assetHead.asset_head_name} &nbsp;<span className="text-blue-300">|</span>&nbsp;
                <span className="font-semibold text-blue-800">Fund:</span> {assetHead.fund_code}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Depreciation Method <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {METHOD_OPTIONS.map(opt => (
                <label key={opt.value} className={`relative flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${method === opt.value ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300 bg-white'}`}>
                  <div className="flex items-center h-5">
                    <input type="radio" name="method" value={opt.value} checked={method === opt.value} onChange={() => { setMethod(opt.value); setCalcResult(null); }} className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-semibold ${method === opt.value ? 'text-indigo-900' : 'text-gray-900'}`}>{opt.label.split('—')[0].trim()}</span>
                    <span className={`text-xs mt-1 ${method === opt.value ? 'text-indigo-700' : 'text-gray-500'}`}>{opt.label.split('—')[1]?.trim()}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for Condemnation <span className="text-red-500">*</span></label>
              <textarea className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 focus:bg-white resize-none shadow-sm" rows={3} placeholder="Provide a detailed justification (e.g. Beyond economic repair due to physical damage or normal wear and tear)…" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date Unserviceable <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 focus:bg-white shadow-sm" value={dateUnsvc} onChange={e => setDateUnsvc(e.target.value)} />
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">If left blank, the system will apply today's date automatically.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Asset Selection Table ── */}
      <div className={`transition-all duration-500 ease-in-out ${opDeptId && fundId ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none hidden'}`}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">2</div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Select Assets
                {selected.size > 0 && <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 normal-case tracking-normal">{selected.size} selected</span>}
              </h3>
            </div>
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                placeholder="Search by name or asset no…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="p-0">
            {assetLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
                <p className="text-sm text-gray-500">Scanning ledger for eligible assets…</p>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-16 text-center px-4">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                <p className="text-base text-gray-600 font-medium">{assets.length === 0 ? 'No eligible assets found' : 'No assets match your search'}</p>
                <p className="text-sm text-gray-400 mt-1">{assets.length === 0 ? 'Make sure the assets are active and belong to this department/fund.' : 'Try adjusting your search criteria.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-200">
                      <th className="px-4 py-3 w-12 text-center">
                        <input type="checkbox" checked={selected.size === filteredAssets.length && filteredAssets.length > 0} onChange={toggleAll} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Asset No.</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name & Details</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Purchased</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Orig. Cost</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Book Value</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Accum. Depr.</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAssets.map(a => (
                      <tr key={a.id} className={`cursor-pointer transition-colors duration-150 ${selected.has(a.id) ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-gray-50'}`} onClick={() => toggle(a.id)}>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer transition-all" />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.asset_number || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{a.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">{a.asset_head_name}</span>
                            {a.machine_no && <span className="text-[11px] text-gray-400">S/N: {a.machine_no}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{a.purchase_date ? formatDate(a.purchase_date) : '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(a.original_cost)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{a.book_value != null ? formatCurrency(a.book_value) : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{a.accum_depreciation != null ? formatCurrency(a.accum_depreciation) : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">{a.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Action Bar for Step 2 */}
            <div className={`px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end transition-all duration-300 ${selected.size > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <button onClick={handleCalculate} disabled={calcLoading || selected.size === 0} className="relative overflow-hidden group bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0">
                <span className="relative z-10 flex items-center gap-2">
                  {calcLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Calculating...</>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      Calculate Valuations
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Calculation Preview ── */}
      {calcResult && (
        <div className="bg-white rounded-2xl shadow-md border border-indigo-100 overflow-hidden transition-all duration-500 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <div className="bg-slate-50/50 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white shadow-sm font-bold text-sm ring-4 ring-indigo-50">3</div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Final Preview</h3>
              </div>
              <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Click any row to view detailed calculation</div>
            </div>
          </div>
          
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Asset Details</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Orig. Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Accum. Depr.</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Book Value</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-indigo-600 uppercase tracking-wider">Condemnation Cost</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calcResult.items.map(c => (
                    <tr key={c.asset_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{c.name}</div>
                        <div className="font-mono text-[11px] text-gray-400 mt-0.5">{c.asset_number || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(c.original_cost)}</td>
                      <td className="px-6 py-4 text-right text-red-600/80 font-medium">-{formatCurrency(c.total_depreciation)}</td>
                      <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(c.condemnation_cost)}</td>
                      <td className="px-6 py-4 text-right font-bold text-indigo-700 text-base">{formatCurrency(c.condemnation_cost)}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => setDetailItem(c)} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 border-t-2 border-gray-200">
                    <td className="px-6 py-4 font-bold text-right text-slate-800 uppercase tracking-wider text-xs">Final Totals</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{formatCurrency(calcResult.totals.total_original_cost)}</td>
                    <td className="px-6 py-4 text-right font-bold text-red-600/80">-{formatCurrency(calcResult.totals.total_depreciation)}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{formatCurrency(calcResult.totals.total_depreciated_value)}</td>
                    <td className="px-6 py-4 text-right font-black text-indigo-700 text-lg">{formatCurrency(calcResult.totals.total_condemnation_cost)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="px-6 py-5 bg-white border-t border-gray-100 flex items-center justify-end gap-4 rounded-b-2xl">
              <button onClick={() => nav('/condemnation')} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || !reason.trim()} className="relative overflow-hidden group bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-[length:200%_auto] text-white font-medium px-8 py-2.5 rounded-lg shadow-lg shadow-indigo-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none">
                <span className="relative z-10 flex items-center gap-2">
                  {submitting ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Submitting...</>) : (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Confirm &amp; Create Condemnation</>)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL BREAKDOWN MODAL ── */}
      {detailItem && (
        <DepreciationBreakdownModal 
          initialData={{
            asset: {
              name: detailItem.name,
              asset_number: detailItem.asset_number,
              purchase_date: detailItem.purchase_date,
              total_cost: detailItem.original_cost,
              category_name: detailItem.asset_head_name,
              wdv_rate: detailItem.wdv_rate_post,
              is_small_value: detailItem.is_small_value,
              accum_depreciation: detailItem.total_depreciation,
              book_value: detailItem.condemnation_cost
            },
            ledgerEntries: (detailItem.yearly_breakdown || []).map(yr => ({
              financial_year: yr.fy_label,
              method: yr.method_used,
              opening_value: yr.opening_value,
              rate_applied: yr.method_used === 'WDV' ? detailItem.wdv_rate_post : detailItem.slm_rate_pre,
              depreciation_amount: yr.depreciation,
              closing_value: yr.closing_value,
              is_fully_depreciated: yr.is_capped || false
            }))
          }}
          onClose={() => setDetailItem(null)} 
        />
      )}
    </div>
  );
}
