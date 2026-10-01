import { useNavigate } from 'react-router-dom';

const LETTERS = [
  {
    id: 'wdv-adoption',
    date: '1906-06-01', // 06.06.2016 — for sort
    dateLabel: '06 June 2016',
    fileNo: 'F. No. 110116/2014-15/AA(I)/KVS/Acctts',
    subject: 'Adoption of "Written Down Value Method" of Depreciation in KVS',
    addressedTo: 'The Deputy Secretary, UT2 Section, MHRD, Govt. of India',
    signatory: 'S. Muthusivam, Deputy Commissioner (Fin)',
    tag: 'Depreciation Policy',
    tagColor: 'indigo',
    path: '/reference/letters/wdv-adoption',
  },
  {
    id: 'small-value-assets',
    date: '2021-12-08', // 08.12.2021 — for sort
    dateLabel: '08 December 2021',
    fileNo: 'F. No. 110116/2014-15/AA(i)/KVS/Acctts',
    subject: 'Providing of 100% depreciation on Small Value Assets',
    addressedTo: 'Deputy Commissioner/Director, All Regional Offices/ZIETs, KVS',
    signatory: 'S.N Gulia, Joint Commissioner (Fin.)',
    tag: 'Small Value Assets',
    tagColor: 'amber',
    path: '/reference/letters/small-value-assets',
  },
];

const TAG_COLORS = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  amber:  'bg-amber-50 text-amber-700 border-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

export default function KVSLettersHub() {
  const nav = useNavigate();
  const sorted = [...LETTERS].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📜</span>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">KVS Official Letters</h2>
        </div>
        <p className="text-sm text-gray-500 ml-11">
          Official correspondence from Kendriya Vidyalaya Sangathan (HQ) regarding accounting, depreciation, and asset management policies.
        </p>
      </div>

      {/* Timeline list */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" aria-hidden="true" />

        <div className="space-y-6">
          {sorted.map((letter, idx) => (
            <div key={letter.id} className="relative flex gap-6 group">
              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0">
                <div className={`w-12 h-12 rounded-full bg-white border-2 border-gray-200 group-hover:border-indigo-400 flex items-center justify-center shadow-sm transition-colors duration-200`}>
                  <span className="text-lg">📄</span>
                </div>
              </div>

              {/* Card */}
              <div
                className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer overflow-hidden group"
                onClick={() => nav(letter.path)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${TAG_COLORS[letter.tagColor]}`}>
                          {letter.tag}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">{letter.fileNo}</span>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {letter.subject}
                      </h3>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-semibold text-slate-700 whitespace-nowrap">{letter.dateLabel}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 px-5 py-2.5 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Click to view full letter</span>
                  <span className="text-xs font-medium text-indigo-600 group-hover:translate-x-1 transition-transform inline-block">
                    View Letter →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-5 py-4 text-sm text-slate-500 flex items-start gap-3">
        <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Letters are arranged in chronological order. New letters will be added as and when issued by KVS (HQ).</span>
      </div>
    </div>
  );
}
