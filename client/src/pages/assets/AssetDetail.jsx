import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAsset } from '../../api/assets';
import { getAssetTimeline } from '../../api/nonConsumable';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function AssetDetail() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAsset(id),
      getAssetTimeline(id).catch(() => ({ data: { data: [] } }))
    ])
    .then(([assetRes, timelineRes]) => {
      setAsset(assetRes.data);
      setTimeline(timelineRes.data.data || timelineRes.data || []);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (!asset) return <div className="text-sm text-red-500">Asset not found.</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Asset: {asset.asset_number}</h2>
        <StatusBadge status={asset.status} />
      </div>

      <div className="form-section">
        <p className="form-section-title">Details</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            ['Name', asset.name], ['Category', asset.category_name], ['Department', asset.dept_code],
            ['Funding Head', asset.fund_code], ['Purchase Date', formatDate(asset.purchase_date)],
            ['Machine No.', asset.machine_no], ['Total Units', asset.total_units],
            ['Total Cost', formatCurrency(asset.total_cost)], ['Book Value', formatCurrency(asset.book_value)],
            ['Accum. Depreciation', formatCurrency(asset.accum_depreciation)],
            ['Small Value', asset.is_small_value ? 'Yes (100% depreciated)' : 'No'],
          ].map(([l, v]) => (
            <div key={l} className="flex"><span className="text-gray-500 w-40 shrink-0">{l}:</span><span className="font-medium">{v || '—'}</span></div>
          ))}
        </div>
      </div>

      {/* Depreciation History */}
      {asset.depreciation_history?.length > 0 && (
        <div className="form-section">
          <p className="form-section-title">Depreciation History</p>
          <div className="overflow-x-auto border rounded">
            <table className="w-full register-table">
              <thead><tr>
                {['FY','Method','Rate','Opening','Depr. Amt','Closing','Accum. Depr','Fully Depr.'].map(h => <th key={h}>{h}</th>)}
              </tr></thead>
              <tbody>
                {asset.depreciation_history.map((d) => (
                  <tr key={d.financial_year}>
                    <td>{d.financial_year}</td><td>{d.method}</td><td>{(d.rate_applied*100).toFixed(1)}%</td>
                    <td>{formatCurrency(d.opening_value)}</td><td>{formatCurrency(d.depreciation_amount)}</td>
                    <td>{formatCurrency(d.closing_value)}</td><td>{formatCurrency(d.accum_depreciation)}</td>
                    <td>{d.is_fully_depreciated ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Condemnation */}
      {asset.condemnation && (
        <div className="form-section">
          <p className="form-section-title">Condemnation (CS-49)</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {[
              ['Status', asset.condemnation.status], ['Reason', asset.condemnation.reason],
              ['Original Cost', formatCurrency(asset.condemnation.original_cost)],
              ['Total Depreciation', formatCurrency(asset.condemnation.total_depreciation)],
              ['Condemnation Cost', formatCurrency(asset.condemnation.condemnation_cost)],
            ].map(([l,v]) => (
              <div key={l} className="flex"><span className="text-gray-500 w-40 shrink-0">{l}:</span><span className="font-medium">{v||'—'}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* Custody Movement Timeline */}
      {timeline.length > 0 && (
        <div className="form-section">
          <p className="form-section-title">Custody History</p>
          <div className="overflow-x-auto border rounded">
            <table className="w-full register-table">
              <thead><tr>
                <th>Date</th><th>Issue No</th><th>Target</th><th>Purpose</th><th>Qty Issued</th><th>Status</th><th>Returned On</th>
              </tr></thead>
              <tbody>
                {timeline.map((t) => (
                  <tr key={t.item_id}>
                    <td>{formatDate(t.issue_date)}</td>
                    <td className="font-mono text-xs">{t.issue_no}</td>
                    <td>{t.target_name_snapshot}</td>
                    <td className="max-w-[200px] truncate" title={t.purpose}>{t.purpose}</td>
                    <td>{t.quantity_issued} {t.movement_asset_type === 'BULK' ? '(Bulk)' : ''}</td>
                    <td>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        t.status === 'ISSUED' ? 'bg-amber-100 text-amber-800' :
                        t.status === 'RETURNED' ? 'bg-emerald-100 text-emerald-800' :
                        t.status === 'PARTIALLY_RETURNED' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.returned_at ? formatDate(t.returned_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link to="/assets" className="text-sm text-blue-600 hover:underline">← Back to Assets</Link>
    </div>
  );
}
