import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingState } from "./components/ScreenState";
import { usePageMetadata } from "./hooks/usePageMetadata";
import Landing from "./pages/Landing";

const AuditLog = lazy(() => import("./pages/AuditLog"));
const BusinessDashboard = lazy(() => import("./pages/BusinessDashboard"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GuideLanding = lazy(() => import("./pages/guide/GuideLanding"));
const BusinessGuide = lazy(() => import("./pages/guide/BusinessGuide"));
const WorkerGuide = lazy(() => import("./pages/guide/WorkerGuide"));
const DeveloperGuide = lazy(() => import("./pages/guide/DeveloperGuide"));

const descriptions = {
  home: "Private, rule-bound cross-chain payroll on NEAR with autonomous scheduling and public-safe audit proofs.",
  dashboard: "Manage Clavis treasury rules, recipients, security controls, anomalies, and AI payroll reports.",
  worker: "Register your NEAR testnet wallet, choose a settlement route, and verify payroll decisions.",
  audit: "Inspect Clavis payroll approvals and rejections without exposing salary, recipient, or destination data.",
  setup: "Deploy and configure an isolated Clavis payroll contract on NEAR testnet.",
  guide: "Step-by-step guides for Clavis business owners, workers, and developers.",
  businessGuide:
    "Deploy, fund, secure, and monitor an autonomous Clavis payroll contract as a business owner.",
  workerGuide:
    "Create a NEAR testnet wallet, join an employer roster, receive payments, and review payroll history.",
  developerGuide:
    "Run Clavis locally and understand its Rust contracts, TypeScript agent, React client, and NEAR architecture.",
  privacy: "Understand the privacy boundary and data handling model used by Clavis.",
  terms: "Clavis testnet terms of use and software limitations.",
  missing: "The requested Clavis page could not be found.",
};

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Loading Clavis" />}>
      <Routes>
        <Route
          path="/"
          element={
            <RouteBoundary
              title="Clavis — Private Cross-Chain Payroll on NEAR"
              description={descriptions.home}
            >
              <Landing />
            </RouteBoundary>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RouteBoundary title="Business Console · Clavis" description={descriptions.dashboard}>
              <BusinessDashboard />
            </RouteBoundary>
          }
        />
        <Route
          path="/worker"
          element={
            <RouteBoundary title="Worker Portal · Clavis" description={descriptions.worker}>
              <WorkerDashboard />
            </RouteBoundary>
          }
        />
        <Route
          path="/audit"
          element={
            <RouteBoundary title="Public Audit Log · Clavis" description={descriptions.audit}>
              <AuditLog />
            </RouteBoundary>
          }
        />
        <Route
          path="/setup"
          element={
            <RouteBoundary title="Configure Payroll · Clavis" description={descriptions.setup}>
              <SetupWizard />
            </RouteBoundary>
          }
        />
        <Route
          path="/guide"
          element={
            <RouteBoundary title="How to Use Clavis · Guide" description={descriptions.guide}>
              <GuideLanding />
            </RouteBoundary>
          }
        />
        <Route
          path="/guide/business"
          element={
            <RouteBoundary
              title="Business Owner Guide · Clavis"
              description={descriptions.businessGuide}
            >
              <BusinessGuide />
            </RouteBoundary>
          }
        />
        <Route
          path="/guide/worker"
          element={
            <RouteBoundary title="Worker Guide · Clavis" description={descriptions.workerGuide}>
              <WorkerGuide />
            </RouteBoundary>
          }
        />
        <Route
          path="/guide/developer"
          element={
            <RouteBoundary
              title="Developer Guide · Clavis"
              description={descriptions.developerGuide}
            >
              <DeveloperGuide />
            </RouteBoundary>
          }
        />
        <Route
          path="/privacy"
          element={
            <RouteBoundary title="Privacy · Clavis" description={descriptions.privacy}>
              <PrivacyPolicy />
            </RouteBoundary>
          }
        />
        <Route
          path="/terms"
          element={
            <RouteBoundary title="Terms · Clavis" description={descriptions.terms}>
              <TermsOfUse />
            </RouteBoundary>
          }
        />
        <Route
          path="*"
          element={
            <RouteBoundary title="Page not found · Clavis" description={descriptions.missing}>
              <NotFound />
            </RouteBoundary>
          }
        />
      </Routes>
    </Suspense>
  );
}

function RouteBoundary({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  usePageMetadata(title, description);
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
