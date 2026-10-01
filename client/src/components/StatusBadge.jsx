const STATUS_CONFIG = {
  ACTIVE: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500 animate-pulse-glow' },
  APPROVED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  COMPLETED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  GOOD: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
  RECEIPT: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },

  PENDING: { bg: 'bg-amber-50 text-amber-700 border-amber-200/80', dot: 'bg-amber-500' },
  UNDER_VERIFICATION: { bg: 'bg-amber-50 text-amber-800 border-amber-200/80', dot: 'bg-amber-500 animate-pulse-glow' },
  IN_PROGRESS: { bg: 'bg-blue-50 text-blue-700 border-blue-200/80', dot: 'bg-blue-500 animate-pulse-glow' },
  BOARD_REVIEWED: { bg: 'bg-blue-50 text-blue-700 border-blue-200/80', dot: 'bg-blue-500' },
  RETURN: { bg: 'bg-blue-50 text-blue-700 border-blue-200/80', dot: 'bg-blue-500' },

  SANCTIONED: { bg: 'bg-purple-50 text-purple-700 border-purple-200/80', dot: 'bg-purple-500' },
  TRANSFERRED: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', dot: 'bg-indigo-500' },
  
  CONDEMNED: { bg: 'bg-orange-50 text-orange-700 border-orange-200/80', dot: 'bg-orange-500' },
  ISSUE: { bg: 'bg-orange-50 text-orange-700 border-orange-200/80', dot: 'bg-orange-500' },
  DAMAGED: { bg: 'bg-orange-50 text-orange-700 border-orange-200/80', dot: 'bg-orange-500' },
  OBSOLETE: { bg: 'bg-amber-50 text-amber-700 border-amber-200/80', dot: 'bg-amber-500' },

  REJECTED: { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  CANCELLED: { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  MISSING: { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
  DISCREPANCIES_FOUND: { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500 animate-pulse-glow' },
  WRITE_OFF: { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },

  DISPOSED: { bg: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  OPENING: { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  ADJUSTMENT: { bg: 'bg-yellow-50 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  DRAFT: { bg: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{status?.replace(/_/g, ' ') || 'Unknown'}</span>
    </span>
  );
}
