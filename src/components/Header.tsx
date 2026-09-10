import React from 'react';
import { ShieldCheck, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { BigQueryStatus } from '../types';

interface HeaderProps {
  bqStatus: BigQueryStatus | null;
  geminiAvailable: boolean;
  onRefreshStatus: () => void;
  isChecking: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  bqStatus,
  geminiAvailable,
  onRefreshStatus,
  isChecking,
}) => {
  const isBqConnected = bqStatus?.connected === true;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                CloudShield
                <span className="text-xs font-mono px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 text-indigo-300">
                  Risk Gate v1.0
                </span>
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                &ldquo;Understand the impact before you deploy.&rdquo;
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* BigQuery Live or Unavailable Status */}
          {isBqConnected ? (
            <div
              id="bq-status-badge"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs font-mono font-medium shadow-sm"
              title={`Connected to ${bqStatus?.project}.${bqStatus?.dataset}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>● BigQuery Live</span>
            </div>
          ) : (
            <div
              id="bq-status-badge"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs font-mono font-medium"
              title={bqStatus?.details || 'BigQuery connection failed'}
            >
              <span className="h-2 w-2 rounded-full border border-rose-400"></span>
              <span>○ BigQuery unavailable</span>
            </div>
          )}

          {/* Gemini AI Status */}
          <div
            id="gemini-status-badge"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-950/30 text-indigo-300 text-xs font-mono"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{geminiAvailable ? 'Gemini 3.8 Flash' : 'Gemini Offline'}</span>
          </div>

          {/* Status Refresh */}
          <button
            id="refresh-status-btn"
            onClick={onRefreshStatus}
            disabled={isChecking}
            title="Refresh BigQuery connectivity"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
