import { lazy, Suspense, type ReactNode } from "react";
import { Link, Route, Routes } from "react-router-dom";

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
const SecurityEvidence = lazy(() => import("./pages/SecurityEvidence"));

const descriptions = {
  home: "Privacy-minimized, rule-bound payroll automation with public audit and security evidence on NEAR testnet.",
  dashboard: "Inspect live Clavis treasury, policy, roster, anomalies, and audit evidence without connecting a wallet.",
  worker: "Register your NEAR testnet wallet, choose a settlement route, and verify payroll decisions.",
  audit: "Inspect privacy-minimized Clavis payroll decisions with the public NEAR transaction boundary disclosed.",
  security: "Review Clavis threat cases, source-linked tests, CI evidence, and documented limitations.",
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
              title="Clavis — Rule-Bound Payroll on NEAR"
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
              <Suspense fallback={<DashboardRouteFallback />}>
                <BusinessDashboard />
              </Suspense>
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
          path="/security"
          element={
            <RouteBoundary title="Security Evidence · Clavis" description={descriptions.security}>
              <SecurityEvidence />
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

function DashboardRouteFallback() {
  return (
    <div className="min-h-screen bg-canvas px-5 py-10 text-ink lg:px-10 lg:py-16">
      <main className="mx-auto max-w-[1360px]">
        <div className="rounded-[28px] border border-moss/20 bg-[#eef3e9] p-6 sm:p-8">
          <p className="eyebrow">Public business console</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            Inspect the payroll system before connecting.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-ink/55">
            The live `clavis.testnet` snapshot is loading. Audit and security evidence remain
            publicly accessible without a wallet; owner controls require a signed transaction.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link className="button-secondary" to="/audit">Open public audit</Link>
            <Link className="button-secondary" to="/security">Open security evidence</Link>
            <a
              className="button-secondary"
              href="https://testnet.nearblocks.io/address/clavis.testnet"
              target="_blank"
              rel="noreferrer"
            >
              Open contract explorer
            </a>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {["Live treasury", "Roster policy", "Authorization decisions"].map((label) => (
            <section key={label} className="panel p-6">
              <p className="text-xs font-semibold text-ink/45">{label}</p>
              <div className="mt-4 h-9 w-24 animate-pulse rounded-lg bg-ink/10" />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
