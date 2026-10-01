import { useState, useEffect } from 'react';
import { getAssetHistory } from '../api/depreciation';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function DepreciationBreakdownModal({ assetId, onClose, initialData = null }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (!initialData && assetId) {
      setLoading(true);
      getAssetHistory(assetId)
        .then(r => setData(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [assetId, initialData]);

  if (!assetId && !initialData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Depreciation Breakdown</h3>
              {loading ? (
                <div className="h-4 w-32 bg-gray-100 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-sm text-gray-500 mt-0.5">
                  {data?.asset?.name} <span className="font-mono text-xs text-gray-400">({data?.asset?.asset_number})</span>
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm text-gray-500 font-medium tracking-wide">Fetching historical records...</p>
            </div>
          ) : (
            <>
              {/* Asset Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Date</div>
                  <div className="text-sm font-bold text-slate-800 mt-1">{formatDate(data.asset.purchase_date)}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Original Cost</div>
                  <div className="text-sm font-bold text-slate-800 mt-1">{formatCurrency(data.asset.total_cost)}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</div>
                  <div className="text-sm font-bold text-slate-800 mt-1 truncate">{data.asset.category_name}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rate (WDV)</div>
                  <div className="text-sm font-bold text-slate-800 mt-1">{(data.asset.wdv_rate * 100).toFixed(1)}%</div>
                </div>
              </div>

              {/* Small Value Notice */}
              {data.asset.is_small_value && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 shadow-sm">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div>
                    <span className="font-bold">Small Value Asset Detected</span> — Cost ≤ ₹2,000. 
                    As per KVS Circular, 100% depreciation is applied in the first year.
                  </div>
                </div>
              )}

              {/* Year-by-Year Table */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Historical Depreciation Schedule</h4>
                  <span className="text-[10px] text-slate-400 font-medium italic">Residual value fixed at 5% of original cost</span>
                </div>
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200">
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">FY</th>
                        <th className="px-5 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Method</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Opening</th>
                        <th className="px-5 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Formula</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold text-red-500 uppercase tracking-wider">Depreciation</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Closing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(data.ledgerEntries || []).map((yr, idx) => {
                        const rate = (yr.rate_applied * 100).toFixed(1) + '%';
                        const formula = `${formatCurrency(yr.opening_value)} × ${rate}`;
                        const isCapped = yr.depreciation_amount < (yr.opening_value * yr.rate_applied - 1); // Simple check for rounding/cap

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-5 py-3.5 font-bold text-slate-700 whitespace-nowrap">{yr.financial_year}</td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border ${yr.method === 'WDV' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                {yr.method}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-medium text-slate-800 font-mono text-xs">{formatCurrency(yr.opening_value)}</td>
                            <td className="px-5 py-3.5 text-center text-[11px] text-slate-400 font-mono italic">{formula}</td>
                            <td className="px-5 py-3.5 text-right font-bold text-red-600 font-mono text-xs">
                              -{formatCurrency(yr.depreciation_amount)}
                              {yr.is_fully_depreciated && <span className="block text-[8px] text-red-400 mt-0.5 uppercase tracking-tighter">95% Cap Hit</span>}
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-emerald-700 font-mono text-xs">{formatCurrency(yr.closing_value)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Final Summary Banner */}
              <div className="bg-slate-900 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="grid grid-cols-3 gap-6 relative z-10">
                  <div className="text-center border-r border-slate-700/50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Accumulated</div>
                    <div className="text-xl font-black text-white">{formatCurrency(data.asset.accum_depreciation)}</div>
                  </div>
                  <div className="text-center border-r border-slate-700/50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Book Value</div>
                    <div className="text-xl font-black text-emerald-400">{formatCurrency(data.asset.book_value)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Asset Status</div>
                    <div className="text-lg font-black text-white flex items-center justify-center gap-2">
                      {data.asset.book_value <= (data.asset.total_cost * 0.051) ? 'Written Off' : 'Active'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-tight">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            System Generated Calculation Engine v2.1
          </div>
          <button onClick={onClose} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors">
            Close View
          </button>
        </div>
      </div>
    </div>
  );
}
