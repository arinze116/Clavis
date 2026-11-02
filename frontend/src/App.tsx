import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Landing from "./pages/Landing";

const AuditLog = lazy(() => import("./pages/AuditLog"));
const BusinessDashboard = lazy(() => import("./pages/BusinessDashboard"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-canvas text-sm text-ink/50">Loading Clavis…</div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<BusinessDashboard />} />
        <Route path="/worker" element={<WorkerDashboard />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
