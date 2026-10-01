import { Loader2, Inbox } from 'lucide-react';

export default function DataTable({ columns, data, loading, emptyMessage = 'No records found.' }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Loading Data Records...
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl border border-slate-200/90 shadow-xs text-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Inbox className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700">{emptyMessage}</p>
        <p className="text-xs text-slate-400 mt-1">There are no records matching your current filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : {}}
                  className={`px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {data.map((row, i) => (
              <tr
                key={row.id || i}
                className="hover:bg-slate-50/80 transition-colors duration-150"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-slate-700 font-medium ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {col.render ? col.render(row[col.key], row, i) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
