import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import RegisterVidyalaya from './pages/RegisterVidyalaya';
import Dashboard from './pages/Dashboard';
import StockList from './pages/stock/StockList';
import StockForm from './pages/stock/StockForm';
import StockRegisterView from './pages/stock/StockRegisterView';
import AssetList from './pages/assets/AssetList';
import AssetForm from './pages/assets/AssetForm';
import AssetDetail from './pages/assets/AssetDetail';
import AssetGFR22Register from './pages/assets/AssetGFR22Register';
import OnboardingForm from './pages/assets/OnboardingForm';
import OpeningBalanceWizard from './pages/setup/OpeningBalanceWizard';
import VidyalayaProfile from './pages/setup/VidyalayaProfile';
import DangerZone from './pages/setup/DangerZone';
import RegisterView from './pages/assets/RegisterView';
import DepreciationRun from './pages/depreciation/DepreciationRun';
import DepreciationLedger from './pages/depreciation/DepreciationLedger';
import VerificationList from './pages/verification/VerificationList';
import VerificationForm from './pages/verification/VerificationForm';
import VerificationExecute from './pages/verification/VerificationExecute';
import VerificationReport from './pages/verification/VerificationReport';
import CondemnationList from './pages/condemnation/CondemnationList';
import CondemnationForm from './pages/condemnation/CondemnationForm';
import CondemnationDetail from './pages/condemnation/CondemnationDetail';
import SanctionList from './pages/sanctions/SanctionList';
import SanctionForm from './pages/sanctions/SanctionForm';
import DisposalList from './pages/disposal/DisposalList';
import DisposalForm from './pages/disposal/DisposalForm';
import DisposalDetail from './pages/disposal/DisposalDetail';
import ConsumableList from './pages/consumables/ConsumableList';
import IssueForm from './pages/consumables/IssueForm';
import ReturnForm from './pages/consumables/ReturnForm';

import DepartmentList from './pages/departments/DepartmentList';
import UserManagement from './pages/users/UserManagement';
import AuditLogs from './pages/audit/AuditLogs';
import SystemConfig from './pages/audit/SystemConfig';
import FinancialYearManager from './pages/admin/FinancialYearManager';
import WDVReferenceLetter from './pages/reference/WDVReferenceLetter';
import KVSLettersHub from './pages/reference/KVSLettersHub';
import SmallValueAssetsLetter from './pages/reference/SmallValueAssetsLetter';
import TransitionList from './pages/transition/TransitionList';
import TransitionForm from './pages/transition/TransitionForm';
import TransitionVerification from './pages/transition/TransitionVerification';
import TransitionDetail from './pages/transition/TransitionDetail';

import NonConsumableIssueList from './pages/non-consumables/NonConsumableIssueList';
import NonConsumableIssueForm from './pages/non-consumables/NonConsumableIssueForm';
import NonConsumableReturnForm from './pages/non-consumables/NonConsumableReturnForm';
import MobileInstallBanner from './components/MobileInstallBanner';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontSize: '13px' } }} />
        <MobileInstallBanner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterVidyalaya />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />

            {/* Masters & Admin Modules */}
            <Route path="setup/profile" element={<ProtectedRoute adminOnly={true}><VidyalayaProfile /></ProtectedRoute>} />
            <Route path="setup/danger-zone" element={<Navigate to="/setup/profile" replace />} />
            <Route path="departments" element={<ProtectedRoute module="departments"><DepartmentList /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute module="users"><UserManagement /></ProtectedRoute>} />
            <Route path="financial-years" element={<ProtectedRoute adminOnly={true}><FinancialYearManager /></ProtectedRoute>} />
            <Route path="audit" element={<ProtectedRoute module="audit"><AuditLogs /></ProtectedRoute>} />

            {/* Stock Module */}
            <Route path="stock" element={<ProtectedRoute module="stock"><StockList /></ProtectedRoute>} />
            <Route path="stock/new" element={<ProtectedRoute module="stock"><StockForm /></ProtectedRoute>} />
            <Route path="stock/register" element={<ProtectedRoute module="stock"><StockRegisterView /></ProtectedRoute>} />
            <Route path="stock/issue" element={<ProtectedRoute module="stock"><IssueForm /></ProtectedRoute>} />
            <Route path="stock/return" element={<ProtectedRoute module="stock"><ReturnForm /></ProtectedRoute>} />

            {/* Assets Module — TRUE GFR-22 Register */}
            <Route path="assets" element={<ProtectedRoute module="assets"><AssetList /></ProtectedRoute>} />
            <Route path="assets/new" element={<ProtectedRoute module="assets"><AssetForm /></ProtectedRoute>} />
            <Route path="assets/onboard" element={<ProtectedRoute adminOnly={true}><OnboardingForm /></ProtectedRoute>} />
            <Route path="assets/opening-balance" element={<ProtectedRoute adminOnly={true}><OpeningBalanceWizard /></ProtectedRoute>} />
            <Route path="setup/opening-balance" element={<ProtectedRoute adminOnly={true}><OpeningBalanceWizard /></ProtectedRoute>} />
            <Route path="assets/:id" element={<ProtectedRoute module="assets"><AssetDetail /></ProtectedRoute>} />
            <Route path="assets/register" element={<ProtectedRoute module="assets"><AssetGFR22Register /></ProtectedRoute>} />

            {/* Schedule 4 — Financial Summary (Admin only) */}
            <Route path="schedule4" element={<ProtectedRoute module="schedule4"><RegisterView /></ProtectedRoute>} />

            {/* Depreciation Module */}
            <Route path="depreciation" element={<ProtectedRoute module="depreciation"><DepreciationRun /></ProtectedRoute>} />
            <Route path="depreciation/ledger" element={<ProtectedRoute module="depreciation"><DepreciationLedger /></ProtectedRoute>} />
            {/* KVS Letters Reference Module */}
            <Route path="reference/letters" element={<ProtectedRoute adminOnly={true}><KVSLettersHub /></ProtectedRoute>} />
            <Route path="reference/letters/wdv-adoption" element={<ProtectedRoute adminOnly={true}><WDVReferenceLetter /></ProtectedRoute>} />
            <Route path="reference/letters/small-value-assets" element={<ProtectedRoute adminOnly={true}><SmallValueAssetsLetter /></ProtectedRoute>} />
            {/* Legacy redirect — keep old link working */}
            <Route path="reference/wdv-letter" element={<ProtectedRoute adminOnly={true}><WDVReferenceLetter /></ProtectedRoute>} />

            {/* Verification Module */}
            <Route path="verification" element={<ProtectedRoute module="verification"><VerificationList /></ProtectedRoute>} />
            <Route path="verification/new" element={<ProtectedRoute module="verification"><VerificationForm /></ProtectedRoute>} />
            <Route path="verification/:id" element={<ProtectedRoute module="verification"><VerificationExecute /></ProtectedRoute>} />
            <Route path="verification/:id/report" element={<ProtectedRoute module="verification"><VerificationReport /></ProtectedRoute>} />

            {/* Condemnation Module */}
            <Route path="condemnation" element={<ProtectedRoute module="condemnation"><CondemnationList /></ProtectedRoute>} />
            <Route path="condemnation/new" element={<ProtectedRoute module="condemnation"><CondemnationForm /></ProtectedRoute>} />
            <Route path="condemnation/:id" element={<ProtectedRoute module="condemnation"><CondemnationDetail /></ProtectedRoute>} />

            {/* Sanctions Module */}
            <Route path="sanctions" element={<ProtectedRoute module="sanctions"><SanctionList /></ProtectedRoute>} />
            <Route path="sanctions/new" element={<ProtectedRoute module="sanctions"><SanctionForm /></ProtectedRoute>} />

            {/* Disposal Module */}
            <Route path="disposal" element={<ProtectedRoute module="disposal"><DisposalList /></ProtectedRoute>} />
            <Route path="disposal/new" element={<ProtectedRoute module="disposal"><DisposalForm /></ProtectedRoute>} />
            <Route path="disposal/:id" element={<ProtectedRoute module="disposal"><DisposalDetail /></ProtectedRoute>} />

            {/* Stock Charge Transfer Module (Admin Only) */}
            <Route path="transitions" element={<ProtectedRoute adminOnly={true}><TransitionList /></ProtectedRoute>} />
            <Route path="transitions/new" element={<ProtectedRoute adminOnly={true}><TransitionForm /></ProtectedRoute>} />
            <Route path="transitions/:id" element={<ProtectedRoute adminOnly={true}><TransitionDetail /></ProtectedRoute>} />
            <Route path="transitions/:id/verify" element={<ProtectedRoute adminOnly={true}><TransitionVerification /></ProtectedRoute>} />

            {/* Non-Consumable Custody Management Module */}
            <Route path="stock/custody" element={<ProtectedRoute module="stock"><NonConsumableIssueList /></ProtectedRoute>} />
            <Route path="stock/custody/issue" element={<ProtectedRoute module="stock"><NonConsumableIssueForm /></ProtectedRoute>} />
            <Route path="stock/custody/return" element={<ProtectedRoute module="stock"><NonConsumableReturnForm /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
