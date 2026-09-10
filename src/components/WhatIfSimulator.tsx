import React, { useState } from 'react';
import { Sliders, ArrowRightLeft, ShieldAlert, CheckCircle, AlertTriangle, Play, Sparkles, RefreshCw } from 'lucide-react';
import { AssessmentResponse, WhatIfComparison } from '../types';

interface WhatIfSimulatorProps {
  assessment: AssessmentResponse;
}

const PRESET_SCENARIOS = [
  {
    id: 'staging',
    label: 'Deploy to staging first',
    description: 'Reroute the change to non-production staging environment to validate stability before live traffic.',
  },
  {
    id: 'safeguards',
    label: 'Add safeguards',
    description: 'Implement automated rollback alarms, dual-peer review, and 5% canary traffic stepping.',
  },
  {
    id: 'blast-radius',
    label: 'Reduce blast radius',
    description: 'Decouple non-essential dependencies and isolate ingress traffic to contain failure impact.',
  },
  {
    id: 'no-safeguards',
    label: 'Proceed without safeguards',
    description: 'Immediate all-at-once deployment bypassing verification windows and canaries.',
  },
];

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({ assessment }) => {
  const [selectedScenario, setSelectedScenario] = useState(PRESET_SCENARIOS[0].label);
  const [simulation, setSimulation] = useState<WhatIfComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async (scenarioToRun: string) => {
    setIsLoading(true);
    setError(null);

    const payloadEvidence = {
      change: assessment.change,
      resource: assessment.resource,
      risk_assessment: assessment.riskAssessment,
      dependencies: assessment.dependencies,
      incidents: assessment.incidents,
    };

    try {
      const response = await fetch('/api/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenarioToRun,
          evidence: payloadEvidence,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.slice(0, 150)}`);
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || `Server returned ${response.status}: Failed to run simulation`);
      }

      setSimulation(data.simulation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load or when scenario changes
  const handleScenarioChange = (scenarioLabel: string) => {
    setSelectedScenario(scenarioLabel);
    runSimulation(scenarioLabel);
  };

  React.useEffect(() => {
    runSimulation(PRESET_SCENARIOS[0].label);
  }, [assessment.change.change_id]);

  return (
    <section id="what-if-simulator-section" className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" /> 5. Analytical Scenario Modeling
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            WHAT-IF SIMULATOR
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-amber-950/40 border border-amber-900/60 text-amber-300 font-mono text-xs">
            What-If analysis • No infrastructure changes
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-6 shadow-xl space-y-6">
        {/* Scenario Selection Tabs */}
        <div>
          <label className="text-xs font-mono uppercase text-slate-400 block mb-2 font-semibold">
            Choose What-If Scenario to Simulate:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRESET_SCENARIOS.map((scenario) => {
              const isSelected = selectedScenario === scenario.label;
              return (
                <button
                  key={scenario.id}
                  id={`scenario-btn-${scenario.id}`}
                  onClick={() => handleScenarioChange(scenario.label)}
                  disabled={isLoading}
                  className={`p-3.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/30 text-white shadow-md shadow-cyan-950/30'
                      : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs font-mono tracking-tight">
                      {scenario.label}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400"></span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {scenario.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
            <p className="text-xs text-slate-300 font-mono">
              Running What-If simulation against BigQuery evidence...
            </p>
          </div>
        )}

        {/* Side-by-Side Comparison: CURRENT vs WHAT-IF */}
        {!isLoading && simulation && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CURRENT STATE */}
              <div
                id="comparison-current-card"
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 shadow-inner"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
                    CURRENT STATE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                    Baseline Evidence
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-0.5">
                      Risk Assessment
                    </span>
                    <p className="text-slate-200 font-medium">
                      {simulation.current.riskAssessment}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-0.5">
                      Potential Blast Radius
                    </span>
                    <p className="text-slate-300">
                      {simulation.current.potentialBlastRadius}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-0.5">
                      Historical Evidence
                    </span>
                    <p className="text-slate-300">
                      {simulation.current.historicalEvidence}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-0.5">
                      Production Exposure
                    </span>
                    <p className="text-slate-300">
                      {simulation.current.productionExposure}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-1">
                      Current Safeguards
                    </span>
                    <ul className="list-disc list-inside text-slate-400 space-y-1">
                      {simulation.current.recommendedSafeguards.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* WHAT-IF SCENARIO */}
              <div
                id="comparison-whatif-card"
                className="rounded-xl border border-cyan-800/60 bg-gradient-to-br from-cyan-950/20 via-slate-950/70 to-slate-950 p-5 shadow-lg shadow-cyan-950/20"
              >
                <div className="flex items-center justify-between pb-3 border-b border-cyan-900/40 mb-4">
                  <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> WHAT-IF: {simulation.scenario}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[11px]">
                    Simulated Profile
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-cyan-400/80 font-mono uppercase text-[10px] block mb-0.5">
                      Simulated Risk Assessment
                    </span>
                    <p className="text-slate-100 font-semibold">
                      {simulation.whatIf.riskAssessment}
                    </p>
                  </div>

                  <div>
                    <span className="text-cyan-400/80 font-mono uppercase text-[10px] block mb-0.5">
                      Simulated Blast Radius
                    </span>
                    <p className="text-slate-200">
                      {simulation.whatIf.potentialBlastRadius}
                    </p>
                  </div>

                  <div>
                    <span className="text-cyan-400/80 font-mono uppercase text-[10px] block mb-0.5">
                      Historical Relevance
                    </span>
                    <p className="text-slate-200">
                      {simulation.whatIf.historicalEvidence}
                    </p>
                  </div>

                  <div>
                    <span className="text-cyan-400/80 font-mono uppercase text-[10px] block mb-0.5">
                      Production Exposure
                    </span>
                    <p className="text-slate-200">
                      {simulation.whatIf.productionExposure}
                    </p>
                  </div>

                  <div>
                    <span className="text-cyan-400/80 font-mono uppercase text-[10px] block mb-1">
                      Recommended Safeguards
                    </span>
                    <ul className="list-disc list-inside text-cyan-200/90 space-y-1">
                      {simulation.whatIf.recommendedSafeguards.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Qualitative Synthesis Note */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
              <span className="px-2 py-1 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 text-[10px] font-mono uppercase shrink-0 mt-0.5">
                What-If analysis
              </span>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {simulation.analysis}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
