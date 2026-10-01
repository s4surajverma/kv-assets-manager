import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resetAllData, deleteAccount } from '../../api/vidyalaya';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  X,
  CheckCircle,
  Loader2,
  ShieldAlert
} from 'lucide-react';

// ── Shared Modal Component ──────────────────────────────────────────
function ConfirmModal({ open, onClose, title, icon: Icon, iconBadgeClass, children, confirmLabel, confirmButtonClass, onConfirm, loading }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in" 
        onClick={!loading ? onClose : undefined} 
      />

      {/* Modal Card */}
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBadgeClass}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          {!loading && (
            <button 
              type="button"
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer ${confirmButtonClass}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Password Field ──────────────────────────────────────────────────
function PasswordField({ value, onChange, placeholder = 'Enter your password', disabled }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:opacity-50 transition-all"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Main Danger Zone Component ──────────────────────────────────────
export default function DangerZone() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Reset All Data state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPwd, setResetPwd] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  // Delete Account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ── Reset handler ──
  const handleReset = async () => {
    if (!resetPwd.trim()) return toast.error('Please enter your password');
    setResetting(true);
    try {
      const res = await resetAllData(resetPwd);
      const data = res.data || res;
      setResetResult(data);
      setResetOpen(false);
      setResetPwd('');
      toast.success(data.message || 'Factory reset complete');
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Reset failed';
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  };

  // ── Delete handler ──
  const handleDelete = async () => {
    if (!deletePwd.trim()) return toast.error('Please enter your password');
    if (deletePhrase !== 'DELETE MY ACCOUNT') {
      return toast.error('Please type "DELETE MY ACCOUNT" exactly');
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePwd, deletePhrase);
      toast.success('Account deleted. Redirecting to login...');
      setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Delete failed';
      toast.error(msg);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Reset Result Feedback Banner */}
      {resetResult && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 animate-fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-900">{resetResult.message}</p>
              {resetResult.summary && (
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 bg-white/70 p-3 rounded-lg border border-emerald-100">
                  {Object.entries(resetResult.summary)
                    .filter(([, count]) => count > 0)
                    .map(([table, count]) => (
                      <div key={table} className="flex justify-between text-[11px]">
                        <span className="text-slate-600 font-mono capitalize">{table.replace(/_/g, ' ')}</span>
                        <span className="text-emerald-700 font-bold">{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setResetResult(null)}
              className="text-xs text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Danger Zone Card Container ── */}
      <div className="bg-white rounded-xl border border-rose-200/90 shadow-xs overflow-hidden">
        {/* Danger Header */}
        <div className="px-6 py-4 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200/60">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Danger Zone</h2>
              <p className="text-xs text-slate-500">
                Irreversible institutional operations. Proceed with extreme caution.
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Reset All Data */}
        <div className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Reset All Data</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Perform a factory reset of your Vidyalaya. This permanently wipes all stock entries, assets, 
                depreciation records, condemnation entries, sanctions, disposals, verifications, departments, 
                locations, suppliers, and audit logs.
              </p>

              {/* Preserved items tags */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-medium text-slate-500 mr-1">What will be preserved:</span>
                {['Vidyalaya Profile', 'Users & Roles', 'Login Credentials'].map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="shrink-0 sm:self-center">
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100/80 active:scale-[0.98] text-amber-800 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Section 2: Delete Account */}
        <div className="p-6 sm:p-7 bg-rose-50/20">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Delete Account</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Permanently delete this Vidyalaya and all associated data, including all users, stock registers, 
                assets, and institutional configuration. This action is completely irreversible.
              </p>

              {/* High-Contrast Caution Box */}
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-950 font-medium leading-relaxed">
                  <strong className="text-rose-700 font-semibold">Caution:</strong> Only the primary administrator (the user who registered this Vidyalaya) can delete the account. All user accounts will be permanently removed and logged out immediately.
                </p>
              </div>
            </div>

            <div className="shrink-0 sm:self-center">
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reset Confirmation Modal ── */}
      <ConfirmModal
        open={resetOpen}
        onClose={() => { setResetOpen(false); setResetPwd(''); }}
        title="Factory Reset Vidyalaya"
        icon={RotateCcw}
        iconBadgeClass="bg-amber-100 text-amber-700"
        confirmLabel="Reset All Data"
        confirmButtonClass="bg-amber-600 hover:bg-amber-700"
        onConfirm={handleReset}
        loading={resetting}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-950 font-medium leading-relaxed">
                This will permanently erase <strong className="font-semibold text-amber-800">all operational registers</strong> including 
                stock, assets, depreciation, condemnation entries, and masters.
                Your Vidyalaya profile and administrative login credentials will be preserved.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">
              Enter your password to confirm
            </label>
            <PasswordField
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              disabled={resetting}
            />
          </div>
        </div>
      </ConfirmModal>

      {/* ── Delete Account Confirmation Modal ── */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeletePwd(''); setDeletePhrase(''); }}
        title="Permanently Delete Vidyalaya"
        icon={Trash2}
        iconBadgeClass="bg-rose-100 text-rose-700"
        confirmLabel="Permanently Delete"
        confirmButtonClass="bg-rose-600 hover:bg-rose-700"
        onConfirm={handleDelete}
        loading={deleting}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-950 font-medium leading-relaxed">
                This will <strong className="font-semibold text-rose-800">permanently delete this entire Vidyalaya</strong>, all associated users, registers, and records. All sessions will terminate immediately.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">
              Type <code className="px-1.5 py-0.5 rounded bg-slate-100 text-rose-600 font-mono text-xs font-semibold">DELETE MY ACCOUNT</code> to confirm
            </label>
            <input
              type="text"
              value={deletePhrase}
              onChange={(e) => setDeletePhrase(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              disabled={deleting}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 text-slate-900 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 disabled:opacity-50 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">
              Enter your administrator password
            </label>
            <PasswordField
              value={deletePwd}
              onChange={(e) => setDeletePwd(e.target.value)}
              disabled={deleting}
            />
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
