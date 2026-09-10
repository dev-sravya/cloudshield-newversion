import React from 'react';
import { History, AlertCircle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { IncidentRecord } from '../types';

interface HistoricalIncidentsProps {
  incidents: IncidentRecord[];
  resourceId: string;
}

export const HistoricalIncidents: React.FC<HistoricalIncidentsProps> = ({
  incidents,
  resourceId,
}) => {
  const getSeverityStyle = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
      case 'SEV-1':
      case 'HIGH':
        return 'bg-rose-950/80 border-rose-800 text-rose-300';
      case 'MEDIUM':
      case 'SEV-2':
        return 'bg-amber-950/80 border-amber-800 text-amber-300';
      case 'LOW':
      case 'SEV-3':
        return 'bg-emerald-950/80 border-emerald-800 text-emerald-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <section id="historical-incidents-section" className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> 4. Historical Incident Telemetry
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Prior Outages &amp; Anomalies
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            Source: cloudshield.incidents
          </span>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div
          id="no-incidents-message"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-500/80 mx-auto mb-2" />
          <p className="text-base font-medium text-slate-300">
            No historical incidents found for this resource.
          </p>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Zero prior failure records logged in cloudshield.incidents for resource <code className="text-cyan-400">{resourceId}</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incidents.map((incident) => {
              const formattedDate =
                typeof incident.incident_date === 'string'
                  ? incident.incident_date
                  : incident.incident_date?.value || 'Historical';

              return (
                <div
                  key={incident.incident_id}
                  id={`incident-card-${incident.incident_id}`}
                  className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs font-bold text-cyan-300">
                          {incident.incident_id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold ${getSeverityStyle(
                            incident.severity
                          )}`}
                        >
                          {incident.severity || 'SEVERITY'}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {formattedDate}
                      </span>
                    </div>

                    <div className="mb-2">
                      <span className="text-xs font-semibold text-slate-300 font-mono">
                        Type: {incident.incident_type || 'Infrastructure Anomaly'}
                      </span>
                    </div>

                    {/* Actual Database Description */}
                    <div className="mb-3">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block mb-1">
                        Incident Description
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                        {incident.description}
                      </p>
                    </div>

                    {/* Actual Database Resolution */}
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400/80 block mb-1">
                        Resolution &amp; Corrective Action
                      </span>
                      <p className="text-xs text-emerald-200/90 leading-relaxed bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30">
                        {incident.resolution}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Resource: {incident.resource_id}</span>
                    <span>Verified in BigQuery</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
