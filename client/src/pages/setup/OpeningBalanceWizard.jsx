import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  UploadCloud,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Check,
  Building2,
  FileText,
  Calculator,
  ShieldCheck
} from 'lucide-react';
import { getAssetHeads, getFundingHeads, getFinancialYears } from '../../api/masters';
import { getOpeningBalances, saveOpeningBalances, getSetupStatus, bulkOnboard } from '../../api/setup';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function OpeningBalanceWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Active step: 1 = Aggregate Balances, 2 = Bulk CSV Import, 3 = Reconciliation & Schedule 4
  const [activeStep, setActiveStep] = useState(1);

  // Adoption Financial Year
  const [selectedFY, setSelectedFY] = useState('2025-26');
  const [availableFYs, setAvailableFYs] = useState([]);

  // Master data
  const [departments, setDepartments] = useState([]);
  const [fundingHeads, setFundingHeads] = useState([]);
  const [selectedFundId, setSelectedFundId] = useState('');

  // Status & Data
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  // Step 1: Matrix state: key = `${deptId}_${fundId}` -> { gross: number, depr: number, remarks: string }
  const [balanceMatrix, setBalanceMatrix] = useState({});

  // Step 2: CSV Import state
  const [csvFile, setCsvFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Step 3: Schedule 4 preview data
  const [scheduleData, setScheduleData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Load masters & initial status
  useEffect(() => {
    async function loadInitData() {
      setLoading(true);
      try {
        const [deptsRes, fundsRes, fyRes] = await Promise.all([
          getAssetHeads(),
          getFundingHeads(),
          getFinancialYears({ include_all: true }),
        ]);

        const fyList = Array.isArray(fyRes?.data) ? fyRes.data : (Array.isArray(fyRes) ? fyRes : (fyRes?.data?.data || []));
        const fyObjects = fyList.length > 0 ? fyList : [{ code: '2025-26', is_current: true }, { code: '2024-25' }];
        setAvailableFYs(fyObjects);

        const currentFyObj = fyObjects.find((f) => f.is_current) || fyObjects[0];
        const initialFY = currentFyObj ? currentFyObj.code : '2025-26';
        setSelectedFY(initialFY);

        const depts = deptsRes.data || [];
        const funds = fundsRes.data || [];
        setDepartments(depts);
        setFundingHeads(funds);
        if (funds.length > 0) setSelectedFundId(String(funds[0].id));

        const statusRes = await getSetupStatus(initialFY);
        setStatus(statusRes.data);

        // Load existing snapshots for this FY
        await loadSnapshotsForFY(initialFY, depts, funds);
      } catch (err) {
        console.error('Failed to load setup data:', err);
        toast.error('Failed to load opening balance data');
      } finally {
        setLoading(false);
      }
    }
    loadInitData();
  }, []);

  // When FY changes, reload snapshots & status
  const handleFYChange = async (newFY) => {
    setSelectedFY(newFY);
    setLoading(true);
    try {
      const statusRes = await getSetupStatus(newFY);
      setStatus(statusRes.data);
      await loadSnapshotsForFY(newFY, departments, fundingHeads);
    } catch (err) {
      toast.error('Failed to fetch data for ' + newFY);
    } finally {
      setLoading(false);
    }
  };

  const loadSnapshotsForFY = async (fy, depts, funds) => {
    try {
      const res = await getOpeningBalances(fy);
      const existing = res.data || [];
      const matrix = {};

      // Pre-fill existing entries
      existing.forEach((item) => {
        const key = `${item.department_id}_${item.funding_head_id}`;
        matrix[key] = {
          gross: parseFloat(item.opening_gross_value) || 0,
          depr: parseFloat(item.opening_accum_depreciation) || 0,
          remarks: item.remarks || '',
        };
      });

      setBalanceMatrix(matrix);
    } catch (err) {
      console.error('Error loading snapshots:', err);
    }
  };

  // Helper for matrix updates
  const handleMatrixChange = (deptId, fundId, field, val) => {
    const key = `${deptId}_${fundId}`;
    const current = balanceMatrix[key] || { gross: 0, depr: 0, remarks: '' };
    const numVal = field === 'remarks' ? val : Math.max(0, parseFloat(val) || 0);

    setBalanceMatrix((prev) => ({
      ...prev,
      [key]: {
        ...current,
        [field]: numVal,
      },
    }));
  };

  // Compute live matrix totals
  const matrixSummary = useMemo(() => {
    let totalGross = 0;
    let totalDepr = 0;
    let countEntered = 0;

    Object.values(balanceMatrix).forEach((item) => {
      const g = item.gross || 0;
      const d = item.depr || 0;
      if (g > 0 || d > 0) countEntered++;
      totalGross += g;
      totalDepr += d;
    });

    return {
      totalGross,
      totalDepr,
      totalNet: totalGross - totalDepr,
      countEntered,
    };
  }, [balanceMatrix]);

  // Save Step 1 Aggregate Balances
  const handleSaveAggregate = async (proceedToStep2 = false) => {
    setSaving(true);
    try {
      const snapshots = [];
      for (const dept of departments) {
        for (const fund of fundingHeads) {
          const key = `${dept.id}_${fund.id}`;
          const data = balanceMatrix[key];
          if (data && (data.gross > 0 || data.depr > 0 || data.remarks)) {
            if (data.depr > data.gross) {
              throw new Error(
                `Accumulated Depreciation (₹${data.depr}) cannot exceed Gross Block (₹${data.gross}) for ${dept.name} (${fund.code})`
              );
            }
            snapshots.push({
              department_id: dept.id,
              funding_head_id: fund.id,
              opening_gross_value: data.gross,
              opening_accum_depreciation: data.depr,
              remarks: data.remarks || null,
            });
          }
        }
      }

      if (snapshots.length === 0) {
        toast('No non-zero opening balances entered yet. Please enter your register balances.', { icon: 'ℹ️' });
        setSaving(false);
        return;
      }

      await saveOpeningBalances({
        financial_year: selectedFY,
        snapshots,
      });

      toast.success(`Saved opening balances for ${snapshots.length} head combinations!`);
      const statusRes = await getSetupStatus(selectedFY);
      setStatus(statusRes.data);

      if (proceedToStep2) {
        setActiveStep(2);
      }
    } catch (err) {
      toast.error(err.message || err?.response?.data?.error || 'Failed to save opening balances');
    } finally {
      setSaving(false);
    }
  };

  // Step 2: CSV Template Download
  const handleDownloadTemplate = () => {
    const csvContent =
      'name,asset_head_code,funding_head_code,category_code,purchase_date,total_units,unit_cost,total_cost,stock_volume_no,stock_page_no,remarks\n' +
      '"Dell Desktop OptiPlex 7090",COMP,VVN,COMPUTER,2022-08-15,5,45000,225000,1,12,"Computer Lab 1 - Historical"\n' +
      '"Classroom Wooden Dual Desks",FURN,SF,FURNITURE,2021-06-20,20,3500,70000,2,45,"Class VIII-A"\n' +
      '"Physics Lab Compound Microscopes",LAB,VVN,OTHER,2023-01-10,4,12500,50000,1,88,"Sr. Physics Lab"\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `KVS_Asset_Opening_Template_${selectedFY}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 2: Handle CSV File Selection
  const handleCsvSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') return;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // Simple and robust CSV line parser
  const parseCSV = (text) => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      toast.error('CSV file has no data rows');
      return;
    }

    const header = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      // Regex to parse comma separated values while respecting quotes
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      const values = [];
      let match;
      while ((match = regex.exec(lines[i])) !== null) {
        if (match.index === regex.lastIndex) regex.lastIndex++;
        let val = match[1] || '';
        val = val.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        values.push(val);
      }

      const rowObj = {};
      header.forEach((key, colIdx) => {
        rowObj[key] = values[colIdx] || '';
      });

      if (rowObj.name && rowObj.total_cost) {
        rows.push(rowObj);
      }
    }

    setParsedRows(rows);
    toast.success(`Loaded ${rows.length} rows from CSV`);
  };

  // Step 2: Execute Bulk Import
  const handleExecuteBulk = async () => {
    if (parsedRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    setImporting(true);
    try {
      const res = await bulkOnboard(parsedRows);
      const result = res.data;
      setImportResult(result);
      if (result.succeeded_count > 0) {
        toast.success(`Successfully onboarded ${result.succeeded_count} historical assets!`);
        const statusRes = await getSetupStatus(selectedFY);
        setStatus(statusRes.data);
      }
      if (result.failed_count > 0) {
        toast.error(`${result.failed_count} assets could not be imported. Review details below.`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Bulk onboarding failed');
    } finally {
      setImporting(false);
    }
  };

  // Step 3: Load Schedule 4 for live verification
  const loadSchedulePreview = async () => {
    setLoadingSchedule(true);
    try {
      const res = await api.get('/assets/schedule4/data', {
        params: { fund_id: 'all', fy: selectedFY },
      });
      setScheduleData(res.data?.rows || res.data?.data?.rows || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      console.error('Failed to load Schedule 4:', err);
      toast.error('Could not load Schedule 4 preview');
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    if (activeStep === 3) {
      loadSchedulePreview();
    }
  }, [activeStep, selectedFY]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading opening balance configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header & Hero Card ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                System Adoption & Carry-Forward
              </span>
              {status?.is_configured ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Opening Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <AlertCircle className="w-3.5 h-3.5" /> Setup Pending
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Opening Balance Wizard
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Seamlessly enter your physical CS-24 and GFR-22 register balances at system adoption.
              Your carry-forward gross block and accumulated depreciation will populate Schedule 4 and all register balances accurately.
            </p>
          </div>

          {/* Financial Year Selector */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                  Adoption Financial Year
                </label>
                <Link to="/financial-years" className="text-[10px] text-blue-300 hover:text-white underline ml-2 transition-colors">
                  Manage FYs
                </Link>
              </div>
              <select
                value={selectedFY}
                onChange={(e) => handleFYChange(e.target.value)}
                className="bg-slate-900/90 text-white font-semibold text-sm rounded-lg px-3 py-1.5 border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {availableFYs.map((fy) => {
                  const code = typeof fy === 'string' ? fy : fy.code;
                  const isCurrent = typeof fy === 'object' && fy.is_current;
                  const isClosed = typeof fy === 'object' && fy.is_closed;
                  return (
                    <option key={code} value={code}>
                      FY {code} {isCurrent ? '(Current)' : ''} {isClosed ? '[Closed]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="text-xs text-slate-300 border-l border-white/20 pl-3">
              <p className="font-medium text-white">Baseline Adoption</p>
              <p className="text-[11px] text-slate-400">Applies to 1st April {selectedFY.split('-')[0]}</p>
            </div>
          </div>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-800/80 pt-6">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
              activeStep === 1
                ? 'bg-blue-600/30 border border-blue-400/40 text-white shadow-lg shadow-blue-500/10'
                : 'bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 text-slate-300'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                activeStep === 1 ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              1
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Step 1</p>
              <p className="text-sm font-semibold text-white">Aggregate Register Totals</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
              activeStep === 2
                ? 'bg-blue-600/30 border border-blue-400/40 text-white shadow-lg shadow-blue-500/10'
                : 'bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 text-slate-300'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                activeStep === 2 ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              2
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Step 2 (Optional)</p>
              <p className="text-sm font-semibold text-white">Bulk CSV Asset Import</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
              activeStep === 3
                ? 'bg-blue-600/30 border border-blue-400/40 text-white shadow-lg shadow-blue-500/10'
                : 'bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 text-slate-300'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                activeStep === 3 ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              3
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Step 3</p>
              <p className="text-sm font-semibold text-white">Schedule 4 Live Verification</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── STEP 1: Aggregate Figures ── */}
      {activeStep === 1 && (
        <div className="space-y-6">
          {/* Summary metrics card */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Heads Configured</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{matrixSummary.countEntered}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Asset × Fund combinations</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Total Opening Gross Block</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(matrixSummary.totalGross)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Original purchase cost baseline</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Opening Accum. Depreciation</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(matrixSummary.totalDepr)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Prior accumulated write-down</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
              <p className="text-xs font-medium text-emerald-800">Net Opening Book Value</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(matrixSummary.totalNet)}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Gross Block - Depreciation</p>
            </div>
          </div>

          {/* Funding Head filter tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-2">
                Funding Head:
              </span>
              <div className="flex gap-1.5 overflow-x-auto">
                {fundingHeads.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFundId(String(f.id))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedFundId === String(f.id)
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f.code} — {f.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveAggregate(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => handleSaveAggregate(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow disabled:opacity-50"
              >
                Save & Proceed <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table Matrix for selected funding head */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Asset Head Opening Balances ({fundingHeads.find((f) => String(f.id) === selectedFundId)?.code})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter physical register closing totals as of 31st March of prior year.
                </p>
              </div>
              <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-200">
                FY {selectedFY} Baseline
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5">Asset Head / Classification</th>
                    <th className="p-3.5 w-52">Opening Gross Block (₹)</th>
                    <th className="p-3.5 w-52">Opening Accum. Depr. (₹)</th>
                    <th className="p-3.5 w-40">Net Opening Value (₹)</th>
                    <th className="p-3.5">Physical Register Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map((dept, idx) => {
                    const key = `${dept.id}_${selectedFundId}`;
                    const entry = balanceMatrix[key] || { gross: 0, depr: 0, remarks: '' };
                    const net = Math.max(0, (entry.gross || 0) - (entry.depr || 0));

                    return (
                      <tr key={dept.id} className="hover:bg-blue-50/40 transition">
                        <td className="p-3.5 text-center font-mono text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900">{dept.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">Code: {dept.code}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={entry.gross === 0 ? '' : entry.gross}
                              placeholder="0.00"
                              onChange={(e) =>
                                handleMatrixChange(dept.id, selectedFundId, 'gross', e.target.value)
                              }
                              className="w-full pl-6 pr-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 font-mono font-medium text-xs text-right"
                            />
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={entry.depr === 0 ? '' : entry.depr}
                              placeholder="0.00"
                              onChange={(e) =>
                                handleMatrixChange(dept.id, selectedFundId, 'depr', e.target.value)
                              }
                              className={`w-full pl-6 pr-3 py-1.5 rounded-lg border outline-none font-mono font-medium text-xs text-right ${
                                entry.depr > entry.gross && entry.gross > 0
                                  ? 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900'
                              }`}
                            />
                          </div>
                          {entry.depr > entry.gross && entry.gross > 0 && (
                            <p className="text-[10px] text-red-600 mt-0.5">Cannot exceed gross block</p>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-md inline-block w-full text-right">
                            {formatCurrency(net)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <input
                            type="text"
                            placeholder="e.g. Volume 3, Page 45"
                            value={entry.remarks || ''}
                            onChange={(e) =>
                              handleMatrixChange(dept.id, selectedFundId, 'remarks', e.target.value)
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-700 text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <span>Values entered here become the official carry-forward gross block for Schedule 4.</span>
              </div>
              <button
                type="button"
                onClick={() => handleSaveAggregate(false)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition"
              >
                Save Balances
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Bulk CSV Import (Optional) ── */}
      {activeStep === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Bulk Historical Asset Onboarding</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  If you have detailed item-wise records in Excel/CSV, upload them here to automatically populate individual GFR-22 asset cards, generate historical depreciation, and auto-classify items.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" /> Download Sample CSV
                </button>
              </div>
            </div>

            {/* File Upload Dropzone */}
            <div className="mt-6">
              <label
                htmlFor="csv-upload"
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-blue-600 mb-3 transition">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {csvFile ? csvFile.name : 'Click to select or drag & drop CSV file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports .csv format with headers (name, asset_head_code, total_cost, purchase_date, etc.)
                </p>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvSelect}
                  className="hidden"
                />
              </label>
            </div>

            {/* Parsed Rows Preview Table */}
            {parsedRows.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Preview Parsed Items</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                      {parsedRows.length} assets found
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteBulk}
                    disabled={importing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing Import...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Start Bulk Import ({parsedRows.length})
                      </>
                    )}
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 font-bold text-slate-600">
                      <tr>
                        <th className="p-3 w-10">#</th>
                        <th className="p-3">Asset Name</th>
                        <th className="p-3">Head</th>
                        <th className="p-3">Fund</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Purchase Date</th>
                        <th className="p-3 text-right">Cost (₹)</th>
                        <th className="p-3">Vol/Page</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                          <td className="p-3 font-semibold text-slate-800">{r.name}</td>
                          <td className="p-3 font-mono text-slate-600">{r.asset_head_code || r.department || 'OFA'}</td>
                          <td className="p-3 font-mono text-slate-600">{r.funding_head_code || r.fund || 'VVN'}</td>
                          <td className="p-3 text-slate-600">{r.category_code || r.category || 'OTHER'}</td>
                          <td className="p-3 font-mono text-slate-600">{r.purchase_date}</td>
                          <td className="p-3 font-mono font-semibold text-slate-900 text-right">
                            {formatCurrency(parseFloat(r.total_cost || 0))}
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            {r.stock_volume_no ? `V${r.stock_volume_no}` : ''}
                            {r.stock_page_no ? ` P${r.stock_page_no}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedRows.length > 50 && (
                  <p className="text-[11px] text-slate-400 text-center">
                    Showing first 50 rows of {parsedRows.length} items. All items will be processed upon import.
                  </p>
                )}
              </div>
            )}

            {/* Import Results Box */}
            {importResult && (
              <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Import Summary</h4>
                <div className="flex gap-4">
                  <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold text-xs">
                    ✅ {importResult.succeeded_count} Succeeded
                  </span>
                  {importResult.failed_count > 0 && (
                    <span className="px-3 py-1 rounded-lg bg-red-100 text-red-800 font-semibold text-xs">
                      ❌ {importResult.failed_count} Failed
                    </span>
                  )}
                </div>

                {importResult.failed && importResult.failed.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg max-h-40 overflow-y-auto space-y-1">
                    <p className="text-xs font-bold text-red-800">Errors to review:</p>
                    {importResult.failed.map((f, i) => (
                      <p key={i} className="text-[11px] text-red-700">
                        Row {f.row} ({f.name}): {f.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step navigation buttons */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Step 1
              </button>
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
              >
                Proceed to Verification <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Verification & Schedule 4 Live Preview ── */}
      {activeStep === 3 && (
        <div className="space-y-6">
          {/* Adoption Health Card */}
          <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-emerald-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Opening Balances Ready & Reconciled</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Your baseline register totals are now active for FY {selectedFY}. All subsequent additions, depreciation runs, and condemnation workflows will automatically calculate from these opening balances.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/schedule4"
                className="px-4 py-2 rounded-lg bg-white text-slate-900 font-semibold text-xs hover:bg-slate-100 transition shadow-sm"
              >
                Open Schedule 4 Register
              </Link>
              <Link
                to="/"
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 transition shadow-sm"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>

          {/* Schedule 4 Live Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Schedule 4 Opening Preview (Financial Year {selectedFY})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live verification showing Columns 2 (Opening Gross Block) & Column 10 (Opening Depreciation).
                </p>
              </div>
              <button
                type="button"
                onClick={loadSchedulePreview}
                disabled={loadingSchedule}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
              >
                <RefreshCw className={`w-3 h-3 ${loadingSchedule ? 'animate-spin' : ''}`} /> Refresh Preview
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3 w-12 text-center">S.No.</th>
                    <th className="p-3">Asset Classification Head</th>
                    <th className="p-3 text-right">Opening Gross Block (Col 2)</th>
                    <th className="p-3 text-right">Additions (Col 3)</th>
                    <th className="p-3 text-right">Closing Gross (Col 6)</th>
                    <th className="p-3 text-right">Opening Depr (Col 10)</th>
                    <th className="p-3 text-right">Total Depr (Col 13)</th>
                    <th className="p-3 text-right">Net Book Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scheduleData.length > 0 ? (
                    scheduleData.map((row) => (
                      <tr
                        key={row.sn}
                        className={`hover:bg-blue-50/30 transition ${
                          row.gb_opening > 0 ? 'bg-blue-50/15 font-medium' : ''
                        }`}
                      >
                        <td className="p-3 text-center text-slate-400 font-mono">{row.sn}</td>
                        <td className="p-3 font-semibold text-slate-800">{row.label}</td>
                        <td className="p-3 text-right font-mono font-semibold text-blue-700">
                          {formatCurrency(row.gb_opening)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600">
                          {formatCurrency(row.gb_additions)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-900">
                          {formatCurrency(row.gb_closing)}
                        </td>
                        <td className="p-3 text-right font-mono text-amber-700">
                          {formatCurrency(row.depr_opening)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-amber-900">
                          {formatCurrency(row.depr_total)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(row.net_current)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                        {loadingSchedule ? 'Calculating Schedule 4 preview...' : 'No schedule data found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Step 2
              </button>

              <button
                type="button"
                onClick={() => {
                  toast.success('System adoption opening balances confirmed!');
                  navigate('/schedule4');
                }}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-md"
              >
                <Check className="w-3.5 h-3.5" /> Confirm & Complete Setup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
