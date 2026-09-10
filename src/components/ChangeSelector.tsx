import React from 'react';
import { GitCommit, Calendar, Server, Tag, User, Activity, ArrowRight, Play } from 'lucide-react';
import { ChangeRecord } from '../types';

interface ChangeSelectorProps {
  changes: ChangeRecord[];
  selectedChangeId: string;
  onSelectChange: (changeId: string) => void;
  onAssessRisk: () => void;
  isAssessing: boolean;
  disabled: boolean;
}

export const ChangeSelector: React.FC<ChangeSelectorProps> = ({
  changes,
  selectedChangeId,
  onSelectChange,
  onAssessRisk,
  isAssessing,
  disabled,
}) => {
  const selectedChange = changes.find((c) => c.change_id === selectedChangeId) || changes[0];

  return (
    <section id="change-selector-section" className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <GitCommit className="w-3.5 h-3.5" /> 1. Select Cloud Change
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Proposed Infrastructure Change
          </h2>
        </div>

        {/* Change Dropdown Selector */}
        <div className="w-full md:w-96">
          <label htmlFor="change-select" className="sr-only">
            Select Proposed Change
          </label>
          <div className="relative">
            <select
              id="change-select"
              value={selectedChangeId}
              onChange={(e) => onSelectChange(e.target.value)}
              disabled={disabled || changes.length === 0}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono shadow-inner disabled:opacity-50 appearance-none cursor-pointer"
            >
              {changes.length === 0 ? (
                <option value="">No changes available</option>
              ) : (
                changes.map((c) => (
                  <option key={c.change_id} value={c.change_id}>
                    {c.change_id} — {c.resource_id} ({c.change_category})
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Card for Selected Change */}
      {selectedChange && (
        <div
          id={`change-card-${selectedChange.change_id}`}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-6 shadow-xl transition-all"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
            <div className="space-y-1.5">
              <div className="flex items-center flex-wrap gap-2.5">
                <span className="px-3 py-1 rounded-md bg-cyan-950/70 border border-cyan-800 text-cyan-300 font-mono font-bold text-sm tracking-wide">
                  {selectedChange.change_id}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs">
                  Status: {selectedChange.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-800 text-indigo-300 font-mono text-xs flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {selectedChange.change_category}
                </span>
              </div>
              <p className="text-base text-slate-100 font-medium pt-1">
                {selectedChange.change_description}
              </p>
            </div>

            {/* ASSESS RISK Prominent Button */}
            <div className="shrink-0">
              <button
                id="assess-risk-btn"
                onClick={onAssessRisk}
                disabled={isAssessing || disabled}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:via-indigo-400 hover:to-purple-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isAssessing ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin text-white" />
                    <span>ASSESSING TELEMETRY...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>ASSESS RISK</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Change Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Server className="w-3 h-3 text-cyan-400" /> Target Resource
              </span>
              <p className="font-mono text-slate-200 font-semibold text-sm truncate" title={selectedChange.resource_id}>
                {selectedChange.resource_id}
              </p>
              <span className="text-slate-400 font-mono text-[11px] block mt-0.5">
                Type: {selectedChange.resource_type}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-400" /> Proposed Date
              </span>
              <p className="font-mono text-slate-200 font-semibold text-sm">
                {typeof selectedChange.proposed_date === 'string'
                  ? selectedChange.proposed_date
                  : selectedChange.proposed_date?.value || 'Scheduled'}
              </p>
              <span className="text-slate-400 font-mono text-[11px] block mt-0.5">
                Window: Pre-deployment
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-purple-400" /> Requested By
              </span>
              <p className="font-mono text-slate-200 font-semibold text-sm truncate" title={selectedChange.requested_by}>
                {selectedChange.requested_by}
              </p>
              <span className="text-slate-400 font-mono text-[11px] block mt-0.5">
                Cloud Operator
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Activity className="w-3 h-3 text-amber-400" /> BigQuery Source
              </span>
              <p className="font-mono text-cyan-400 font-semibold text-xs truncate">
                cloudshield.changes
              </p>
              <span className="text-slate-500 font-mono text-[11px] block mt-0.5">
                Table 1 (Verified)
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
