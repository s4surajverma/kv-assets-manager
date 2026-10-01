import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../api/masters';
import { formatCurrency } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import SystemConfig from './audit/SystemConfig';
import {
  Boxes,
  IndianRupee,
  TrendingDown,
  AlertTriangle,
  Clock,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
  Trash2,
  ArrowUpRight
} from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.isSuperAdmin) {
      setLoading(false);
      return;
    }
    getDashboard()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (user?.isSuperAdmin) {
    return <SystemConfig />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-slate-500">Loading overview...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md mx-auto my-12">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-800">Unable to load dashboard data</h3>
        <p className="text-xs text-slate-500 mt-1">Please check server connectivity and try again.</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Active Assets',
      value: (data.total_assets || 0).toLocaleString('en-IN'),
      detail: 'In service & deployed',
      icon: Boxes,
      color: 'text-blue-600',
      bgLight: 'bg-blue-50',
      link: '/assets',
    },
    {
      label: 'Total Asset Value',
      value: formatCurrency(data.total_value || 0),
      detail: 'Acquisition cost',
      icon: IndianRupee,
      color: 'text-emerald-600',
      bgLight: 'bg-emerald-50',
      link: '/assets',
    },
    {
      label: 'Depreciation (This FY)',
      value: formatCurrency(data.depreciation_this_year || 0),
      detail: 'Schedule 4 computed',
      icon: TrendingDown,
      color: 'text-purple-600',
      bgLight: 'bg-purple-50',
      link: '/depreciation',
    },
    {
      label: 'Pending Condemnations',
      value: data.pending_condemnations || 0,
      detail: 'Awaiting sanction',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgLight: 'bg-amber-50',
      alert: (data.pending_condemnations || 0) > 0,
      link: '/condemnation',
    },
    {
      label: 'Pending Verifications',
      value: (data.pending_verifications ?? data.overdue_verifications) || 0,
      detail: 'In progress / review',
      icon: CheckCircle2,
      color: 'text-indigo-600',
      bgLight: 'bg-indigo-50',
      alert: ((data.pending_verifications ?? data.overdue_verifications) || 0) > 0,
      link: '/verification',
    },
  ];

  const quickLinks = [
    {
      title: 'Stock Register (CS-24)',
      description: 'Record newly procured items, issues, and departmental inward balances',
      icon: FileSpreadsheet,
      to: '/stock',
      iconColor: 'text-blue-600',
      bg: 'bg-blue-50 group-hover:bg-blue-600 group-hover:text-white',
    },
    {
      title: 'Asset Register (GFR-22)',
      description: 'Search tagged capital assets, room locations, and serial numbers',
      icon: Building2,
      to: '/assets',
      iconColor: 'text-indigo-600',
      bg: 'bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white',
    },
    {
      title: 'Physical Verification',
      description: 'Annual board verification certificates, reconciliation, and audit logs',
      icon: CheckCircle2,
      to: '/verification',
      iconColor: 'text-emerald-600',
      bg: 'bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white',
    },
    {
      title: 'Condemnation (CS-49)',
      description: 'Submit condemnation proposals, survey reports, and disposal orders',
      icon: Trash2,
      to: '/condemnation',
      iconColor: 'text-amber-600',
      bg: 'bg-amber-50 group-hover:bg-amber-600 group-hover:text-white',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* ── Clean Executive Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {user?.kv_name_en ? `${user.kv_name_en} (${user.kv_code ? `KV Code: ${user.kv_code}` : 'KV'})` : 'Institutional Overview'} • Welcome back, {user?.name || 'Administrator'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/stock"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Stock Inward</span>
          </Link>
        </div>
      </div>

      {/* ── Key Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.link}
              className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-md transition-all duration-150 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3 min-h-[2.5rem]">
                  <span
                    className="text-[11px] font-bold text-slate-500 uppercase tracking-wide leading-tight whitespace-normal"
                    title={card.label}
                  >
                    {card.label}
                  </span>
                  <div className={`w-8 h-8 rounded-xl ${card.bgLight} flex items-center justify-center ${card.color} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2
                    className={`text-xl sm:text-2xl font-black tracking-tight ${card.alert ? 'text-rose-600' : 'text-slate-900'}`}
                    title={typeof card.value === 'string' ? card.value : undefined}
                  >
                    {card.value}
                  </h2>
                  {card.alert && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                      Action
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate" title={card.detail}>{card.detail}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Primary Registers & Modules ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Primary Registers & Operations
          </h2>
          <span className="text-xs text-slate-400">Quick module access</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                to={item.to}
                className="group p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-md transition-all duration-150 flex items-start justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-2xl ${item.bg} flex items-center justify-center transition-colors duration-150 shrink-0`}>
                    <Icon className={`w-5 h-5 ${item.iconColor} group-hover:text-white transition-colors`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md">
                      {item.description}
                    </p>
                  </div>
                </div>

                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 mt-1" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
