import React, { useState } from 'react';
import { AlertTriangle, Database, RefreshCw, ChevronDown, ChevronUp, Terminal, ShieldAlert } from 'lucide-react';
import { BigQueryStatus } from '../types';

interface BigQueryErrorBannerProps {
  status: BigQueryStatus | null;
  onRetry: () => void;
  isRetrying: boolean;
}

export const BigQueryErrorBanner: React.FC<BigQueryErrorBannerProps> = ({
  status,
  onRetry,
  isRetrying,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      id="bq-error-banner"
      className="rounded-xl border border-rose-900/60 bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-950 p-5 shadow-xl shadow-rose-950/20 my-6"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-rose-200">
                BigQuery data unavailable
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 font-mono">
                503 Unavailable
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              CloudShield strictly requires the live BigQuery dataset{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-xs">
                {status?.project || 'project-89de941d-00d0-4f2f-98f'}.{status?.dataset || 'cloudshield'}
              </code>
              . Mock data fallback is disabled to guarantee authentic telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
          <button
            id="toggle-error-details-btn"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 text-xs font-medium hover:text-white hover:bg-slate-700 transition"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Diagnostics</span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            id="retry-bq-connection-btn"
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-900/40 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Checking...' : 'Retry BigQuery'}</span>
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-rose-900/30 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400 block mb-1 font-mono uppercase tracking-wider text-[10px]">
                Target Google Cloud Project
              </span>
              <span className="font-mono text-cyan-300 text-xs">
                {status?.project || 'project-89de941d-00d0-4f2f-98f'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-slate-400 block mb-1 font-mono uppercase tracking-wider text-[10px]">
                Target BigQuery Dataset & Location
              </span>
              <span className="font-mono text-cyan-300 text-xs">
                {status?.dataset || 'cloudshield'} (Location: US)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-slate-300 overflow-x-auto">
            <span className="text-rose-400 font-semibold block mb-1">
              Google Cloud API Response / Diagnostics:
            </span>
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
              {status?.details || 'Unable to query BigQuery using Application Default Credentials. Ensure the runtime service account has permission on project project-89de941d-00d0-4f2f-98f.'}
            </p>
          </div>

          <div className="mt-3 p-3 rounded-lg bg-amber-950/20 border border-amber-900/30 text-amber-200/90 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-300">BigQuery IAM Access &amp; ADC:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                <li>
                  Authentication uses Google Cloud Application Default Credentials (ADC) via the Cloud Run runtime service identity.
                </li>
                <li>
                  Ensure the runtime identity has <code className="text-cyan-300">roles/bigquery.jobUser</code> and <code className="text-cyan-300">roles/bigquery.dataViewer</code> on <code className="text-cyan-300">project-89de941d-00d0-4f2f-98f</code>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
