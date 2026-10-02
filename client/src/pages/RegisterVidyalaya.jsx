import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerVidyalaya } from '../api/auth';
import toast from 'react-hot-toast';
import {
  Building2,
  School,
  User,
  Mail,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  Clock,
  ShieldAlert
} from 'lucide-react';

export default function RegisterVidyalaya() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [formData, setFormData] = useState({
    kv_code: '',
    kv_name_en: '',
    kv_name_hi: '',
    regional_office_en: '',
    regional_office_hi: '',
    admin_name: '',
    admin_email: '',
    admin_emp_code: '',
    admin_password: '',
    confirm_password: ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.admin_password !== formData.confirm_password) {
      return toast.error('Passwords do not match');
    }
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        admin_emp_code: `KV.${formData.kv_code}`
      };
      await registerVidyalaya(payload);
      toast.success('Registration submitted! Awaiting Super Administrator approval.', { duration: 6000 });
      setSubmittedData({
        kv_code: formData.kv_code,
        kv_name_en: formData.kv_name_en,
        kv_name_hi: formData.kv_name_hi,
        regional_office_en: formData.regional_office_en,
        admin_name: formData.admin_name,
        admin_email: formData.admin_email,
        login_id: `KV.${formData.kv_code}`
      });
    } catch {
      // Error handled via interceptor
    } finally {
      setLoading(false);
    }
  };

  if (submittedData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 font-sans py-12 px-4 sm:px-6">
        <div className="w-full max-w-lg bg-slate-900/95 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-slate-100 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/10">
            <Clock className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending Super Admin Authorization
          </span>

          <h2 className="text-2xl font-bold text-white mb-2">Registration Submitted!</h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-6">
            Your registration application for <strong className="text-white">{submittedData.kv_name_en}</strong> has been received. You will be able to log in once a Super Administrator reviews and approves this institution.
          </p>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-left mb-6 space-y-2.5 text-xs">
            <div className="flex justify-between pb-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">KV Code:</span>
              <span className="font-semibold text-slate-200">{submittedData.kv_code}</span>
            </div>
            <div className="flex justify-between pb-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Assigned Admin Login ID:</span>
              <span className="font-mono font-semibold text-blue-400">{submittedData.login_id}</span>
            </div>
            <div className="flex justify-between pb-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Primary Administrator:</span>
              <span className="font-semibold text-slate-200">{submittedData.admin_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Regional Office:</span>
              <span className="font-semibold text-slate-200">{submittedData.regional_office_en}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Please keep your credentials secure. If you attempt to log in before authorization is granted, the portal will report that your registration is pending approval.
          </p>

          <Link
            to="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/25 active:scale-[0.99]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Portal Login</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 font-sans py-12 px-4 sm:px-6">
      <div className="w-full max-w-3xl animate-fade-in">
        {/* Top Return Link */}
        <div className="mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal Login</span>
          </Link>
        </div>

        {/* Elevated Registration Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-slate-100">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <School className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Register Vidyalaya
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set up your Vidyalaya instance and administrative credentials
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 mt-7">
            {/* Step 1: Vidyalaya Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Vidyalaya Details & Identity</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    KV Code (Assigned Institutional Code)
                  </label>
                  <input
                    required
                    type="text"
                    name="kv_code"
                    value={formData.kv_code}
                    onChange={handleChange}
                    placeholder="e.g. 1001 or 2242"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    KV Name (in English)
                  </label>
                  <input
                    required
                    type="text"
                    name="kv_name_en"
                    value={formData.kv_name_en}
                    onChange={handleChange}
                    placeholder="e.g. KV IIT Kanpur"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    KV Name (in Hindi)
                  </label>
                  <input
                    required
                    type="text"
                    name="kv_name_hi"
                    value={formData.kv_name_hi}
                    onChange={handleChange}
                    placeholder="e.g. केन्द्रीय विद्यालय आईआईटी कानपुर"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Regional Office (in English)
                  </label>
                  <input
                    required
                    type="text"
                    name="regional_office_en"
                    value={formData.regional_office_en}
                    onChange={handleChange}
                    placeholder="e.g. Lucknow / Patna"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Regional Office (in Hindi)
                  </label>
                  <input
                    required
                    type="text"
                    name="regional_office_hi"
                    value={formData.regional_office_hi}
                    onChange={handleChange}
                    placeholder="e.g. लखनऊ / पटना"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Administrator Account */}
            <div className="space-y-4 pt-6 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Designated Vidyalaya Administrator Account</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Admin Full Name
                  </label>
                  <input
                    required
                    type="text"
                    name="admin_name"
                    value={formData.admin_name}
                    onChange={handleChange}
                    placeholder="e.g. Principal / Stock Officer"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Admin Email Address
                  </label>
                  <input
                    required
                    type="email"
                    name="admin_email"
                    value={formData.admin_email}
                    onChange={handleChange}
                    placeholder="principal.kvs@gov.in"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Assigned Admin Login ID
                  </label>
                  <input
                    readOnly
                    type="text"
                    value={formData.kv_code ? `KV.${formData.kv_code}` : 'Auto-computed from KV Code'}
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-blue-400 font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password (min 6 characters)
                  </label>
                  <input
                    required
                    minLength={6}
                    type="password"
                    name="admin_password"
                    value={formData.admin_password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    required
                    minLength={6}
                    type="password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-500 text-center sm:text-left">
                Upon submission, your Vidyalaya will be queued for authorization.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-7 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Vidyalaya Registration</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
