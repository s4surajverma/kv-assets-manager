import { useState, useRef, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../api/auth';
import { current } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  User,
  KeyRound,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Calendar,
  X,
  Loader2,
  Lock,
  School,
  Menu
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const profileMenuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    setPwdLoading(true);
    try {
      await changePassword(pwdForm);
      toast.success('Password updated successfully');
      setShowPwd(false);
      setPwdForm({ currentPassword: '', newPassword: '' });
    } catch {
      // API error handled via interceptor
    } finally {
      setPwdLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'KV';
    const parts = name.split(' ');
    return parts.length > 1 
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans print:block print:min-h-0 print:h-auto print:bg-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64 ml-0 flex-1 flex flex-col min-w-0 print:block print:h-auto print:w-full print:min-w-0">
        {/* ── Elevated Topbar (Mobile-optimized with glassmorphism) ── */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 flex items-center justify-between no-print shadow-xs">
          {/* Left: Mobile Drawer Trigger + Vidyalaya Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2">
            {/* Hamburger Button (Mobile Only) */}
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight truncate max-w-[170px] sm:max-w-none" title={user?.isSuperAdmin ? 'HQ Central Administration' : user?.kv_name_en}>
                {user?.isSuperAdmin ? 'HQ Central Administration' : user?.kv_name_en}
              </span>
              {!user?.isSuperAdmin && user?.kv_code && (
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-medium whitespace-nowrap shrink-0">
                  KV Code: {user.kv_code}
                </span>
              )}
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-glow" />
              <span>Online</span>
            </div>
          </div>

          {/* Right Controls & Profile */}
          <div className="flex items-center gap-3">
            {/* Financial Year Tag */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              <span>FY {current()}</span>
            </div>

            {/* User Profile Pill & Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full hover:bg-slate-100/90 border border-slate-200/80 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  {getInitials(user?.name)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                    {user?.name || 'Administrator'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight truncate max-w-[130px]">
                    {user?.roles?.join(', ') || 'User'}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Profile Popover Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 p-2 z-50 animate-fade-in">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50 rounded-xl mb-1">
                    <p className="text-xs font-bold text-slate-800">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email || 'No email configured'}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[11px] font-semibold text-blue-600">
                        {user?.employee_code || user?.roles?.[0]}
                      </span>
                    </div>
                  </div>

                  {user?.roles?.includes('Admin') && (
                    <Link
                      to="/setup/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <School className="w-4 h-4 text-indigo-600" />
                      <span>Vidyalaya Profile</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowPwd(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-slate-500" />
                    <span>Change Password</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mt-0.5"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Main Workspace ── */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 print:p-0 print:m-0 print:bg-white print:block print:h-auto print:w-full bg-slate-50/80">
          <Outlet />
        </main>
      </div>

      {/* ── Redesigned Change Password Modal ── */}
      {showPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
                  <p className="text-xs text-slate-500">Ensure a strong password of at least 6 characters</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPwd(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePwdSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    required
                    type="password"
                    placeholder="Enter existing password"
                    value={pwdForm.currentPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password (min 6 characters)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    required
                    minLength={6}
                    type="password"
                    placeholder="Enter new password"
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPwd(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  {pwdLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
