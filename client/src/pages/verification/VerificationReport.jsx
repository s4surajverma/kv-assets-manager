import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getVerificationReport } from '../../api/verification';
import { formatDate } from '../../utils/helpers';

export default function VerificationReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') || 'all';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState(initialType);

  useEffect(() => {
    getVerificationReport(id)
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load verification report'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading report...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Report not found.</div>;

  const { verification: v, items, volumeRanges } = data;
  const consumables = volumeRanges?.filter(r => r.ledger_type === 'CS24A') || [];
  const nonConsumables = volumeRanges?.filter(r => r.ledger_type === 'CS24') || [];

  return (
    <div className="min-h-screen py-4 print:py-0 print:bg-white">
      {/* ════════════ STICKY CONTROL TOOLBAR (no-print) ════════════ */}
      <div className="sticky top-16 z-20 -mt-4 sm:-mt-6 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-3 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs mb-6 no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/verification')}
            className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950 px-2.5 py-1.5 rounded-md hover:bg-slate-200/60 transition-colors"
          >
            ← Back to Verifications
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-bold text-slate-900">
            Physical Verification Folio #{v.id}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
            {v.dept_name || 'DEPARTMENT'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Print Mode Selector */}
          <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setPrintMode('all')}
              className={`px-3 py-1 rounded-md transition-all ${printMode === 'all' ? 'bg-white shadow-2xs text-slate-950' : 'text-slate-600 hover:text-slate-950'}`}
            >
              Full Folio (Both Pages)
            </button>
            <button
              onClick={() => setPrintMode('proforma')}
              className={`px-3 py-1 rounded-md transition-all ${printMode === 'proforma' ? 'bg-white shadow-2xs text-slate-950' : 'text-slate-600 hover:text-slate-950'}`}
            >
              Proforma Only
            </button>
            <button
              onClick={() => setPrintMode('certificate')}
              className={`px-3 py-1 rounded-md transition-all ${printMode === 'certificate' ? 'bg-white shadow-2xs text-slate-950' : 'text-slate-600 hover:text-slate-950'}`}
            >
              Certificate Only
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-black text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5"
          >
            <span>🖨️</span> Print Folio
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          PAGE 1: PHYSICAL VERIFICATION PROFORMA (CS-48)
          ════════════════════════════════════════════════ */}
      <div className={`verification-folio register-folio print-area ${printMode === 'certificate' ? 'hidden print:hidden' : 'block'}`}>
        {/* Header */}
        <div className="register-folio-header flex items-start justify-between">
          <div className="w-36 text-left text-[11px] font-bold text-slate-800 font-mono">
            <div>DEPT: {v.dept_name || '—'}</div>
            <div className="text-[10px] text-slate-600 font-sans mt-0.5">
              DATE: {v.verification_date ? formatDate(v.verification_date) : '—'}
            </div>
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-tight register-heading-hindi">
              {v.kv_name_hi ? `केन्द्रीय विद्यालय, ${v.kv_name_hi}` : 'केन्द्रीय विद्यालय'}
            </h1>
            <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5 font-serif">
              {v.kv_name_en ? `KENDRIYA VIDYALAYA, ${v.kv_name_en}` : 'KENDRIYA VIDYALAYA'}
            </h2>
            <div className="text-[10px] font-semibold text-slate-800 tracking-wider uppercase mt-0.5">
              केन्द्रीय विद्यालय संगठन / KENDRIYA VIDYALAYA SANGATHAN
            </div>
            <p className="text-xs sm:text-sm font-bold mt-1 uppercase text-black font-serif underline tracking-wide">
              वार्षिक भौतिक सत्यापन प्रपत्र / ANNUAL PHYSICAL VERIFICATION PROFORMA
            </p>
          </div>
          <div className="w-36 text-right">
            <span className="register-badge-box">FORM CS-48</span>
            <span className="text-[9px] font-mono text-slate-700 block mt-0.5">KVS ACCOUNTS CODE</span>
          </div>
        </div>

        {/* Proforma Table */}
        <div className="overflow-x-auto mb-4">
          <table className="register-view-table">
            <thead>
              <tr>
                <th className="w-24 text-center">
                  <div>स्टॉक रजिस्टर पृष्ठ सं</div>
                  <div className="text-[7pt] font-normal text-slate-700">Stock Register Vol/Pg</div>
                </th>
                <th className="text-left" style={{minWidth: 180}}>
                  <div>वस्तु का नाम एवं विवरण</div>
                  <div className="text-[7pt] font-normal text-slate-700">Name &amp; Description of Article</div>
                </th>
                <th colSpan="2" className="p-0 text-center">
                  <div className="border-b border-black py-1 font-bold">
                    <div>के अनुसार स्टॉक / Stock as per</div>
                  </div>
                  <div className="grid grid-cols-2">
                    <div className="border-r border-black py-1 font-semibold">
                      <div>स्टॉक पंजी</div>
                      <div className="text-[7pt] font-normal text-slate-700">Stock Reg.</div>
                    </div>
                    <div className="py-1 font-semibold">
                      <div>भौतिक जाँच</div>
                      <div className="text-[7pt] font-normal text-slate-700">Physical Ver.</div>
                    </div>
                  </div>
                </th>
                <th className="w-20 text-center">
                  <div>अतिरिक्त</div>
                  <div className="text-[7pt] font-normal text-slate-700">Excess (+)</div>
                </th>
                <th className="w-20 text-center">
                  <div>अभाव</div>
                  <div className="text-[7pt] font-normal text-slate-700">Shortage (-)</div>
                </th>
                <th className="w-40 text-center">
                  <div>जाँच परिणाम / अभ्युक्ति</div>
                  <div className="text-[7pt] font-normal text-slate-700">Result of Investigation / Remarks</div>
                </th>
              </tr>
              <tr className="col-numbers">
                <th>1</th>
                <th>2</th>
                <th>3</th>
                <th>4</th>
                <th>5</th>
                <th>6</th>
                <th>7</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const stockQty = parseInt(item.stock_qty) || 0;
                const physQty = parseInt(item.physical_qty) || 0;
                const diff = physQty - stockQty;
                let volPageStr = '';
                if (item.stock_volume_no) volPageStr += `V-${item.stock_volume_no} `;
                if (item.stock_page_no) volPageStr += `P-${item.stock_page_no}`;

                return (
                  <tr key={idx} className="h-7">
                    <td className="text-center font-mono text-[7.5pt]">{volPageStr || '—'}</td>
                    <td className="font-medium text-left">{item.asset_name}</td>
                    <td className="text-center font-semibold">{stockQty}</td>
                    <td className="text-center font-semibold">{physQty}</td>
                    <td className="text-center font-bold text-emerald-700">{diff > 0 ? `+${diff}` : '—'}</td>
                    <td className="text-center font-bold text-rose-700">{diff < 0 ? diff : '—'}</td>
                    <td className="text-xs text-left">{item.remarks || '—'}</td>
                  </tr>
                );
              })}
              {/* Fill empty buffer rows to match physical folio stature */}
              {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="empty-ledger-row h-7">
                  <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Proforma Footer Signatures */}
        <div className="register-signature-block break-inside-avoid">
          <div className="register-sig-item">
            <div className="h-10"></div>
            <div className="register-sig-line"></div>
            <div className="font-bold">स्टॉक प्रभारी के हस्ताक्षर</div>
            <div className="text-[10px] text-slate-600">Signature of Stock Custodian</div>
            <div className="text-[10px] font-semibold text-black uppercase mt-0.5">{v.custodian_name || ''}</div>
          </div>
          <div className="register-sig-item">
            <div className="h-10"></div>
            <div className="register-sig-line"></div>
            <div className="font-bold">सत्यापन जाँचकर्ता के हस्ताक्षर</div>
            <div className="text-[10px] text-slate-600">Signature of Stock Checker</div>
            <div className="text-[10px] font-semibold text-black uppercase mt-0.5">{v.verified_by_name || ''}</div>
          </div>
          <div className="register-sig-item">
            <div className="h-10"></div>
            <div className="register-sig-line"></div>
            <div className="font-bold">प्राचार्य के प्रतिहस्ताक्षर एवं मुहर</div>
            <div className="text-[10px] text-slate-600">Countersigned by Principal (with Seal)</div>
          </div>
        </div>

        <div className="text-center mt-3 text-[10px] text-slate-500 font-mono no-print">
          Folio Page 1 of 2
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          PAGE 2: ANNUAL STOCK VERIFICATION CERTIFICATE
          ════════════════════════════════════════════════ */}
      <div className={`verification-folio register-folio print-area ${printMode === 'proforma' ? 'hidden print:hidden' : 'block'} ${printMode === 'all' ? 'break-before-page' : ''}`}>
        {/* Certificate Header */}
        <div className="register-folio-header flex items-start justify-between">
          <div className="w-36 text-left text-[11px] font-bold text-slate-800 font-mono">
            <div>दिनांक / Dated:</div>
            <div className="text-xs text-black font-semibold mt-0.5">
              {v.verification_date ? formatDate(v.verification_date) : '___________________'}
            </div>
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-tight register-heading-hindi">
              {v.kv_name_hi ? `केन्द्रीय विद्यालय, ${v.kv_name_hi}` : 'केन्द्रीय विद्यालय'}
            </h1>
            <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5 font-serif">
              {v.kv_name_en ? `KENDRIYA VIDYALAYA, ${v.kv_name_en}` : 'KENDRIYA VIDYALAYA'}
            </h2>
            <div className="text-[10px] font-semibold text-slate-800 tracking-wider uppercase mt-0.5">
              केन्द्रीय विद्यालय संगठन / KENDRIYA VIDYALAYA SANGATHAN
            </div>
            <p className="text-xs sm:text-sm font-bold mt-1 uppercase text-black font-serif underline tracking-wide">
              वार्षिक स्टॉक जाँच प्रमाण पत्र / ANNUAL STOCK VERIFICATION CERTIFICATE
            </p>
          </div>
          <div className="w-36 text-right">
            <span className="register-badge-box">VERIFICATION CERTIFICATE</span>
            <span className="text-[9px] font-mono text-slate-700 block mt-0.5">STATUTORY FORM</span>
          </div>
        </div>

        {/* Certificate Clauses */}
        <div className="space-y-4 text-justify text-xs sm:text-sm leading-relaxed text-black my-4 px-2">
          <div className="border-l-2 border-slate-400 pl-3">
            <p className="font-serif">
              १. प्रमाणित किया जाता है कि निम्नलिखित जाँचकर्ताओं द्वारा <strong className="underline uppercase">{v.dept_name || '________________________'}</strong> विभाग का स्टॉक रजिस्टर के साथ व्यक्तिगत रूप से सत्यापन किया गया ।
            </p>
            <p className="font-serif italic text-slate-800 mt-1">
              1. Certified that we, the stock verification committee, have physically checked the stock of <strong className="underline uppercase">{v.dept_name || '________________________'}</strong> department against the official stock registers.
            </p>
          </div>

          <div className="border-l-2 border-slate-400 pl-3">
            <p className="font-serif">
              २. प्रमाणित किया जाता है कि संलग्न सूची में दर्शाई गई वस्तुओं को छोड़कर शेष सभी वस्तुएँ अच्छी स्थिति में हैं तथा स्टॉक रजिस्टर में दर्ज सभी वस्तुएँ भौतिक रूप से उपस्थित हैं ।
            </p>
            <p className="font-serif italic text-slate-800 mt-1">
              2. We certify that all articles, excepting those indicated in the attached list, are in good serviceable condition and all entered items are physically present in the school stock.
            </p>
          </div>

          <div className="border-l-2 border-slate-400 pl-3">
            <p className="font-serif">
              ३. स्टॉक में पाई गई कमियों अथवा आधिक्य का विस्तृत विवरण प्रपत्र में संलग्न किया गया है तथा प्राचार्य महोदय द्वारा स्टॉक रजिस्टर की सभी प्रविष्टियों का सत्यापन एवं प्रमाणीकरण किया गया है ।
            </p>
            <p className="font-serif italic text-slate-800 mt-1">
              3. Full details of any shortages or excesses have been recorded in the proforma and all corresponding entries in the stock register have been attested by the Principal.
            </p>
          </div>
        </div>

        {/* Register Volume Summary Table */}
        <div className="overflow-x-auto my-5">
          <table className="register-view-table">
            <thead>
              <tr>
                <th className="w-1/2 text-left">
                  <div>स्टॉक रजिस्टर विवरण / REGISTER TYPE</div>
                </th>
                <th className="w-1/2 text-left">
                  <div>सत्यापित फोलियो पृष्ठ विस्तार / CERTIFIED FOLIO PAGE RANGE</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Consumables (CS24A) */}
              {consumables.length > 0 ? consumables.map((c, idx) => (
                <tr key={`con-${idx}`}>
                  <td className="font-semibold">उपभोज्य स्टॉक रजिस्टर / CONSUMABLES (VOL - {c.volume_no})</td>
                  <td>
                    पृष्ठ <strong className="underline font-mono px-2">{c.start_page}</strong> से <strong className="underline font-mono px-2">{c.end_page}</strong> तक (From Page {c.start_page} to {c.end_page})
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="font-semibold">उपभोज्य स्टॉक रजिस्टर / CONSUMABLES (CS-24A)</td>
                  <td className="text-slate-600">पृष्ठ ________________ से ________________ तक</td>
                </tr>
              )}

              {/* Non-Consumables (CS24) */}
              {nonConsumables.length > 0 ? nonConsumables.map((nc, idx) => (
                <tr key={`noncon-${idx}`}>
                  <td className="font-semibold">अनुपभोज्य स्टॉक रजिस्टर / NON-CONSUMABLES (VOL - {nc.volume_no})</td>
                  <td>
                    पृष्ठ <strong className="underline font-mono px-2">{nc.start_page}</strong> से <strong className="underline font-mono px-2">{nc.end_page}</strong> तक (From Page {nc.start_page} to {nc.end_page})
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="font-semibold">अनुपभोज्य स्टॉक रजिस्टर / NON-CONSUMABLES (CS-24)</td>
                  <td className="text-slate-600">पृष्ठ ________________ से ________________ तक</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures on Certificate */}
        <div className="mt-8 border-t border-black pt-4">
          <div className="font-bold text-xs uppercase tracking-wide text-black mb-4">
            जाँच समिति के हस्ताक्षर / SIGNATURES OF VERIFICATION COMMITTEE:
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8 text-center">
            <div className="border border-black p-3 rounded">
              <div className="h-10"></div>
              <div className="border-t border-dotted border-black pt-1">
                <div className="font-semibold text-xs">१. जाँचकर्ता / Checker 1</div>
                <div className="text-[10px] text-slate-600">(Name &amp; Designation)</div>
              </div>
            </div>
            <div className="border border-black p-3 rounded">
              <div className="h-10"></div>
              <div className="border-t border-dotted border-black pt-1">
                <div className="font-semibold text-xs">२. जाँचकर्ता / Checker 2</div>
                <div className="text-[10px] text-slate-600">(Name &amp; Designation)</div>
              </div>
            </div>
            <div className="border border-black p-3 rounded">
              <div className="h-10"></div>
              <div className="border-t border-dotted border-black pt-1">
                <div className="font-semibold text-xs">३. जाँचकर्ता / Checker 3</div>
                <div className="text-[10px] text-slate-600">(Name &amp; Designation)</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end pt-4">
            <div className="text-center w-64 border border-black p-4 rounded">
              <div className="h-10"></div>
              <div className="border-t border-dotted border-black pt-1">
                <div className="font-bold text-xs">विभागीय प्रभारी के हस्ताक्षर</div>
                <div className="text-[10px] text-slate-600">Signature of Dept. In-Charge</div>
                <div className="text-xs font-bold text-black uppercase mt-1">{v.custodian_name || ''}</div>
              </div>
            </div>

            <div className="text-center w-72 border-2 border-black p-4 rounded bg-slate-50/50">
              <div className="h-10"></div>
              <div className="border-t border-black pt-1">
                <div className="font-bold text-sm">प्राचार्य के हस्ताक्षर एवं मुहर</div>
                <div className="text-[10px] text-slate-600 uppercase font-medium">Signature of Principal with Office Seal</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-3 text-[10px] text-slate-500 font-mono no-print">
          Folio Page 2 of 2
        </div>
      </div>
    </div>
  );
}
