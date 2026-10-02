import { useState, useEffect } from 'react';
import { getVidyalayas, updateVidyalaya } from '../../api/vidyalaya';
import DataTable from '../../components/DataTable';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import { getCategories, updateCategory } from '../../api/masters';

export default function SystemConfig() {
  const [vidyalayas, setVidyalayas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('vidyalayas'); // 'vidyalayas' | 'categories'
  const [showModal, setShowModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editCatData, setEditCatData] = useState(null);
  const { user } = useAuth();

  const [formData, setFormData] = useState({ kv_code: '', kv_name_en: '', kv_name_hi: '', regional_office_en: '', regional_office_hi: '', status: 'APPROVED', is_active: true });
  const [catFormData, setCatFormData] = useState({ wdv_rate: '', slm_rate_pre_2011: '', slm_rate_post_2011: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'vidyalayas') {
        const r = await getVidyalayas();
        setVidyalayas(r || []);
      } else {
        const r = await getCategories();
        setCategories(r.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const handleOpen = (data) => {
    if (!data) return;
    setEditData(data);
    setFormData({
      kv_code: data.kv_code,
      kv_name_en: data.kv_name_en,
      kv_name_hi: data.kv_name_hi,
      regional_office_en: data.regional_office_en,
      regional_office_hi: data.regional_office_hi,
      status: data.status,
      is_active: data.is_active,
      admin_name: data.admin_name || '',
      admin_email: data.admin_email || '',
      admin_emp_code: data.admin_emp_code || ''
    });
    setShowModal(true);
  };

  const handleQuickApprove = async (row) => {
    try {
      await updateVidyalaya(row.id, { status: 'APPROVED', is_active: true });
      toast.success(`${row.kv_name_en} (${row.kv_code}) approved!`);
      fetchData();
    } catch {
      // toast error handled via interceptor
    }
  };

  const handleQuickReject = async (row) => {
    if (!window.confirm(`Are you sure you want to reject registration for ${row.kv_name_en} (${row.kv_code})?`)) return;
    try {
      await updateVidyalaya(row.id, { status: 'REJECTED', is_active: false });
      toast.success(`${row.kv_name_en} registration rejected.`);
      fetchData();
    } catch {
      // toast error handled via interceptor
    }
  };

  const handleOpenCat = (data) => {
    if (!data) return;
    setEditCatData(data);
    setCatFormData({ wdv_rate: data.wdv_rate, slm_rate_pre_2011: data.slm_rate_pre_2011 || '', slm_rate_post_2011: data.slm_rate_post_2011 || '' });
    setShowCatModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editData) {
        await updateVidyalaya(editData.id, formData);
        toast.success('Vidyalaya updated');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {}
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editCatData) {
        await updateCategory(editCatData.id, {
          wdv_rate: parseFloat(catFormData.wdv_rate) || 0,
          slm_rate_pre_2011: catFormData.slm_rate_pre_2011 ? parseFloat(catFormData.slm_rate_pre_2011) : null,
          slm_rate_post_2011: catFormData.slm_rate_post_2011 ? parseFloat(catFormData.slm_rate_post_2011) : null,
        });
        toast.success('Asset rules updated globally');
      }
      setShowCatModal(false);
      fetchData();
    } catch (err) {}
  };

  const columns = [
    { key: 'id', label: 'ID', width: '50px' },
    { key: 'kv_code', label: 'KV Code' },
    { key: 'kv_name_en', label: 'KV Name (EN)' },
    { key: 'regional_office_en', label: 'RO' },
    {
      key: 'admin',
      label: 'Admin / Applicant',
      render: (_, row) => (
        row.admin_name ? (
          <div>
            <div className="text-xs font-semibold text-slate-800">{row.admin_name}</div>
            <div className="text-[11px] text-slate-500">{row.admin_email || row.admin_emp_code}</div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">None</span>
        )
      )
    },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
    { key: 'is_active', label: 'Active', render: (val) => val ? 'Yes' : 'No' },
    { key: 'user_count', label: 'Users' },
    {
      key: 'actions', label: 'Actions', render: (_, row) => (
        <div className="flex items-center gap-1.5">
          {row.status === 'PENDING' && (
            <>
              <button
                type="button"
                onClick={() => handleQuickApprove(row)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                title="Approve Vidyalaya"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleQuickReject(row)}
                className="px-2 py-1 text-xs font-medium rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                title="Reject Vidyalaya"
              >
                Reject
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => handleOpen(row)}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1.5 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            Review
          </button>
        </div>
      )
    }
  ];

  const catColumns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Category Name' },
    { key: 'wdv_rate', label: 'WDV Rate', render: (val) => val ? `${(val * 100).toFixed(2)}%` : '-' },
    { key: 'slm_rate_pre_2011', label: 'SLM (Pre 2011)', render: (val) => val ? `${(val * 100).toFixed(2)}%` : '-' },
    { key: 'slm_rate_post_2011', label: 'SLM (Post 2011)', render: (val) => val ? `${(val * 100).toFixed(2)}%` : '-' },
    {
      key: 'actions', label: 'Actions', render: (_, row) => (
        <button onClick={() => handleOpenCat(row)} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
      )
    }
  ];

  if (!user?.isSuperAdmin) {
    return <div className="p-4 text-red-600">Access Denied: Administrative privileges required.</div>;
  }

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-4">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'vidyalayas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('vidyalayas')}
        >
          Vidyalaya Approvals
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'categories' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('categories')}
        >
          Global Asset Rules
        </button>
      </div>

      {activeTab === 'vidyalayas' ? (
        <DataTable columns={columns} data={vidyalayas} loading={loading} emptyMessage="No Vidyalayas found." />
      ) : (
        <DataTable columns={catColumns} data={categories} loading={loading} emptyMessage="No asset categories found." />
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Review Vidyalaya Registration</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editData?.admin_name && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="font-semibold text-slate-700">Applicant / Administrator Details</div>
                  <div className="text-slate-600"><span className="text-slate-400">Name:</span> {editData.admin_name}</div>
                  <div className="text-slate-600"><span className="text-slate-400">Email:</span> {editData.admin_email}</div>
                  {editData.admin_emp_code && <div className="text-slate-600"><span className="text-slate-400">Login ID:</span> {editData.admin_emp_code}</div>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KV Code</label>
                <input required type="text" value={formData.kv_code} disabled
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KV Name (English)</label>
                <input required type="text" value={formData.kv_name_en} disabled
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KV Name (Hindi)</label>
                <input required type="text" value={formData.kv_name_hi} disabled
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regional Office (English)</label>
                <input required type="text" value={formData.regional_office_en} disabled
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regional Office (Hindi)</label>
                <input required type="text" value={formData.regional_office_hi} disabled
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 cursor-not-allowed" />
              </div>
              
              {editData && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => {
                        const newStatus = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          status: newStatus,
                          is_active: newStatus === 'APPROVED' ? true : (newStatus === 'REJECTED' ? false : prev.is_active)
                        }));
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mt-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                      Is Active
                    </label>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-1">Edit Asset Rule</h3>
            <p className="text-sm text-gray-500 mb-4">{editCatData?.name}</p>
            <form onSubmit={handleCatSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WDV Rate (e.g. 0.20 for 20%)</label>
                <input required type="number" step="0.0001" min="0" max="1" value={catFormData.wdv_rate} onChange={e => setCatFormData({...catFormData, wdv_rate: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SLM Rate Pre-2011 (e.g. 0.1621)</label>
                <input type="number" step="0.0001" min="0" max="1" value={catFormData.slm_rate_pre_2011} onChange={e => setCatFormData({...catFormData, slm_rate_pre_2011: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SLM Rate Post-2011 (e.g. 0.20)</label>
                <input type="number" step="0.0001" min="0" max="1" value={catFormData.slm_rate_post_2011} onChange={e => setCatFormData({...catFormData, slm_rate_post_2011: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>

              <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded mt-2">
                <strong>Warning:</strong> Changing these rules modifies depreciation logic globally across all KVS regions.
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Save Rules</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
