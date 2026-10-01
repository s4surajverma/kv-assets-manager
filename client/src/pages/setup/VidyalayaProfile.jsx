import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  School,
  Save,
  RefreshCw,
  Info
} from 'lucide-react';
import { getMyVidyalaya, updateMyVidyalaya } from '../../api/vidyalaya';
import { useAuth } from '../../context/AuthContext';
import DangerZone from './DangerZone';

export default function VidyalayaProfile() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vidData, setVidData] = useState(null);

  const [formData, setFormData] = useState({
    kv_code: '',
    kv_name_en: '',
    kv_name_hi: '',
    regional_office_en: '',
    regional_office_hi: ''
  });

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await getMyVidyalaya();
      const data = res.data || res;
      setVidData(data);
      setFormData({
        kv_code: data.kv_code || '',
        kv_name_en: data.kv_name_en || '',
        kv_name_hi: data.kv_name_hi || '',
        regional_office_en: data.regional_office_en || '',
        regional_office_hi: data.regional_office_hi || ''
      });

      // Synchronize active session if DB has updated Vidyalaya identity
      if (updateUser && (data.kv_name_en !== user?.kv_name_en || data.kv_code !== user?.kv_code)) {
        updateUser({
          kv_code: data.kv_code,
          kv_name_en: data.kv_name_en,
          kv_name_hi: data.kv_name_hi,
          regional_office_en: data.regional_office_en,
          regional_office_hi: data.regional_office_hi
        });
      }
    } catch (err) {
      console.error('Failed to load Vidyalaya profile:', err);
      toast.error('Could not load Vidyalaya details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.kv_name_en.trim()) {
      return toast.error('Vidyalaya Name in English is required');
    }
    if (!formData.kv_code.trim()) {
      return toast.error('KV Code is required');
    }

    try {
      setSaving(true);
      const res = await updateMyVidyalaya(formData);
      const updated = res.data || res;
      setVidData(updated);

      // Update Auth Context & local storage so header, sidebar, dashboard update immediately
      if (updateUser) {
        updateUser({
          kv_code: updated.kv_code,
          kv_name_en: updated.kv_name_en,
          kv_name_hi: updated.kv_name_hi,
          regional_office_en: updated.regional_office_en,
          regional_office_hi: updated.regional_office_hi
        });
      }

      toast.success('Vidyalaya profile updated successfully');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to update Vidyalaya profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] space-y-3">
        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
        <p className="text-xs font-medium text-slate-500">Loading Vidyalaya profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans animate-fade-in">
      {/* ── Minimalist Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/70">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <School className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Vidyalaya Profile
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
              KV Code: {formData.kv_code || '—'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Official institutional identity stamped across registers, ledgers, and statutory reports.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadProfile}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Reload from server"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Refined Settings Card ── */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 sm:p-8 space-y-5">
          {/* Row 1: English & Hindi Vidyalaya Names */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Kendriya Vidyalaya Name (English) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="kv_name_en"
                value={formData.kv_name_en}
                onChange={handleChange}
                placeholder="e.g. Kendriya Vidyalaya No. 1 Delhi Cantt"
                className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-600 transition-all duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Kendriya Vidyalaya Name (Hindi) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="kv_name_hi"
                value={formData.kv_name_hi}
                onChange={handleChange}
                placeholder="e.g. केन्द्रीय विद्यालय क्र. 1 दिल्ली कैंट"
                className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-600 transition-all duration-150"
              />
            </div>
          </div>

          {/* Row 2: KV Code, Regional Office (English), Regional Office (Hindi) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                KV Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="kv_code"
                value={formData.kv_code}
                onChange={handleChange}
                placeholder="e.g. 1123"
                className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-600 transition-all duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Regional Office (English) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="regional_office_en"
                value={formData.regional_office_en}
                onChange={handleChange}
                placeholder="e.g. Delhi"
                className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-600 transition-all duration-150"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Regional Office (Hindi) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="regional_office_hi"
                value={formData.regional_office_hi}
                onChange={handleChange}
                placeholder="e.g. दिल्ली"
                className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-600 transition-all duration-150"
              />
            </div>
          </div>
        </div>

        {/* Footer info & single primary action */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Changes reflect immediately in navigation, reports, and registers.</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Details...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Vidyalaya Profile</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Danger Zone Section ── */}
      {user?.roles?.includes('Admin') && (
        <div className="pt-2">
          <DangerZone />
        </div>
      )}
    </div>
  );
}
