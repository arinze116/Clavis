import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingState } from "./components/ScreenState";
import { usePageTitle } from "./hooks/usePageTitle";
import Landing from "./pages/Landing";

const AuditLog = lazy(() => import("./pages/AuditLog"));
const BusinessDashboard = lazy(() => import("./pages/BusinessDashboard"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Loading Clavis" />}>
      <Routes>
        <Route
          path="/"
          element={
            <RouteBoundary title="Clavis — Private Cross-Chain Payroll">
              <Landing />
            </RouteBoundary>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RouteBoundary title="Business Console · Clavis">
              <BusinessDashboard />
            </RouteBoundary>
          }
        />
        <Route
          path="/worker"
          element={
            <RouteBoundary title="Worker Portal · Clavis">
              <WorkerDashboard />
            </RouteBoundary>
          }
        />
        <Route
          path="/audit"
          element={
            <RouteBoundary title="Public Audit · Clavis">
              <AuditLog />
            </RouteBoundary>
          }
        />
        <Route
          path="/setup"
          element={
            <RouteBoundary title="Setup · Clavis">
              <SetupWizard />
            </RouteBoundary>
          }
        />
        <Route
          path="/privacy"
          element={
            <RouteBoundary title="Privacy · Clavis">
              <PrivacyPolicy />
            </RouteBoundary>
          }
        />
        <Route
          path="/terms"
          element={
            <RouteBoundary title="Terms · Clavis">
              <TermsOfUse />
            </RouteBoundary>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function RouteBoundary({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title);
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
