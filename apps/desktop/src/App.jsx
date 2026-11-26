import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './services/auth.jsx';
import LicenseGate from './components/LicenseGate.jsx';
import { PageLoader, PermissionDenied } from './components/ui/States.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import ZhaWaterLoader from './components/ui/ZhaWaterLoader.jsx';
import ChangePasswordPage from './pages/auth/ChangePasswordPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PatientListPage from './pages/patients/PatientListPage.jsx';
import PatientFormPage from './pages/patients/PatientFormPage.jsx';
import PatientProfilePage from './pages/patients/PatientProfilePage.jsx';
import AppointmentsPage from './pages/appointments/AppointmentsPage.jsx';
import QueuePage from './pages/appointments/QueuePage.jsx';
import RecallsPage from './pages/recalls/RecallsPage.jsx';
import ConsultationsPage from './pages/consultations/ConsultationsPage.jsx';
import ConsultationWorkspacePage from './pages/consultations/ConsultationWorkspacePage.jsx';
import DentalChartPage from './pages/chart/DentalChartPage.jsx';
import TreatmentPlansPage from './pages/plans/TreatmentPlansPage.jsx';
import TreatmentPlanDetailPage from './pages/plans/TreatmentPlanDetailPage.jsx';
import PrescriptionsPage from './pages/prescriptions/PrescriptionsPage.jsx';
import InvoicesPage from './pages/billing/InvoicesPage.jsx';
import InvoiceFormPage from './pages/billing/InvoiceFormPage.jsx';
import InvoiceDetailPage from './pages/billing/InvoiceDetailPage.jsx';
import PaymentsPage from './pages/billing/PaymentsPage.jsx';
import ClaimsPage from './pages/billing/ClaimsPage.jsx';
import InventoryPage from './pages/inventory/InventoryPage.jsx';
import LabsPage from './pages/labs/LabsPage.jsx';
import ReportsPage from './pages/reports/ReportsPage.jsx';
import MastersPage from './pages/admin/MastersPage.jsx';
import UsersPage from './pages/admin/UsersPage.jsx';
import ClinicSettingsPage from './pages/admin/ClinicSettingsPage.jsx';
import BackupsPage from './pages/admin/BackupsPage.jsx';
import AuditLogsPage from './pages/admin/AuditLogsPage.jsx';
import PatientKioskPage from './pages/patients/PatientKioskPage.jsx';
import TamilanAdminPage from './pages/admin/TamilanAdminPage.jsx';

function Protected({ permission, children }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl">
        <ZhaWaterLoader
          progress={70}
          autoAnimate
          statusText="Restoring session…"
          tamilStatusText="அமர்வு மீட்டமைக்கப்படுகிறது…"
          compact
        />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (permission && !user.permissions?.includes(permission)) {
    return (
      <AppLayout>
        <PermissionDenied />
      </AppLayout>
    );
  }
  return children;
}

function Shell({ permission, children }) {
  return (
    <Protected permission={permission}>
      <AppLayout>{children}</AppLayout>
    </Protected>
  );
}

/**
 * RefreshSplash
 * Displays the serene Tamil "ழ" water-filling animation whenever the application
 * is reloaded or refreshed, rising steadily at a calm and leisurely pace.
 */
function RefreshSplash({ onFinish }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing clinic workspace…');
  const [tamilStatusText, setTamilStatusText] = useState('பயனாளர் அமர்வு சரிபார்ப்பு…');
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let current = 0;
    // Slow, serene fluid water rising over ~2.8 seconds (38ms * 72 steps)
    const timer = setInterval(() => {
      current += 1.4;
      if (current >= 100) {
        current = 100;
        clearInterval(timer);
        setProgress(100);
        setStatusText('Welcome to ZhanX DentalCare!');
        setTamilStatusText('நல்வரவு! ZhanX பல் மருத்துவமனை…');
        setTimeout(() => {
          setFading(true);
          setTimeout(() => {
            onFinish();
          }, 450);
        }, 400);
      } else {
        setProgress(current);
        if (current >= 75) {
          setStatusText('Preparing operatory & dental records…');
          setTamilStatusText('பல் மருத்துவப் பிரிவு ஆயத்தப்படுத்துதல்…');
        } else if (current >= 45) {
          setStatusText('Connecting clinical database…');
          setTamilStatusText('மருத்துவமனை தரவுத்தள இணைப்பு…');
        } else if (current >= 20) {
          setStatusText('Verifying security & clinic license…');
          setTamilStatusText('பாதுகாப்பு & உரிமம் சரிபார்ப்பு…');
        }
      }
    }, 38);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <ZhaWaterLoader
        progress={progress}
        statusText={statusText}
        tamilStatusText={tamilStatusText}
      />
    </div>
  );
}

export default function App() {
  const { user, booting } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      {!splashDone && <RefreshSplash onFinish={() => setSplashDone(true)} />}
      <LicenseGate>
      <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/change-password"
        element={
          booting ? (
            <PageLoader />
          ) : user ? (
            <ChangePasswordPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="/" element={<Shell permission="dashboard.view"><DashboardPage /></Shell>} />

      <Route path="/patients" element={<Shell permission="patients.view"><PatientListPage /></Shell>} />
      <Route path="/patients/new" element={<Shell permission="patients.create"><PatientFormPage /></Shell>} />
      <Route path="/patients/:id" element={<Shell permission="patients.view"><PatientProfilePage /></Shell>} />
      <Route path="/patients/:id/edit" element={<Shell permission="patients.edit"><PatientFormPage /></Shell>} />

      <Route path="/appointments" element={<Shell permission="appointments.view"><AppointmentsPage /></Shell>} />
      <Route path="/queue" element={<Shell permission="queue.view"><QueuePage /></Shell>} />
      <Route path="/recalls" element={<Shell permission="patients.view"><RecallsPage /></Shell>} />

      <Route path="/consultations" element={<Shell permission="consultations.view"><ConsultationsPage /></Shell>} />
      <Route path="/consultations/:id" element={<Shell permission="consultations.view"><ConsultationWorkspacePage /></Shell>} />

      <Route path="/dental-chart" element={<Shell permission="chart.view"><DentalChartPage /></Shell>} />
      <Route path="/dental-chart/:patientId" element={<Shell permission="chart.view"><DentalChartPage /></Shell>} />

      <Route path="/treatment-plans" element={<Shell permission="plans.view"><TreatmentPlansPage /></Shell>} />
      <Route path="/treatment-plans/:id" element={<Shell permission="plans.view"><TreatmentPlanDetailPage /></Shell>} />

      <Route path="/prescriptions" element={<Shell permission="prescriptions.view"><PrescriptionsPage /></Shell>} />

      <Route path="/invoices" element={<Shell permission="invoices.view"><InvoicesPage /></Shell>} />
      <Route path="/invoices/new" element={<Shell permission="invoices.manage"><InvoiceFormPage /></Shell>} />
      <Route path="/invoices/:id" element={<Shell permission="invoices.view"><InvoiceDetailPage /></Shell>} />
      <Route path="/payments" element={<Shell permission="payments.view"><PaymentsPage /></Shell>} />
      <Route path="/claims" element={<Shell permission="claims.view"><ClaimsPage /></Shell>} />

      <Route path="/inventory" element={<Shell permission="inventory.view"><InventoryPage /></Shell>} />
      <Route path="/labs" element={<Shell permission="labs.view"><LabsPage /></Shell>} />
      <Route path="/reports" element={<Shell permission="reports.view"><ReportsPage /></Shell>} />

      <Route path="/masters" element={<Shell permission="settings.manage"><MastersPage /></Shell>} />
      <Route path="/admin/users" element={<Shell permission="users.manage"><UsersPage /></Shell>} />
      <Route path="/admin/clinic" element={<Shell permission="settings.manage"><ClinicSettingsPage /></Shell>} />
      <Route path="/admin/backups" element={<Shell permission="backups.manage"><BackupsPage /></Shell>} />
      <Route path="/admin/audit" element={<Shell permission="audit.view"><AuditLogsPage /></Shell>} />

      {/* Reception Self-Registration Tablet Kiosk */}
      <Route path="/kiosk" element={<PatientKioskPage />} />

      {/* Super Admin & Master Platform Control */}
      <Route path="/super-admin" element={<TamilanAdminPage />} />
      <Route path="/tamilan" element={<TamilanAdminPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LicenseGate>
    </>
  );
}
