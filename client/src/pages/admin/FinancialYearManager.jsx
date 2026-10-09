import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  PlusCircle,
  Lock,
  Unlock,
  Info,
  ShieldCheck,
  TrendingDown,
  FileCheck,
  Sparkles,
  HelpCircle,
  RefreshCw,
  ChevronRight,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { getFinancialYears, createFinancialYear, closeFinancialYear, reopenFinancialYear } from '../../api/masters';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function FinancialYearManager() {
  const { user } = useAuth();
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeAll, setIncludeAll] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [selectedFY, setSelectedFY] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [newCode, setNewCode] = useState('');
  const [newRemarks, setNewRemarks] = useState('');
  const [closeRemarks, setCloseRemarks] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [reopenAuth, setReopenAuth] = useState('');

  const loadYears = async () => {
    try {
      setLoading(true);
      const res = await getFinancialYears({ include_all: includeAll });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.data?.data || []));
      setYears(list);
    } catch (err) {
      console.error('Failed to load FYs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadYears();
  }, [includeAll]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(newCode)) {
      toast.error('Financial Year must be in format YYYY-YY (e.g. 2026-27)');
      return;
    }
    const startYear = parseInt(newCode.split('-')[0], 10);
    const expectedSuffix = String(startYear + 1).slice(2);
    if (newCode.split('-')[1] !== expectedSuffix) {
      toast.error(`Invalid year suffix! For ${startYear}, format must be ${startYear}-${expectedSuffix}`);
      return;
    }

    try {
      setSubmitting(true);
      await createFinancialYear({ code: newCode, remarks: newRemarks });
      toast.success(`Financial Year ${newCode} created successfully!`);
      setShowCreateModal(false);
      setNewCode('');
      setNewRemarks('');
      loadYears();
    } catch (_err) {
      // Error toast already displayed by Axios interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    if (!selectedFY) return;
    try {
      setSubmitting(true);
      await closeFinancialYear(selectedFY.code, { remarks: closeRemarks });
      toast.success(`Financial Year ${selectedFY.code} closed. Subsequent year initialized.`);
      setShowCloseModal(false);
      setSelectedFY(null);
      setCloseRemarks('');
      loadYears();
    } catch (err) {
      const details = err?.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        toast.error(
          <div>
            <p className="font-semibold">{err?.response?.data?.error || 'Pre-close requirements unmet:'}</p>
            <ul className="list-disc pl-4 text-xs mt-1 space-y-0.5">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>,
          { duration: 6000 }
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async (e) => {
    e.preventDefault();
    if (!selectedFY) return;
    if (!reopenReason || !reopenAuth) {
      toast.error('Please specify both Reason and Authorization');
      return;
    }
    try {
      setSubmitting(true);
      await reopenFinancialYear(selectedFY.code, { reason: reopenReason, authorization: reopenAuth });
      toast.success(`Financial Year ${selectedFY.code} reopened.`);
      setShowReopenModal(false);
      setSelectedFY(null);
      setReopenReason('');
      setReopenAuth('');
      loadYears();
    } catch (_err) {
      // Error toast already displayed by Axios interceptor
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* ── Top Header Banner ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Fiscal Architecture & Controls
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Rule 43 GFR & KVS Accounts Code
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Financial Year Management
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Configure, monitor, and manage the accounting periods governing all asset additions, CS-24 stock movements, annual verifications, and Schedule 4 depreciation runs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Financial Year</span>
            </button>
            <button
              onClick={loadYears}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-sm font-medium border border-white/15 transition-all cursor-pointer"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Educational Guide Cards (How FY Works in KVS Asset Portal) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: The Accounting Period */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1.5">1. April 1 – March 31 Cycle</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            In accordance with Government of India and KVS Accounts Code, each Financial Year spans from <strong>1st April</strong> to <strong>31st March</strong> of the subsequent year. All physical stock registers (CS-24) and asset registers (GFR-22) align to this standard cycle.
          </p>
        </div>

        {/* Card 2: Auto-Detection & Flexibility */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1.5">2. Smart Auto-Detection</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            The system <strong>auto-detects the current fiscal year</strong> from today's calendar date and auto-selects it across dropdowns for effortless data entry. However, the system is <strong>fully flexible</strong>: Admins and staff can view, report, or inspect any past or configured FY without lock-in.
          </p>
        </div>

        {/* Card 3: Year-End Close & Roll-Forward */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1.5">3. Year-End Close & Safeguards</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Closing a financial year is protected by pre-close validation: <strong>annual verification must be complete</strong>, <strong>depreciation must be run</strong>, and <strong>pending condemnations cleared</strong>. Once closed, closing balances carry forward as opening balances for the next cycle.
          </p>
        </div>
      </div>

      {/* ── Filter & Options Bar ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Filter View:
          </label>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setIncludeAll(true)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                includeAll ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Financial Years ({years.length})
            </button>
            <button
              onClick={() => setIncludeAll(false)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                !includeAll ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard Active FYs Only
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          <span>Historical FYs created during system adoption baseline are flagged as <span className="font-semibold text-slate-700">System Generated</span>.</span>
        </div>
      </div>

      {/* ── Financial Years Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>Configured Financial Years</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {years.length} records
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-sm">Loading financial years...</span>
          </div>
        ) : years.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium">No financial years found</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Create Financial Year" to add the first fiscal period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3">Financial Year</th>
                  <th className="px-5 py-3">Period Duration</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Depreciation</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Remarks</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {years.map((fy) => (
                  <tr
                    key={fy.id || fy.code}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      fy.is_current ? 'bg-blue-50/30 font-medium' : ''
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{fy.code}</span>
                        {fy.is_current && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            Current FY
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div>
                        {formatDate(fy.start_date)} <span className="text-slate-400">to</span> {formatDate(fy.end_date)}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {fy.is_closed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Lock className="w-3 h-3 text-slate-500" /> Closed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Unlock className="w-3 h-3 text-emerald-600" /> Active (Open)
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs">
                      {fy.depreciation_run ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Calculated & Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5" /> Not Run Yet
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs">
                      {fy.is_system_generated ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Adoption Baseline
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                          Standard
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate" title={fy.remarks || '—'}>
                      {fy.remarks || '—'}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!fy.is_closed ? (
                          <button
                            onClick={() => {
                              setSelectedFY(fy);
                              setShowCloseModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Close Financial Year at Year End"
                          >
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span>Close FY</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedFY(fy);
                              setShowReopenModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                            title="Reopen for Audit Corrections"
                          >
                            <Unlock className="w-3 h-3 text-amber-600" />
                            <span>Reopen</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Create New Financial Year ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Create New Financial Year</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Add a new fiscal year period into the system. Dates will automatically be set from <strong>1st April</strong> to <strong>31st March</strong>.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Financial Year Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2027-28"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.trim())}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Must strictly follow the format <code className="bg-slate-100 px-1 py-0.5 rounded">YYYY-YY</code>.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Regular annual accounting cycle"
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create FY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Close Financial Year ── */}
      {showCloseModal && selectedFY && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Close Financial Year {selectedFY.code}</h3>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Prerequisites Checked by System:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-700">
                <li>Annual Physical Verification completed for all operational departments.</li>
                <li>Depreciation run and Schedule 4 finalized.</li>
                <li>No pending or under-review condemnation entries (CS-49).</li>
              </ul>
            </div>

            <p className="text-xs text-slate-600">
              Closing this fiscal year will lock all transactions and automatically provision the subsequent year <span className="font-bold text-slate-800">
                {parseInt(selectedFY.code.split('-')[0], 10) + 1}-{String(parseInt(selectedFY.code.split('-')[0], 10) + 2).slice(2)}
              </span>.
            </p>

            <form onSubmit={handleClose} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Closure Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Accounts audited, depreciation locked, physical verification 100% completed."
                  value={closeRemarks}
                  onChange={(e) => setCloseRemarks(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Validating & Closing...' : 'Confirm & Close FY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Reopen Financial Year ── */}
      {showReopenModal && selectedFY && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Unlock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Reopen Financial Year {selectedFY.code}</h3>
              </div>
              <button
                onClick={() => setShowReopenModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Reopening a closed financial year is strictly an exceptional administrative action for audit rectification under Competent Authority approval.
            </p>

            <form onSubmit={handleReopen} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Reopening <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Rectification of AG Audit Para No. 4 regarding asset classification"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Competent Authority Authorization Ref <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KVS/RO/ACC/2026/Order-104 dt 15-05-2026"
                  value={reopenAuth}
                  onChange={(e) => setReopenAuth(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Reopening...' : 'Authorize & Reopen FY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
