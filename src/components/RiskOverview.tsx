import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Sparkles, Server, Flame, Activity, Layers, HelpCircle } from 'lucide-react';
import { AssessmentResponse } from '../types';

interface RiskOverviewProps {
  assessment: AssessmentResponse;
}

export const RiskOverview: React.FC<RiskOverviewProps> = ({ assessment }) => {
  const { riskAssessment, resource, aiExplanation, dependencyGraph, change } = assessment;

  // Stored risk level from risk_assessment table (source of truth)
  const rawRisk = (riskAssessment?.risk_level || 'UNKNOWN').toUpperCase();

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-500',
          border: 'border-rose-900/50',
          label: 'HIGH RISK',
          icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-500',
          border: 'border-amber-900/50',
          label: 'MEDIUM RISK',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
        };
      case 'LOW':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-500',
          border: 'border-emerald-900/50',
          label: 'LOW RISK',
          icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
        };
      default:
        return {
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          dot: 'bg-slate-500',
          border: 'border-slate-800',
          label: rawRisk,
          icon: <HelpCircle className="w-5 h-5 text-slate-400" />,
        };
    }
  };

  const riskStyle = getRiskBadge(rawRisk);
  const criticality = resource?.criticality || riskAssessment?.criticality || 'NOT SPECIFIED';
  const environment = resource?.environment || riskAssessment?.environment || 'NOT SPECIFIED';
  const incidentCount = riskAssessment?.historical_incident_count ?? assessment.incidents.length;
  const blastRadiusCount = dependencyGraph.totalAffected;
  const potentiallyAffected = riskAssessment?.potentially_affected_resource_count ?? blastRadiusCount;
  const changeCategory = change?.change_category || riskAssessment?.change_category || 'General';

  return (
    <section id="risk-assessment-section" className="mb-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> 2. Real Cloud Risk Assessment
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Telemetry Risk Signals
          </h2>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
          Source: cloudshield.risk_assessment
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Primary Risk Badge & Core Metric Tiles */}
        <div className="lg:col-span-1 space-y-4">
          {/* Prominent Risk Level Badge */}
          <div
            id="primary-risk-badge-card"
            className={`rounded-2xl border ${riskStyle.border} bg-slate-900/70 p-5 shadow-xl flex flex-col items-center justify-center text-center`}
          >
            <div className={`p-3.5 rounded-2xl border ${riskStyle.bg} mb-3 shadow-inner`}>
              {riskStyle.icon}
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">
              Database Stored Signal
            </span>
            <div className="text-3xl font-extrabold tracking-tight text-white mb-2">
              {riskStyle.label}
            </div>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Real signal from <code className="text-cyan-300 font-mono">risk_assessment.risk_level</code>. No synthetic score invented.
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1">
                Criticality
              </span>
              <span className={`font-mono font-bold text-sm uppercase ${
                criticality.toLowerCase() === 'critical' ? 'text-rose-400' : 'text-slate-200'
              }`}>
                {criticality}
              </span>
              <span className="text-slate-500 font-mono text-[10px] block mt-1">
                Resource Tier
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1">
                Environment
              </span>
              <span className={`font-mono font-bold text-sm uppercase ${
                environment.toLowerCase() === 'production' ? 'text-amber-400' : 'text-cyan-400'
              }`}>
                {environment}
              </span>
              <span className="text-slate-500 font-mono text-[10px] block mt-1">
                Deployment Target
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" /> Historical Incidents
              </span>
              <span className="font-mono font-bold text-lg text-white">
                {incidentCount}
              </span>
              <span className="text-slate-500 font-mono text-[10px] block mt-0.5">
                historical_incident_count
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" /> Blast Radius
              </span>
              <span className="font-mono font-bold text-lg text-cyan-300">
                {blastRadiusCount} <span className="text-xs text-slate-400 font-normal">dependencies</span>
              </span>
              <span className="text-slate-500 font-mono text-[10px] block mt-0.5" title={`Potentially affected metric in risk_assessment: ${potentiallyAffected}`}>
                Potentially affected: {potentiallyAffected}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: AI Risk Explanation (Gemini Evidence Interpreter) */}
        <div className="lg:col-span-2">
          <div
            id="ai-risk-explanation-card"
            className="h-full rounded-2xl border border-indigo-900/40 bg-gradient-to-br from-indigo-950/20 via-slate-900/80 to-slate-950 p-6 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                      AI Risk Explanation
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                        Evidence Grounded
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Interpreting BigQuery evidence without inventing facts
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-mono text-cyan-400/90 block">
                    Category: {changeCategory}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Engine: {aiExplanation.source === 'gemini' ? 'Gemini 3.8 Flash' : 'Evidence Baseline'}
                  </span>
                </div>
              </div>

              {/* AI Narrative Body */}
              <div className="text-sm text-slate-200 leading-relaxed space-y-3 font-normal">
                <p className="whitespace-pre-wrap">
                  {aiExplanation.content || 'Insufficient evidence available to formulate an explanation.'}
                </p>
              </div>
            </div>

            {/* Evidence Grounding Notice */}
            <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                Grounded on BigQuery tables: changes, resources, risk_assessment, dependencies, incidents
              </span>
              {aiExplanation.error && (
                <span className="text-rose-400 text-[11px]" title={aiExplanation.error}>
                  (AI fallback active)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
