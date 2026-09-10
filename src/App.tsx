import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { BigQueryErrorBanner } from './components/BigQueryErrorBanner';
import { ChangeSelector } from './components/ChangeSelector';
import { RiskOverview } from './components/RiskOverview';
import { BlastRadiusGraph } from './components/BlastRadiusGraph';
import { HistoricalIncidents } from './components/HistoricalIncidents';
import { ChangeGate } from './components/ChangeGate';
import { AssessmentResponse, BigQueryStatus, ChangeRecord } from './types';
import { AlertCircle, RefreshCw, Server, Shield, Sparkles } from 'lucide-react';

// Lazy-load expensive below-the-fold components to reduce initial bundle and render cost
const WhatIfSimulator = lazy(() =>
  import('./components/WhatIfSimulator').then((m) => ({ default: m.WhatIfSimulator }))
);
const EvidenceTrail = lazy(() =>
  import('./components/EvidenceTrail').then((m) => ({ default: m.EvidenceTrail }))
);

export default function App() {
  const [bqStatus, setBqStatus] = useState<BigQueryStatus | null>(null);
  const [geminiAvailable, setGeminiAvailable] = useState<boolean>(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(true);

  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [selectedChangeId, setSelectedChangeId] = useState<string>('');
  const [isLoadingChanges, setIsLoadingChanges] = useState<boolean>(false);

  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [isAssessing, setIsAssessing] = useState<boolean>(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  // In-memory cache for loaded assessments to provide instantaneous switching between changes
  const assessmentCache = useRef<Record<string, AssessmentResponse>>({});

  // 1. Check System Connectivity (BigQuery + Gemini) and load initial changes in parallel
  const checkStatusAndLoad = async () => {
    setIsCheckingStatus(true);
    setAssessmentError(null);

    const statusPromise = (async () => {
      try {
        const res = await fetch('/api/status');
        const contentType = res.headers.get('content-type') || '';
        let data: any = null;
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 150)}`);
        }
        setBqStatus(data.bigquery);
        setGeminiAvailable(data.gemini?.available ?? true);
        return data.bigquery?.connected ?? false;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setBqStatus({
          connected: false,
          error: 'BigQuery data unavailable',
          details: msg,
          project: 'project-89de941d-00d0-4f2f-98f',
          dataset: 'cloudshield',
        });
        return false;
      } finally {
        setIsCheckingStatus(false);
      }
    })();

    // Launch changes loading in parallel for fast initial render
    const changesPromise = loadChanges();

    const [bqConnected] = await Promise.all([statusPromise, changesPromise]);
    if (!bqConnected) {
      // If status confirms BigQuery is disconnected and changes could not be fetched
      setChanges((prev) => (prev.length > 0 ? prev : []));
    }
  };

  // 2. Load Changes from cloudshield.changes
  const loadChanges = async () => {
    setIsLoadingChanges(true);
    try {
      const res = await fetch('/api/changes');
      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 150)}`);
      }
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to load changes');
      }
      const fetchedChanges: ChangeRecord[] = data.changes || [];
      setChanges(fetchedChanges);

      if (fetchedChanges.length > 0) {
        const firstChange = fetchedChanges[0];
        setSelectedChangeId(firstChange.change_id);
        // Automatically assess initial change with parallel telemetry
        runAssessment(firstChange.change_id, firstChange.resource_id, false);
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssessmentError(msg);
      return false;
    } finally {
      setIsLoadingChanges(false);
    }
  };

  // 3. Assess Risk Pipeline: BigQuery Telemetry + Gemini Reasoning
  const runAssessment = async (changeId: string, resourceId?: string, force = false) => {
    if (!changeId) return;

    // Instant return if previously assessed in this session and not a forced reload
    if (!force && assessmentCache.current[changeId]) {
      setAssessment(assessmentCache.current[changeId]);
      return;
    }

    setIsAssessing(true);
    setAssessmentError(null);

    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, resourceId, force }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 150)}`);
      }

      if (!res.ok) {
        throw new Error(data.details || data.error || `HTTP ${res.status}: Failed to assess change`);
      }

      assessmentCache.current[changeId] = data;
      setAssessment(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssessmentError(msg);
    } finally {
      setIsAssessing(false);
    }
  };

  // Change selection handler
  const handleSelectChange = (newChangeId: string) => {
    setSelectedChangeId(newChangeId);
    const target = changes.find((c) => c.change_id === newChangeId);
    if (target) {
      runAssessment(target.change_id, target.resource_id, false);
    }
  };

  useEffect(() => {
    checkStatusAndLoad();
  }, []);

  const selectedChange = changes.find((c) => c.change_id === selectedChangeId) || changes[0];

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <Header
        bqStatus={bqStatus}
        geminiAvailable={geminiAvailable}
        onRefreshStatus={checkStatusAndLoad}
        isChecking={isCheckingStatus}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Failure Diagnostic Banner */}
        {bqStatus && !bqStatus.connected && (
          <BigQueryErrorBanner
            status={bqStatus}
            onRetry={checkStatusAndLoad}
            isRetrying={isCheckingStatus}
          />
        )}

        {/* General Assessment Error Notice if Any */}
        {assessmentError && (
          <div className="mb-6 p-4 rounded-xl border border-rose-900/80 bg-rose-950/40 text-rose-300 text-xs font-mono flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-200 block">Operation Warning:</span>
              <p className="mt-0.5 leading-relaxed">{assessmentError}</p>
            </div>
          </div>
        )}

        {/* Change Selector & Details Card */}
        <ChangeSelector
          changes={changes}
          selectedChangeId={selectedChangeId}
          onSelectChange={handleSelectChange}
          onAssessRisk={() => selectedChange && runAssessment(selectedChange.change_id, selectedChange.resource_id, true)}
          isAssessing={isAssessing}
          disabled={!bqStatus?.connected || isCheckingStatus}
        />

        {/* Loading State for Assessment */}
        {isAssessing && (
          <div className="my-12 p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/30">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-200">
              Gathering Real BigQuery Evidence &amp; Running Gemini Risk Reasoning...
            </p>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Correlating cloudshield.changes • resources • risk_assessment • dependencies_clean • incidents in parallel
            </p>
          </div>
        )}

        {/* Complete Assessment Modules (Loaded When Evidence Exists) */}
        {!isAssessing && assessment && (
          <div className="space-y-2 animate-fadeIn">
            {/* 2. Real Cloud Risk Assessment & AI Risk Explanation */}
            <RiskOverview assessment={assessment} />

            {/* 3. Blast Radius (Visual Dependency Graph) */}
            <BlastRadiusGraph
              graphData={assessment.dependencyGraph}
              selectedResourceId={selectedChange?.resource_id || assessment.change.resource_id}
              selectedResource={assessment.resource}
            />

            {/* 4. Historical Incidents */}
            <HistoricalIncidents
              incidents={assessment.incidents}
              resourceId={selectedChange?.resource_id || assessment.change.resource_id}
            />

            {/* 5. What-If Change Simulator (Lazy-loaded) */}
            <Suspense
              fallback={
                <div className="my-6 p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/30 text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading What-If Simulator...</span>
                </div>
              }
            >
              <WhatIfSimulator assessment={assessment} />
            </Suspense>

            {/* 6. Autonomous Policy Gate */}
            <ChangeGate
              changeGate={assessment.changeGate}
              changeId={assessment.change.change_id}
            />

            {/* 7. Evidence Trail (Lazy-loaded) */}
            <Suspense
              fallback={
                <div className="my-6 p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/30 text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading BigQuery Evidence Trail...</span>
                </div>
              }
            >
              <EvidenceTrail assessment={assessment} />
            </Suspense>
          </div>
        )}

        {/* BigQuery Unavailable Empty State Guidance */}
        {!isAssessing && !assessment && bqStatus && !bqStatus.connected && (
          <div className="my-12 p-10 rounded-2xl border border-slate-800 bg-slate-900/20 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
              <Server className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-200">
                Awaiting BigQuery Connection
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                CloudShield strictly preserves data fidelity and will not substitute simulated records. Once BigQuery access to{' '}
                <code className="text-cyan-300 font-mono">project-89de941d-00d0-4f2f-98f.cloudshield</code> is available, click &ldquo;Retry BigQuery&rdquo; to load live changes.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">CLOUDSHIELD</span>
            <span>•</span>
            <span>Understand the impact before you deploy</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 text-[11px]">
            <span>Google BigQuery (US)</span>
            <span>•</span>
            <span>Google Gemini 3.8 Flash</span>
            <span>•</span>
            <span>Cloud Run Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
