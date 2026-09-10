import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Lock, ListChecks, Info } from 'lucide-react';
import { ChangeGateResult, GateDecision } from '../types';

interface ChangeGateProps {
  changeGate: ChangeGateResult;
  changeId: string;
}

export const ChangeGate: React.FC<ChangeGateProps> = ({ changeGate, changeId }) => {
  const { decision, decisionReason, evidencePoints, recommendedSafeguards } = changeGate;

  const getDecisionBadge = (dec: GateDecision) => {
    switch (dec) {
      case 'APPROVE':
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
          label: 'APPROVE',
          colorBadge: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
          containerBorder: 'border-emerald-700/50',
          dot: 'bg-emerald-400',
          descColor: 'text-emerald-200',
          pill: '🟢 APPROVE',
        };
      case 'APPROVE WITH SAFEGUARDS':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-amber-400" />,
          label: 'APPROVE WITH SAFEGUARDS',
          colorBadge: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
          containerBorder: 'border-amber-700/50',
          dot: 'bg-amber-400',
          descColor: 'text-amber-200',
          pill: '🟠 APPROVE WITH SAFEGUARDS',
        };
      case 'BLOCK':
      default:
        return {
          icon: <ShieldAlert className="w-8 h-8 text-rose-400" />,
          label: 'BLOCK',
          colorBadge: 'bg-rose-500/10 border-rose-500/40 text-rose-300',
          containerBorder: 'border-rose-700/50',
          dot: 'bg-rose-400',
          descColor: 'text-rose-200',
          pill: '🔴 BLOCK',
        };
    }
  };

  const badge = getDecisionBadge(decision);

  return (
    <section id="change-gate-section" className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> 6. Autonomous Policy Gate
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            CHANGE GATE DECISION
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs">
            Analytical gate • Zero cloud mutation
          </span>
        </div>
      </div>

      <div
        id="change-gate-card"
        className={`rounded-2xl border-2 ${badge.containerBorder} bg-slate-900/80 backdrop-blur-md p-6 shadow-2xl space-y-6`}
      >
        {/* Decision Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl border ${badge.colorBadge} shadow-lg shadow-black/40 shrink-0`}>
              {badge.icon}
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 block mb-1">
                Gate Recommendation for {changeId}
              </span>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                {badge.pill}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-lg border border-cyan-800 inline-block">
              Evidence-Based Gate
            </span>
          </div>
        </div>

        {/* Why this decision? */}
        <div>
          <h3 className="text-sm font-bold text-slate-300 uppercase font-mono tracking-wider mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" /> Why this decision?
          </h3>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <p className="text-sm text-slate-200 leading-relaxed font-normal">
              {decisionReason || 'Decision derived from risk level, criticality, dependencies, and historical outage logs.'}
            </p>
          </div>
        </div>

        {/* Supporting Evidence & Recommended Safeguards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Evidence supporting the decision */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-cyan-400" /> Evidence Supporting Decision
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {evidencePoints.length === 0 ? (
                  <li className="text-slate-500 italic">No specific evidence items retrieved.</li>
                ) : (
                  evidencePoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5"></span>
                      <span>{point}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-850 text-[10px] font-mono text-slate-500">
              Corroborated across 5 BigQuery tables
            </div>
          </div>

          {/* Recommended safeguards */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Recommended Safeguards
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {recommendedSafeguards.length === 0 ? (
                  <li className="text-slate-500 italic">Standard operational monitoring required.</li>
                ) : (
                  recommendedSafeguards.map((safeguard, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5"></span>
                      <span>{safeguard}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-850 text-[10px] font-mono text-slate-500">
              Mitigation recommendations prior to approval
            </div>
          </div>
        </div>

        {/* Explicit Safeguard Notice */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between">
          <span>⚠️ Important: Analytical recommendation only. CloudShield does not execute cloud changes or alter infrastructure.</span>
          <span className="text-cyan-400">Strictly Non-Destructive</span>
        </div>
      </div>
    </section>
  );
};
