import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../utils/permissionHelper';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileSpreadsheet,
  Layers,
  TrendingDown,
  CheckCircle2,
  Trash2,
  FileSignature,
  Truck,
  FileText,
  ArrowLeftRight,
  ShieldCheck,
  Scroll,
  School,
  Calculator,
  Calendar,
  AlertTriangle,
  X
} from 'lucide-react';

const MENU_GROUPS = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
    ]
  },
  {
    title: 'Setup & Master Data',
    items: [
      { to: '/setup/profile', label: 'Vidyalaya Profile', icon: School, module: 'departments', adminOnly: true },
      { to: '/departments', label: 'Departments', icon: Layers, module: 'departments' },
      { to: '/users', label: 'Users & Roles', icon: Users, module: 'users' },
      { to: '/financial-years', label: 'Financial Years', icon: Calendar, module: 'assets', adminOnly: true },
      { to: '/setup/opening-balance', label: 'Opening Balances', icon: Calculator, module: 'assets', adminOnly: true },
    ]
  },
  {
    title: 'Registers & Inward',
    items: [
      { to: '/stock', label: 'Stock Register (CS-24)', icon: FileSpreadsheet, module: 'stock' },
      { to: '/assets', label: 'Asset Register (GFR-22)', icon: Building2, module: 'assets' },
      { to: '/transitions', label: 'Stock Charge Transfer', icon: ArrowLeftRight, module: 'transitions', adminOnly: true },
    ]
  },
  {
    title: 'Verification & Depreciation',
    items: [
      { to: '/verification', label: 'Physical Verification', icon: CheckCircle2, module: 'verification' },
      { to: '/depreciation', label: 'Depreciation Engine', icon: TrendingDown, module: 'depreciation' },
    ]
  },
  {
    title: 'Condemnation & Disposal',
    items: [
      { to: '/condemnation', label: 'Condemnation (CS-49)', icon: Trash2, module: 'condemnation' },
      { to: '/sanctions', label: 'Sanction Orders', icon: FileSignature, module: 'sanctions' },
      { to: '/disposal', label: 'Asset Disposal', icon: Truck, module: 'disposal' },
    ]
  },
  {
    title: 'Compliance & Reports',
    items: [
      { to: '/schedule4', label: 'Schedule 4 Report', icon: FileText, module: 'schedule4' },
      { to: '/audit', label: 'Audit Trail', icon: ShieldCheck, module: 'audit' },
      { to: '/reference/letters', label: 'KVS References', icon: Scroll, module: 'depreciation', adminOnly: true },
    ]
  }
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  // Close drawer on mobile when route changes
  useEffect(() => {
    if (onClose) onClose();
  }, [location.pathname]);

  const isVisible = (item) => {
    if (user?.isSuperAdmin) {
      return item.to === '/' || item.to === '/reference/letters';
    }
    if (item.sysAdminOnly && user?.vidyalaya_id !== 1) return false;
    if (item.adminOnly && !user?.roles?.includes('Admin')) return false;
    return canAccess(user?.roles, item.module);
  };

  return (
    <>
      {/* ── Mobile Backdrop Blur Overlay (gayatri-computers inspired) ── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden no-print transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Responsive Sidebar Drawer ── */}
      <aside
        className={`w-64 bg-slate-900 border-r border-slate-800 h-screen fixed left-0 top-0 flex flex-col justify-between z-50 lg:z-30 no-print font-sans transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl shadow-slate-950/80' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* ── Brand Header with Mobile Close Button ── */}
        <div className="p-4 border-b border-slate-800/90 flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 mt-0.5">
              <School className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs font-bold tracking-tight text-white leading-snug break-words" title={user?.isSuperAdmin ? 'KVS HQ Admin' : (user?.kv_name_en || 'KVS Asset Portal')}>
                {user?.isSuperAdmin ? 'KVS HQ Admin' : (user?.kv_name_en || 'KVS Asset Portal')}
              </h1>
              <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
                {user?.kv_code ? `KV Code: ${user.kv_code}` : 'Asset Management Portal'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0 mt-0.5"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Grouped Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {MENU_GROUPS.map((group) => {
            const visibleItems = group.items.filter(isVisible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {group.title}
                </p>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => onClose && onClose()}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`w-4 h-4 transition-colors ${
                              isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

      {/* ── Footer Vidyalaya Tenant Card ── */}
      <div className="p-3.5 border-t border-slate-800/90 bg-slate-950/60">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="overflow-hidden pr-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow shrink-0" />
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.isSuperAdmin ? 'HQ Administration' : user?.kv_name_en || 'Kendriya Vidyalaya'}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              KV Code: {user?.kv_code || 'SYSTEM'}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-400 shrink-0">
            {user?.roles?.[0] || 'User'}
          </span>
        </div>
      </div>
    </aside>
  </>
);
}
