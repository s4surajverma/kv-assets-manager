import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCondemnation, checkCondemnation, boardReview, rejectCondemnation } from '../../api/condemnation';
import StatusBadge from '../../components/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function CondemnationDetail() {
  const { id } = useParams(); const { user, hasRole } = useAuth();
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true);

  const load = () => { getCondemnation(id).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(load, [id]);

  const doCertify = async () => {
    try { await checkCondemnation(id, { cert_info_correct: true, cert_normal_wear: true, cert_board_report: true }); toast.success('Certified'); load(); } catch {}
  };
  const doBoardReview = async () => {
    const dt = window.prompt('Enter board review date (YYYY-MM-DD):');
    if (!dt) return;
    try { await boardReview(id, { board_date: dt }); toast.success('Board reviewed'); load(); } catch {}
  };
  const doReject = async () => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;
    if (!window.confirm('Reject this condemnation? All assets will revert to ACTIVE status.')) return;
    try { await rejectCondemnation(id, { reason }); toast.success('Condemnation rejected — assets reverted to ACTIVE'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Rejection failed'); }
  };

  const exportToExcel = async () => {
    if (!data) return;
    const d = data;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'KVS Asset Management';
    const ws = wb.addWorksheet('CS-49', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true } });

    // Column widths (9 columns matching the CS-49 table)
    ws.columns = [
      { width: 6 },   // Sl.No.
      { width: 28 },  // Name of article
      { width: 18 },  // Stock Register
      { width: 12 },  // Quantity
      { width: 16 },  // Total Cost
      { width: 14 },  // Date of Purchase
      { width: 14 },  // Life fixed
      { width: 20 },  // Date unserviceable
      { width: 22 },  // Reason
    ];

    const COLS = 9;
    const headerBlue = { argb: 'FF1E3A5F' };
    const colBg = { argb: 'FFE8EEF7' };
    const borderThin = { style: 'thin', color: { argb: 'FFB0BFCC' } };
    const allBorders = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin };
    const medBorder = { style: 'medium', color: { argb: 'FF1E3A5F' } };

    const merge = (r1, c1, r2, c2) => ws.mergeCells(r1, c1, r2, c2);
    const setRow = (rowNum, values) => { const row = ws.getRow(rowNum); values.forEach((v, i) => { row.getCell(i + 1).value = v; }); return row; };

    // ── Row 1: CS-49 label (right-aligned)
    merge(1, 1, 1, COLS);
    const r1 = ws.getRow(1);
    r1.getCell(1).value = 'CS-49';
    r1.getCell(1).alignment = { horizontal: 'right' };
    r1.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF555555' } };
    r1.height = 16;

    // ── Row 2: KV Name
    merge(2, 1, 2, COLS);
    const r2 = ws.getRow(2);
    r2.getCell(1).value = `KENDRIYA VIDYALAYA, ${(d.kv_name_en || '').toUpperCase()}`;
    r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r2.getCell(1).font = { bold: true, size: 13, color: headerBlue };
    r2.height = 22;

    // ── Row 3: Subtitle
    merge(3, 1, 3, COLS);
    const r3 = ws.getRow(3);
    const methodLabel = d.depreciation_method === 'BOTH' ? 'Dual-Rate (SLM & WDV)' :
                        d.depreciation_method === 'SLM_PRE_2011' ? 'Straight Line Method (SLM)' :
                        d.depreciation_method === 'WDV_POST_2011' ? 'Written Down Value (WDV)' : d.depreciation_method;
    r3.getCell(1).value = `LIST OF ARTICLES RECOMMENDED FOR WRITE OFF UNDER THE HEAD ${(d.dept_name || '').toUpperCase()} NON-CONSUMABLE (${d.fund_code || ''}) | Method: ${methodLabel}`;
    r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    r3.getCell(1).font = { size: 9, color: headerBlue };
    r3.height = 24;

    // ── Row 4: spacer
    ws.getRow(4).height = 6;

    // ── Row 5 & 6: Table header
    const thValues = ['Sl.No.', 'Name of the article\n(Rate of the article)', 'Quantity\ndamaged/broken', 'Total cost of\ndamaged/broken\narticles', 'Date of\npurchase', 'Life fixed\nby K.V.S.', 'Date when it became\nunserviceable or\ndate of breakage', 'Reason for\ncondemnation', 'Stock Register\n(Vol. No. / Page No.)'];
    const r5 = ws.getRow(5);
    thValues.forEach((v, i) => {
      const cell = r5.getCell(i + 1);
      cell.value = v;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { bold: true, size: 8.5, color: headerBlue };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: colBg };
      cell.border = allBorders;
    });
    r5.height = 44;

    // ── Row 6: Column numbers
    const r6 = ws.getRow(6);
    [1,2,3,4,5,6,7,8,9].forEach((n, i) => {
      const cell = r6.getCell(i + 1);
      cell.value = n;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { size: 8, color: { argb: 'FF666666' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: colBg };
      cell.border = allBorders;
    });
    r6.height = 14;

    // ── Row 7: Data row
    const r7 = ws.getRow(7);
    const lifeStr = d.life_fixed_by_kvs ? `${d.life_fixed_by_kvs} years` : (d.life_period_years ? `${d.life_period_years} years` : '—');
    const articleLabel = [d.asset_name, d.machine_no ? `M/C: ${d.machine_no}` : null, d.article_rate ? `Rate: ₹${parseFloat(d.article_rate).toLocaleString('en-IN')}` : null].filter(Boolean).join('\n');
    const stockLabel = (d.stock_volume_no || d.stock_page_no) ? `Vol. ${d.stock_volume_no ?? '—'}\nPg. ${d.stock_page_no ?? '—'}` : '—';
    const dataValues = [
      1,
      articleLabel,
      d.quantity_condemned,
      d.original_cost,
      d.purchase_date ? formatDate(d.purchase_date) : '—',
      lifeStr,
      d.date_unserviceable ? formatDate(d.date_unserviceable) : '—',
      d.reason || '—',
      stockLabel,
    ];
    dataValues.forEach((v, i) => {
      const cell = r7.getCell(i + 1);
      cell.value = v;
      // col indices: 0=SlNo, 1=Name, 2=Qty, 3=TotalCost, 4=PurchDate, 5=Life, 6=DateUnsvc, 7=Reason, 8=StockReg
      cell.alignment = { horizontal: i === 0 || i === 2 || i === 4 || i === 5 || i === 6 || i === 8 ? 'center' : (i === 3 ? 'right' : 'left'), vertical: 'middle', wrapText: true };
      cell.font = { size: 9, ...(i === 1 ? { bold: true } : {}) };
      cell.border = allBorders;
      if (i === 3) cell.numFmt = '₹#,##0.00';
    });
    r7.height = 36;

    // ── Row 8: TOTAL row
    merge(8, 1, 8, 3);
    const r8 = ws.getRow(8);
    r8.getCell(1).value = 'TOTAL';
    r8.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    r8.getCell(1).font = { bold: true, size: 9, color: headerBlue };
    r8.getCell(1).border = allBorders;
    r8.getCell(4).value = d.original_cost;
    r8.getCell(4).numFmt = '₹#,##0.00';
    r8.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    r8.getCell(4).font = { bold: true, size: 9, color: headerBlue };
    r8.getCell(4).border = allBorders;
    [2,3].forEach(c => { r8.getCell(c).border = allBorders; });
    [5,6,7,8,9].forEach(c => { r8.getCell(c).border = allBorders; });
    r8.height = 18;

    // ── Row 9: spacer
    ws.getRow(9).height = 8;

    // ── Rows 10-11: Depreciation summary (2-column layout)
    const deprRows = [
      ['Total Depreciation:', d.total_depreciation, 'Depreciation (95% Cap):', d.cap_95_value],
      ['Condemnation Cost:', d.condemnation_cost, 'Depreciated Value:', d.depreciated_value],
    ];
    deprRows.forEach((vals, ri) => {
      const rowNum = 10 + ri;
      merge(rowNum, 1, rowNum, 2);
      merge(rowNum, 3, rowNum, 4);
      merge(rowNum, 6, rowNum, 7);
      merge(rowNum, 8, rowNum, 9);
      const row = ws.getRow(rowNum);
      row.getCell(1).value = vals[0];
      row.getCell(1).font = { size: 9 };
      row.getCell(3).value = vals[1];
      row.getCell(3).numFmt = '₹#,##0.00';
      row.getCell(3).font = { bold: true, size: 9, color: headerBlue };
      row.getCell(6).value = vals[2];
      row.getCell(6).font = { size: 9 };
      row.getCell(8).value = vals[3];
      row.getCell(8).numFmt = '₹#,##0.00';
      row.getCell(8).font = { bold: true, size: 9, color: headerBlue };
      row.height = 16;
    });

    // ── Row 13: Note
    merge(13, 1, 14, COLS);
    const r13 = ws.getRow(13);
    const methodText = d.depreciation_method === 'BOTH'
      ? `Dual-Rate Method — SLM at ${((d.slm_rate_pre||0)*100).toFixed(2)}% p.a. for the period prior to March 2011, and WDV at ${((d.wdv_rate_post||0)*100).toFixed(2)}% p.a. for the period from April 2011 onwards`
      : d.depreciation_method === 'SLM_PRE_2011'
        ? `Straight Line Method (SLM) at ${((d.slm_rate_pre||0)*100).toFixed(2)}% p.a.`
        : `Written Down Value (WDV) at ${((d.wdv_rate_post||0)*100).toFixed(2)}% p.a.`;
    r13.getCell(1).value = `Note: Depreciation has been calculated using the ${methodText}, as per the transition approved by the Board of Governors of KVS. Maximum depreciation is capped at 95% of the original cost, retaining 5% as residual value.`;
    r13.getCell(1).font = { italic: true, size: 8, color: { argb: 'FF444444' } };
    r13.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    r13.height = 28;

    // ── Row 15: Divider + Certificate title
    merge(15, 1, 15, COLS);
    const r15 = ws.getRow(15);
    r15.getCell(1).value = 'प्रमाण-पत्र / CERTIFICATE';
    r15.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r15.getCell(1).font = { bold: true, size: 11, color: headerBlue };
    r15.getCell(1).border = { top: { style: 'medium', color: headerBlue } };
    r15.height = 22;

    // ── Rows 16-18: Certificate items
    const certItems = [
      '1. Certified that the information given in columns 2 to 8 is correct.',
      '2. Certified that the articles mentioned in columns (2)(3) were rendered unserviceable only on account of normal wear and tear and there had been no case of wilful breakage/breakage due to negligence of an official, which requires fixation of responsibility.',
      '3. The report of the Condemnation Board is enclosed.',
    ];
    certItems.forEach((text, i) => {
      const rowNum = 16 + i;
      merge(rowNum, 1, rowNum, COLS);
      const row = ws.getRow(rowNum);
      row.getCell(1).value = `${d[['cert_info_correct','cert_normal_wear','cert_board_report'][i]] ? '✓' : '☐'} ${text}`;
      row.getCell(1).font = { size: 8.5 };
      row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      row.height = i === 1 ? 28 : 18;
    });

    // ── Row 20: Signatures header
    ws.getRow(20).height = 10;
    merge(21, 1, 21, COLS);
    const r21 = ws.getRow(21);
    r21.getCell(1).value = '1. Name & Signature of the Stock Incharge';
    r21.getCell(1).font = { bold: true, size: 9, color: headerBlue };
    r21.height = 16;

    merge(22, 1, 22, 3);
    const r22 = ws.getRow(22);
    r22.getCell(1).value = d.stock_incharge_name || '..........................';
    r22.getCell(1).font = { size: 9 };
    if (d.stock_incharge_designation) {
      merge(23, 1, 23, 3);
      ws.getRow(23).getCell(1).value = d.stock_incharge_designation;
      ws.getRow(23).getCell(1).font = { size: 8, color: { argb: 'FF666666' } };
    }

    const r25 = ws.getRow(25);
    r25.getCell(1).value = '2. Name & Signature of the Checkers (Condemnation Board)';
    r25.getCell(1).font = { bold: true, size: 9, color: headerBlue };
    merge(25, 1, 25, COLS);
    r25.height = 16;

    ['1. ............................................................',
     '2. ............................................................',
     '3. ............................................................'].forEach((line, i) => {
      const rowNum = 27 + i * 2;
      merge(rowNum, 1, rowNum, 5);
      const row = ws.getRow(rowNum);
      row.getCell(1).value = line;
      row.getCell(1).font = { size: 9, color: { argb: 'FFaaaaaa' } };
      if (i === 1) {
        merge(rowNum, 7, rowNum, COLS);
        row.getCell(7).value = 'PRINCIPAL';
        row.getCell(7).font = { bold: true, size: 9, color: headerBlue };
        row.getCell(7).alignment = { horizontal: 'right' };
      }
      row.height = 20;
    });

    if (d.board_date) {
      const r34 = ws.getRow(34);
      r34.getCell(1).value = `Board Review Date: ${formatDate(d.board_date)}`;
      r34.getCell(1).font = { size: 9 };
    }

    // ── Export
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CS49_Condemnation_${d.id}_${(d.asset_name || '').replace(/\s+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!data) return <p className="text-sm text-red-500">Not found.</p>;

  // ── NEW: multi-asset master record ───────────────────────────────────────
  if (data.type === 'master') {
    const m = data;
    const items = m.items || [];
    const assetHead = items[0]?.asset_head_name || '';

    const exportMasterToExcel = async () => {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'KVS Asset Management';
      const ws = wb.addWorksheet('CS-49', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true } });
      const COLS = 9;
      const headerBlue = { argb: 'FF1D4ED8' };
      const allBorders = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      const merge = (r1,c1,r2,c2) => ws.mergeCells(r1,c1,r2,c2);
      ws.columns = [14,32,10,16,14,10,20,20,18].map(w=>({width:w}));

      // Row 1: CS-49 label
      merge(1,1,1,COLS); ws.getRow(1).getCell(1).value = 'CS-49';
      ws.getRow(1).getCell(1).alignment = { horizontal:'right' };
      ws.getRow(1).getCell(1).font = { bold:true, size:9 };

      // Row 2: KV Name
      merge(2,1,2,COLS); ws.getRow(2).getCell(1).value = m.kv_name_en;
      ws.getRow(2).getCell(1).alignment = { horizontal:'center' };
      ws.getRow(2).getCell(1).font = { bold:true, size:11 };

      // Row 3: Subtitle
      merge(3,1,3,COLS);
      ws.getRow(3).getCell(1).value = `LIST OF ARTICLES RECOMMENDED FOR WRITE OFF UNDER THE HEAD ${assetHead.toUpperCase()} NON-CONSUMABLE (${m.fund_code})`;
      ws.getRow(3).getCell(1).alignment = { horizontal:'center', wrapText:true };
      ws.getRow(3).getCell(1).font = { italic:true, size:9 };
      ws.getRow(3).height = 24;

      // Row 4: Meta
      merge(4,1,4,COLS);
      const methodLabel = m.depreciation_method === 'BOTH' ? 'Dual-Rate (SLM & WDV)' :
                          m.depreciation_method === 'SLM' ? 'Straight Line Method (SLM)' :
                          m.depreciation_method === 'WDV' ? 'Written Down Value (WDV)' : m.depreciation_method;
      ws.getRow(4).getCell(1).value = `Operational Department: ${m.operational_department_name}   |   Financial Year: ${m.financial_year}   |   Method: ${methodLabel}`;
      ws.getRow(4).getCell(1).alignment = { horizontal:'center' };
      ws.getRow(4).getCell(1).font = { size:8 };

      // Row 5 spacer
      ws.getRow(5).height = 4;

      // Row 6: Column headers
      const thValues = ['Sl.No.','Name of the article\n(Rate of the article)','Qty damaged/\nbroken','Total cost of\ndamaged/broken\narticles','Date of\npurchase','Life fixed\nby K.V.S.','Date when it became\nunserviceable','Reason for\ncondemnation','Stock Register\n(Vol. No. / Page No.)'];
      const r6 = ws.getRow(6);
      thValues.forEach((v,i) => {
        const cell = r6.getCell(i+1);
        cell.value = v; cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        cell.font = { bold:true, size:8, color:{argb:'FFFFFFFF'} };
        cell.fill = { type:'pattern', pattern:'solid', fgColor: headerBlue };
        cell.border = allBorders;
      });
      r6.height = 36;

      // Row 7: Column numbers
      const r7 = ws.getRow(7);
      for (let i=1;i<=COLS;i++) {
        r7.getCell(i).value = i;
        r7.getCell(i).alignment = { horizontal:'center' };
        r7.getCell(i).font = { size:8, color:{argb:'FFFFFFFF'} };
        r7.getCell(i).fill = { type:'pattern', pattern:'solid', fgColor: headerBlue };
        r7.getCell(i).border = allBorders;
      }

      // Rows 8+: Data rows
      let rowNum = 8;
      items.forEach((item, idx) => {
        const lifeStr = item.life_fixed_by_kvs ? `${item.life_fixed_by_kvs} yrs` : '—';
        const dateUnsvc = item.date_unserviceable || m.date_unserviceable;
        const stockStr = (item.stock_volume_no || item.stock_page_no)
          ? `Vol.${item.stock_volume_no ?? '—'} / Pg.${item.stock_page_no ?? '—'}` : '—';
        const vals = [
          idx+1,
          item.article_rate ? `${item.asset_name}\nRate: ₹${parseFloat(item.article_rate).toLocaleString('en-IN')}` : item.asset_name,
          item.quantity_condemned,
          item.original_cost,
          item.purchase_date ? formatDate(item.purchase_date) : '—',
          lifeStr,
          dateUnsvc ? formatDate(dateUnsvc) : '—',
          m.reason,
          stockStr,
        ];
        const r = ws.getRow(rowNum);
        vals.forEach((v, i) => {
          const cell = r.getCell(i+1);
          cell.value = v;
          cell.alignment = { horizontal: i===0||i===2||i===4||i===5||i===6||i===8?'center':(i===3?'right':'left'), vertical:'middle', wrapText:true };
          cell.font = { size:9, ...(i===1?{bold:true}:{}) };
          cell.border = allBorders;
          if (i===3) cell.numFmt = '₹#,##0.00';
        });
        r.height = 36;
        rowNum++;
      });

      // TOTAL row
      merge(rowNum,1,rowNum,3);
      const rTotal = ws.getRow(rowNum);
      rTotal.getCell(1).value = 'TOTAL';
      rTotal.getCell(1).alignment = { horizontal:'right', vertical:'middle' };
      rTotal.getCell(1).font = { bold:true, size:9, color:headerBlue };
      rTotal.getCell(1).border = allBorders;
      rTotal.getCell(4).value = m.total_original_cost;
      rTotal.getCell(4).numFmt = '₹#,##0.00';
      rTotal.getCell(4).alignment = { horizontal:'right', vertical:'middle' };
      rTotal.getCell(4).font = { bold:true, size:9, color:headerBlue };
      rTotal.getCell(4).border = allBorders;
      [2,3,5,6,7,8,9].forEach(c => { rTotal.getCell(c).border = allBorders; });
      rTotal.height = 18;
      rowNum++;

      // Totals summary
      rowNum++;
      const summaryRows = [
        ['Total Original Cost:', m.total_original_cost, 'Total Condemnation Cost:', m.total_condemnation_cost],
        ['Total Depreciation:', m.total_depreciation,   'Total Depreciated Value:', m.total_depreciated_value],
      ];
      summaryRows.forEach(([l1,v1,l2,v2]) => {
        merge(rowNum,1,rowNum,2); merge(rowNum,3,rowNum,4);
        merge(rowNum,6,rowNum,7); merge(rowNum,8,rowNum,9);
        const r = ws.getRow(rowNum);
        r.getCell(1).value = l1; r.getCell(1).font = {size:9};
        r.getCell(3).value = v1; r.getCell(3).numFmt = '₹#,##0.00'; r.getCell(3).font = {bold:true,size:9,color:headerBlue};
        r.getCell(6).value = l2; r.getCell(6).font = {size:9};
        r.getCell(8).value = v2; r.getCell(8).numFmt = '₹#,##0.00'; r.getCell(8).font = {bold:true,size:9,color:headerBlue};
        r.height = 16; rowNum++;
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url;
      a.download = `CS49_${m.operational_department_name}_${m.financial_year}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    };
    return (
      <div>
        {/* Sticky Actions & Header Bar (Screen Only) */}
        <div className="sticky top-16 z-20 -mt-6 sm:-mt-8 -mx-6 sm:-mx-8 px-6 sm:px-8 pt-4 pb-3 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs mb-6 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Condemnation CS-49 — #{m.id}</h2>
              <StatusBadge status={m.status} />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-3.5 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <span>🖨️</span>
                <span>Print CS-49 (A4 Landscape)</span>
              </button>
              <button onClick={exportMasterToExcel} className="border border-green-600 text-green-700 bg-white px-3 py-1.5 rounded text-sm hover:bg-green-50 font-medium shadow-2xs cursor-pointer">
                ⬇ Export Excel
              </button>
              {hasRole('StockHolder') && m.status === 'PENDING' && (
                <button onClick={doCertify} className="border border-blue-500 text-blue-600 bg-white px-3 py-1.5 rounded text-sm hover:bg-blue-50 font-medium shadow-2xs">Certify</button>
              )}
              {hasRole('Admin') && m.status === 'PENDING' && (
                <button onClick={doBoardReview} className="border border-green-500 text-green-700 bg-white px-3 py-1.5 rounded text-sm hover:bg-green-50 font-medium shadow-2xs">Board Review</button>
              )}
              {hasRole('Admin') && ['PENDING','BOARD_REVIEWED'].includes(m.status) && (
                <button onClick={doReject} className="border border-red-400 text-red-600 bg-white px-3 py-1.5 rounded text-sm hover:bg-red-50 font-medium shadow-2xs">Reject</button>
              )}
              {m.status === 'BOARD_REVIEWED' && !m.sanction && (
                <Link to={`/sanctions/new?condemnation_ref=${m.type}-${m.id}`} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 font-medium">Create Sanction →</Link>
              )}
              {m.status === 'SANCTIONED' && !m.disposal && (
                <Link to={`/disposal/new?condemnation_ref=${m.type}-${m.id}&sanction_id=${m.sanction?.id}`} className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-700 font-medium">Create Disposal →</Link>
              )}
              <Link to="/condemnation" className="border border-gray-300 bg-white px-3 py-1.5 rounded text-sm hover:bg-gray-50 font-medium shadow-2xs">← Back</Link>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing Official KVS Condemnation Sheet (Form CS-49) with <strong>{items.length}</strong> article item(s).
            </span>
            <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              Orientation: Landscape A4
            </span>
          </div>
        </div>

        <div className="cs49-sheet print-area">
          {/* Header */}
          <div className="cs49-header text-center">
            {/* Top Bar: Ref | Bilingual School Name | Form Badge */}
            <div className="flex items-start justify-between mb-1 pb-1">
              <div className="w-24 text-left text-[11px] font-mono text-gray-500 print:text-black pt-1">
                REF #{m.id}
              </div>

              <div className="text-center flex-1">
                <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-snug font-serif">
                  {m.kv_name_hi || user?.kv_name_hi || 'केन्द्रीय विद्यालय'}
                </h1>
                <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5 font-serif">
                  {m.kv_name_en || user?.kv_name_en || 'KENDRIYA VIDYALAYA'}
                </h2>
                <div className="text-[10px] text-gray-600 print:text-black font-serif tracking-widest mt-0.5">
                  KENDRIYA VIDYALAYA SANGATHAN
                </div>
              </div>

              <div className="w-24 text-right shrink-0">
                <span className="register-badge-box">CS-49</span>
              </div>
            </div>

            {/* Banner */}
            <div className="text-center border-t border-b border-black py-1 my-1.5 font-serif">
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-black">
                LIST OF ARTICLES RECOMMENDED FOR WRITE OFF
              </h3>
              <div className="text-[10px] text-black mt-0.5">
                UNDER THE HEAD <strong className="font-bold underline">{assetHead.toUpperCase()}</strong> NON-CONSUMABLE (<strong>{m.fund_code}</strong>) &nbsp;|&nbsp; <strong>Method:</strong> {
                  m.depreciation_method === 'BOTH' ? 'Dual-Rate (SLM & WDV)' :
                  m.depreciation_method === 'SLM' ? 'Straight Line Method (SLM)' :
                  m.depreciation_method === 'WDV' ? 'Written Down Value (WDV)' : m.depreciation_method
                }
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-black pt-0.5 px-1 font-serif">
              <span>Operational Department: <strong>{m.operational_department_name}</strong></span>
              <span>Financial Year: <strong>{m.financial_year}</strong></span>
            </div>
          </div>

          {/* Article Table */}
          <div className="overflow-x-auto">
            <table className="cs49-table">
              <thead>
                <tr>
                  <th className="col-num">Sl.No.</th>
                  <th>Name of the article<br/><span style={{fontWeight:'normal',fontSize:'0.8em'}}>(Rate of the article)</span></th>
                  <th>Quantity damaged/<br/>broken</th>
                  <th>Total cost of<br/>damaged/broken<br/>articles</th>
                  <th>Date of<br/>purchase</th>
                  <th>Life fixed<br/>by K.V.S.</th>
                  <th>Date when it became<br/>unserviceable or<br/>date of breakage</th>
                  <th>Reason for<br/>condemnation</th>
                  <th>Stock Register<br/><span style={{fontWeight:'normal',fontSize:'0.8em'}}>(Vol. No. / Page No.)</span></th>
                </tr>
                <tr className="cs49-col-nums">
                  <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="text-center font-mono text-gray-500">{idx + 1}</td>
                    <td>
                      <div className="font-semibold text-black">{item.asset_name}</div>
                      {item.machine_no && <div className="cs49-sub font-mono">M/C: {item.machine_no}</div>}
                      {item.article_rate && <div className="cs49-sub font-medium">Rate: {formatCurrency(item.article_rate)}</div>}
                    </td>
                    <td className="text-center font-medium">{item.quantity_condemned}</td>
                    <td className="text-right font-bold text-black">{formatCurrency(item.original_cost)}</td>
                    <td className="text-center whitespace-nowrap">{formatDate(item.purchase_date)}</td>
                    <td className="text-center">{item.life_fixed_by_kvs ? `${item.life_fixed_by_kvs} years` : '—'}</td>
                    <td className="text-center whitespace-nowrap">{item.date_unserviceable ? formatDate(item.date_unserviceable) : (m.date_unserviceable ? formatDate(m.date_unserviceable) : '—')}</td>
                    <td className="text-xs">{m.reason}</td>
                    <td className="text-center text-xs">
                      {(item.stock_volume_no || item.stock_page_no)
                        ? <><div>Vol. {item.stock_volume_no ?? '—'}</div><div>Pg. {item.stock_page_no ?? '—'}</div></>
                        : '—'}
                    </td>
                  </tr>
                ))}

                {/* Buffer rows */}
                {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, idx) => (
                  <tr key={`empty-master-${idx}`} className="empty-ledger-row">
                    <td className="text-center text-gray-300 font-mono text-[9px] print:text-gray-400">{items.length + idx + 1}</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}

                <tr className="cs49-total-row">
                  <td colSpan="3" className="text-right font-bold">TOTAL</td>
                  <td className="text-right font-bold text-black">{formatCurrency(m.total_original_cost)}</td>
                  <td colSpan="5"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Depreciation Summary */}
          <div className="cs49-depr-summary">
            <table className="cs49-depr-table">
              <tbody>
                <tr>
                  <td className="cs49-depr-label">Total Depreciation:</td>
                  <td className="cs49-depr-value">{formatCurrency(m.total_depreciation)}</td>
                  <td className="cs49-depr-label">Total Condemnation Cost:</td>
                  <td className="cs49-depr-value">{formatCurrency(m.total_condemnation_cost)}</td>
                </tr>
                <tr>
                  <td className="cs49-depr-label">Total Original Cost:</td>
                  <td className="cs49-depr-value">{formatCurrency(m.total_original_cost)}</td>
                  <td className="cs49-depr-label">Total Depreciated Value:</td>
                  <td className="cs49-depr-value">{formatCurrency(m.total_depreciated_value)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Certificate Section */}
          <div className="cs49-certificate">
            <h4 className="cs49-cert-title">प्रमाण-पत्र / CERTIFICATE</h4>
            <ol className="cs49-cert-list">
              <li>
                <span className="cs49-cert-check">{(m.cert_info_correct || ['BOARD_REVIEWED','SANCTIONED','DISPOSED'].includes(m.status)) ? '✓' : '☐'}</span>
                <span>प्रमाणित किया जाता है कि कॉलम 2 से 8 में दी गई सूचना सही है /<br />
                Certified that the information given in columns 2 to 8 is correct.</span>
              </li>
              <li>
                <span className="cs49-cert-check">{(m.cert_normal_wear || ['BOARD_REVIEWED','SANCTIONED','DISPOSED'].includes(m.status)) ? '✓' : '☐'}</span>
                <span>प्रमाणित किया जाता है कि कॉलम 2 एवं 3 में वर्णित वस्तुएँ केवल सामान्य टूट-फूट के कारण ही अप्रयोज्य हुई तथा यह जानबूझकर या अधिकारी की लापरवाही से हुई टूट-फूट का मामला नहीं है जिसके लिए दायित्व निर्धारण की आवश्यकता हो /<br />
                Certified that the articles mentioned in columns (2) (3) were rendered unserviceable only on account of normal wear and tear and there had been no case of wilful breakage/breakage due to negligence of an official, which requires fixation of responsibility.</span>
              </li>
              <li>
                <span className="cs49-cert-check">{(m.cert_board_report || ['BOARD_REVIEWED','SANCTIONED','DISPOSED'].includes(m.status)) ? '✓' : '☐'}</span>
                <span>वस्तुओं को अनुपयोगी घोषित करने वाले बोर्ड की रिपोर्ट संलग्न है /<br />
                The report of the Condemnation Board is enclosed.</span>
              </li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="cs49-signatures">
            <div className="w-5/12">
              <div className="cs49-sig-label">1. Name & Signature of the Stock Incharge</div>
              <div className="border-t border-dotted border-black mt-8 pt-1">
                <div className="cs49-sig-name">{m.stock_incharge_name || '...................................................'}</div>
                {m.stock_incharge_designation && <div className="text-xs text-gray-600 print:text-black">{m.stock_incharge_designation}</div>}
                {m.stock_incharge_empcode && <div className="cs49-sig-empcode">Emp Code: {m.stock_incharge_empcode}</div>}
                <div className="text-[10px] text-gray-500 print:text-black mt-0.5">Date: _______________</div>
              </div>
            </div>

            <div className="w-6/12">
              <div className="cs49-sig-label mb-2">2. Name & Signature of the Checkers (Condemnation Board)</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-black">1. ............................................................</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-black">2. ............................................................</span>
                  <span className="font-bold uppercase tracking-wider text-black text-right pr-4">PRINCIPAL / HEAD OF OFFICE</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 print:text-black">3. ............................................................</span>
                  <span className="text-[10px] text-gray-500 print:text-black pr-6">Office Seal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sanction & Disposal — no-print */}
          {(m.sanction || m.disposal) && (
            <div className="no-print mt-4 space-y-3">
              {m.sanction && (
                <div className="border border-gray-200 rounded p-3 text-sm">
                  <p className="font-semibold text-gray-700 mb-1">Sanction Details</p>
                  <p>Sanction No.: <strong>{m.sanction.sanction_no}</strong> | Date: {formatDate(m.sanction.sanction_date)} | Amount: {formatCurrency(m.sanction.sanctioned_amount)}</p>
                </div>
              )}
              {m.disposal && (
                <div className="border border-gray-200 rounded p-3 text-sm">
                  <p className="font-semibold text-gray-700 mb-1">Disposal Details</p>
                  <p>Mode: <strong>{m.disposal.disposal_mode}</strong> | Date: {formatDate(m.disposal.disposal_date)} | Amount: {formatCurrency(m.disposal.sale_amount)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LEGACY: single-asset condemnation_entry view ───────
  const d = data;
  const deptName = d.dept_name || '';
  const fundCode = d.fund_code || '';
  const methodLabel = d.depreciation_method === 'BOTH' ? 'Dual-Rate (SLM & WDV)' :
                      d.depreciation_method === 'SLM_PRE_2011' ? 'Straight Line Method (SLM)' :
                      d.depreciation_method === 'WDV_POST_2011' ? 'Written Down Value (WDV)' : (d.depreciation_method || 'Dual-Rate (SLM & WDV)');

  return (
    <div>
      {/* Sticky Actions & Header Bar (Screen Only) */}
      <div className="sticky top-16 z-20 -mt-6 sm:-mt-8 -mx-6 sm:-mx-8 px-6 sm:px-8 pt-4 pb-3 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs mb-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Condemnation CS-49 — #{d.id}</h2>
            <StatusBadge status={d.status} />
          </div>

          <div className="flex justify-end gap-2 flex-wrap items-center">
            {d.status === 'PENDING' && hasRole('TeacherInCharge', 'Admin') && (
              <button onClick={doCertify} className="bg-blue-600 text-white px-3.5 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Certify (In-Charge / Checker)</button>
            )}
            {d.status === 'BOARD_REVIEWED' && (
              <Link to={`/sanctions/new?condemnation_ref=${d.type}-${d.id}`} className="bg-green-600 text-white px-3.5 py-1.5 rounded text-sm font-medium">Create Sanction →</Link>
            )}
            {d.status === 'SANCTIONED' && (
              <Link to={`/disposal/new?condemnation_ref=${d.type}-${d.id}&sanction_id=${d.sanction?.id}`} className="bg-orange-600 text-white px-3.5 py-1.5 rounded text-sm font-medium">Create Disposal →</Link>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-3.5 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <span>🖨️</span>
              <span>Print CS-49 (A4 Landscape)</span>
            </button>
            <button onClick={exportToExcel} className="border border-green-600 text-green-700 bg-white px-3 py-1.5 rounded text-sm hover:bg-green-50 font-medium shadow-2xs cursor-pointer">
              📊 Export Excel
            </button>
            <Link to="/condemnation" className="border border-gray-300 bg-white px-3 py-1.5 rounded text-sm hover:bg-gray-50 font-medium shadow-2xs">← Back</Link>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing Official KVS Condemnation Sheet (Form CS-49) • 1 Article Account Folio.
          </span>
          <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
            Orientation: Landscape A4
          </span>
        </div>
      </div>

      {/* ===== CS-49 PROFORMA ===== */}
      <div className="cs49-proforma print-area">
        {/* Header */}
        <div className="cs49-header">
          {/* Top Bar: Ref | Bilingual School Name | Form Badge */}
          <div className="flex items-start justify-between mb-1 pb-1">
            <div className="w-24 text-left text-[11px] font-mono text-gray-500 print:text-black pt-1">
              REF #{d.id}
            </div>

            <div className="text-center flex-1">
              <h1 className="text-base sm:text-lg font-bold text-black tracking-wide leading-snug font-serif">
                {d.kv_name_hi || user?.kv_name_hi || 'केन्द्रीय विद्यालय'}
              </h1>
              <h2 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider mt-0.5 font-serif">
                {d.kv_name_en || user?.kv_name_en || 'KENDRIYA VIDYALAYA'}
              </h2>
              <div className="text-[10px] text-gray-600 print:text-black font-serif tracking-widest mt-0.5">
                KENDRIYA VIDYALAYA SANGATHAN
              </div>
            </div>

            <div className="w-24 text-right shrink-0">
              <span className="register-badge-box">CS-49</span>
            </div>
          </div>

          {/* Banner */}
          <div className="text-center border-t border-b border-black py-1 my-1.5 font-serif">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-black">
              LIST OF ARTICLES RECOMMENDED FOR WRITE OFF
            </h3>
            <div className="text-[10px] text-black mt-0.5">
              UNDER THE HEAD <strong className="font-bold underline">{deptName.toUpperCase()}</strong> NON-CONSUMABLE ({fundCode}) &nbsp;|&nbsp; <strong>Method:</strong> {methodLabel}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="cs49-table">
            <thead>
              <tr>
                <th className="col-num">Sl.No.</th>
                <th>Name of the article<br/><span style={{fontWeight:'normal',fontSize:'0.8em'}}>(Rate of the article)</span></th>
                <th>Quantity damaged/<br/>broken</th>
                <th>Total cost of<br/>damaged/broken<br/>articles</th>
                <th>Date of<br/>purchase</th>
                <th>Life fixed<br/>by K.V.S.</th>
                <th>Date when it became<br/>unserviceable or<br/>date of breakage</th>
                <th>Reason for<br/>condemnation</th>
                <th>Stock Register<br/><span style={{fontWeight:'normal',fontSize:'0.8em'}}>(Vol. No. / Page No.)</span></th>
              </tr>
              <tr className="cs49-col-nums">
                <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-center font-mono text-gray-500">1</td>
                <td>
                  <div className="font-semibold text-black">{d.asset_name}</div>
                  {d.machine_no && <div className="cs49-sub font-mono">M/C: {d.machine_no}</div>}
                  {d.asset_description && <div className="cs49-sub">{d.asset_description}</div>}
                  {d.article_rate && <div className="cs49-sub font-medium">Rate: {formatCurrency(d.article_rate)}</div>}
                </td>
                <td className="text-center font-medium">{d.quantity_condemned}</td>
                <td className="text-right font-bold text-black">{formatCurrency(d.original_cost)}</td>
                <td className="text-center whitespace-nowrap">{formatDate(d.purchase_date)}</td>
                <td className="text-center">{d.life_fixed_by_kvs ? `${d.life_fixed_by_kvs} years` : (d.life_period_years ? `${d.life_period_years} years` : '—')}</td>
                <td className="text-center whitespace-nowrap">{d.date_unserviceable ? formatDate(d.date_unserviceable) : '—'}</td>
                <td className="text-xs">{d.reason}</td>
                <td className="text-center text-xs">
                  {(d.stock_volume_no || d.stock_page_no)
                    ? <><div>Vol. {d.stock_volume_no ?? '—'}</div><div>Pg. {d.stock_page_no ?? '—'}</div></>
                    : '—'}
                </td>
              </tr>

              {/* Buffer blank rows for authentic ledger height */}
              {Array.from({ length: 4 }).map((_, idx) => (
                <tr key={`empty-cs49-${idx}`} className="empty-ledger-row">
                  <td className="text-center text-gray-300 font-mono text-[9px] print:text-gray-400">{2 + idx}</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))}

              {/* Total Row */}
              <tr className="cs49-total-row">
                <td colSpan="3" className="text-right font-bold">TOTAL</td>
                <td className="text-right font-bold text-black">{formatCurrency(d.original_cost)}</td>
                <td colSpan="5"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Depreciation Summary */}
        <div className="cs49-depr-summary">
          <table className="cs49-depr-table">
            <tbody>
              {(d.depreciation_method === 'SLM_PRE_2011' || d.depreciation_method === 'BOTH') && d.depr_pre_2011 > 0 && (
                <tr>
                  <td className="cs49-depr-label">SLM Pre-2011 ({d.years_pre_2011} yrs × {((d.slm_rate_pre || 0) * 100).toFixed(2)}%):</td>
                  <td className="cs49-depr-value">{formatCurrency(d.depr_pre_2011)}</td>
                  <td className="cs49-depr-label"></td>
                  <td className="cs49-depr-value"></td>
                </tr>
              )}
              {(d.depreciation_method === 'WDV_POST_2011' || d.depreciation_method === 'BOTH') && d.depr_post_2011 > 0 && (
                <tr>
                  <td className="cs49-depr-label">WDV Post-2011 ({d.years_post_2011} yrs × {((d.wdv_rate_post || 0) * 100).toFixed(2)}%):</td>
                  <td className="cs49-depr-value">{formatCurrency(d.depr_post_2011)}</td>
                  <td className="cs49-depr-label"></td>
                  <td className="cs49-depr-value"></td>
                </tr>
              )}
              <tr>
                <td className="cs49-depr-label">Total Depreciation:</td>
                <td className="cs49-depr-value">{formatCurrency(d.total_depreciation)}</td>
                <td className="cs49-depr-label">Depreciation (95% Cap):</td>
                <td className="cs49-depr-value">{formatCurrency(d.cap_95_value)}</td>
              </tr>
              <tr>
                <td className="cs49-depr-label">Condemnation Cost:</td>
                <td className="cs49-depr-value">{formatCurrency(d.condemnation_cost)}</td>
                <td className="cs49-depr-label">Depreciated Value:</td>
                <td className="cs49-depr-value">{formatCurrency(d.depreciated_value)}</td>
              </tr>
            </tbody>
          </table>
          {/* Method Footer Note */}
          <div className="cs49-method-note">
            <strong>Note:</strong> Depreciation has been calculated using the{' '}
            {d.depreciation_method === 'SLM_PRE_2011' && (
              <><strong>Straight Line Method (SLM)</strong> at the pre-2011 rate of {((d.slm_rate_pre || 0) * 100).toFixed(2)}% p.a., as applicable for assets acquired before the transition to WDV.</>
            )}
            {d.depreciation_method === 'WDV_POST_2011' && (
              <><strong>Written Down Value (WDV) Method</strong> at {((d.wdv_rate_post || 0) * 100).toFixed(2)}% p.a., as adopted by KVS from FY 2011-12 onwards vide F.No. 110116/2014-15/AA(I)/KVS/Acctts dated 06.06.2016.</>
            )}
            {(d.depreciation_method === 'BOTH' || !d.depreciation_method) && (
              <><strong>Dual-Rate Method</strong> — SLM at {((d.slm_rate_pre || 0) * 100).toFixed(2)}% p.a. for the period prior to March 2011, and WDV at {((d.wdv_rate_post || 0) * 100).toFixed(2)}% p.a. for the period from April 2011 onwards, as per the transition approved by the Board of Governors of KVS.</>
            )}
            {' '}Maximum depreciation is capped at 95% of the original cost, retaining 5% as residual value.
          </div>
        </div>

        {/* Certificate Section */}
        <div className="cs49-certificate">
          <h4 className="cs49-cert-title">प्रमाण-पत्र / CERTIFICATE</h4>
          <ol className="cs49-cert-list">
            <li>
              <span className="cs49-cert-check">{(d.cert_info_correct || ['BOARD_REVIEWED','SANCTIONED','DISPOSED'].includes(d.status)) ? '✓' : '☐'}</span>
              <span>प्रमाणित किया जाता है कि कॉलम 2 से 8 में दी गई सूचना सही है /<br />
              Certified that the information given in columns 2 to 8 is correct.</span>
            </li>
            <li>
              <span className="cs49-cert-check">{(d.cert_normal_wear || ['BOARD_REVIEWED','SANCTIONED','DISPOSED'].includes(d.status)) ? '✓' : '☐'}</span>
              <span>प्रमाणित किया जाता है कि कॉलम 2 एवं 3 में वर्णित वस्तुएँ केवल सामान्य टूट-फूट के कारण ही अप्रयोज्य हुई तथा यह जानबूझकर या अधिकारी की लापरवाही से हुई टूट-फूट का मामला नहीं है जिसके लिए दायित्व निर्धारण की आवश्यकता हो /<br />
              Certified that the articles mentioned in columns (2) (3) were rendered unserviceable only on account of normal wear and tear and there had been no case of wilful breakage/breakage due to negligence of an official, which requires fixation of responsibility.</span>
            </li>
            <li>
              <span className="cs49-cert-check">{(d.cert_board_report || ['BOARD_REVIEWED','SANCTIONED','DISPOSED'].includes(d.status)) ? '✓' : '☐'}</span>
              <span>वस्तुओं को अनुपयोगी घोषित करने वाले बोर्ड की रिपोर्ट संलग्न है /<br />
              The report of the Condemnation Board is enclosed.</span>
            </li>
          </ol>
        </div>

        {/* Signatures */}
        <div className="cs49-signatures">
          <div className="w-5/12">
            <div className="cs49-sig-label">1. Name & Signature of the Stock Incharge</div>
            <div className="border-t border-dotted border-black mt-8 pt-1">
              <div className="cs49-sig-name">{d.stock_incharge_name || '...................................................'}</div>
              {d.stock_incharge_designation && <div className="text-xs text-gray-600 print:text-black">{d.stock_incharge_designation}</div>}
              {d.stock_incharge_empcode && <div className="cs49-sig-empcode">Emp Code: {d.stock_incharge_empcode}</div>}
              <div className="text-[10px] text-gray-500 print:text-black mt-0.5">Date: _______________</div>
            </div>
          </div>

          <div className="w-6/12">
            <div className="cs49-sig-label mb-2">2. Name & Signature of the Checkers (Condemnation Board)</div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 print:text-black">1. ............................................................</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 print:text-black">2. ............................................................</span>
                <span className="font-bold uppercase tracking-wider text-black text-right pr-4">PRINCIPAL / HEAD OF OFFICE</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 print:text-black">3. ............................................................</span>
                <span className="text-[10px] text-gray-500 print:text-black pr-6">Office Seal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Board Date */}
        {d.board_date && (
          <div className="cs49-board-date">
            Board Review Date: <strong>{formatDate(d.board_date)}</strong>
          </div>
        )}
      </div>

      {/* Sanction Section — below proforma, hidden from print */}
      {d.sanction && (
        <div className="cs49-extra-section no-print">
          <p className="form-section-title">Sanction Details</p>
          <div className="text-sm space-y-1">
            <p>Sanction No: <strong>{d.sanction.sanction_no}</strong></p>
            <p>Authority: <strong>{d.sanction.sanctioning_authority}</strong></p>
            <p>Amount: <strong>{formatCurrency(d.sanction.sanctioned_amount)}</strong></p>
          </div>
        </div>
      )}

      {d.disposal && (
        <div className="cs49-extra-section">
          <p className="form-section-title">Disposal Details</p>
          <div className="text-sm space-y-1">
            <p>Mode: <strong>{d.disposal.disposal_mode}</strong></p>
            <p>Date: <strong>{formatDate(d.disposal.disposal_date)}</strong></p>
            {d.disposal.sale_amount > 0 && <p>Sale Amount: <strong>{formatCurrency(d.disposal.sale_amount)}</strong></p>}
          </div>
        </div>
      )}

      <Link to="/condemnation" className="text-sm text-blue-600 hover:underline mt-4 inline-block no-print">← Back</Link>
    </div>
  );
}
