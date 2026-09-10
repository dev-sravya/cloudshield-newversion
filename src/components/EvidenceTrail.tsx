import React, { useState } from 'react';
import { Database, FileCode, CheckCircle2, ChevronDown, ChevronUp, Copy, Check, Terminal, Shield } from 'lucide-react';
import { AssessmentResponse } from '../types';

interface EvidenceTrailProps {
  assessment: AssessmentResponse;
}

export const EvidenceTrail: React.FC<EvidenceTrailProps> = ({ assessment }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'changes' | 'resources' | 'risk' | 'dependencies' | 'incidents'>('all');
  const [isCopied, setIsCopied] = useState(false);

  const { change, resource, riskAssessment, dependencies, incidents, evidenceTrail } = assessment;

  const copyPayload = () => {
    const data = {
      evidenceTrail,
      sourceData: {
        'cloudshield.changes': change,
        'cloudshield.resources': resource,
        'cloudshield.risk_assessment': riskAssessment,
        'cloudshield.dependencies_clean': dependencies,
        'cloudshield.incidents': incidents,
      },
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <section id="evidence-trail-section" className="mb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> 7. Verifiable Proof
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            EVIDENCE TRAIL
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="copy-evidence-json-btn"
            onClick={copyPayload}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 text-xs font-mono hover:text-white hover:bg-slate-850 transition"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied' : 'Copy Evidence JSON'}</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-sm p-6 shadow-xl space-y-6">
        {/* Core Product Principle Banner */}
        <div
          id="core-principle-banner"
          className="p-4 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/50 via-slate-950 to-slate-950 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-mono font-bold text-cyan-300 tracking-wide uppercase">
                Core Integrity Principle
              </p>
              <p className="text-sm font-semibold text-white tracking-tight mt-0.5">
                &ldquo;Gemini interpreted the evidence. Gemini did not create the evidence.&rdquo;
              </p>
            </div>
          </div>
          <div className="hidden sm:block text-right shrink-0 text-[11px] font-mono text-slate-400">
            <span>Audit Ref: {change.change_id}</span>
            <span className="block text-slate-500">Project: {evidenceTrail.project}</span>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'all', label: 'All Evidence' },
            { id: 'changes', label: '1. changes' },
            { id: 'resources', label: '2. resources' },
            { id: 'risk', label: '3. risk_assessment' },
            { id: 'dependencies', label: '4. dependencies_clean' },
            { id: 'incidents', label: '5. incidents' },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`evidence-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Evidence Tables & Raw Telemetry */}
        <div className="space-y-4 text-xs font-mono">
          {/* Table 1: changes */}
          {(activeTab === 'all' || activeTab === 'changes') && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850 mb-3">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Table: cloudshield.changes
                </span>
                <span className="text-[10px] text-slate-500">1 Row Retrieved</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] uppercase text-slate-500 bg-slate-900/60">
                    <tr>
                      <th className="p-2">change_id</th>
                      <th className="p-2">resource_id</th>
                      <th className="p-2">resource_type</th>
                      <th className="p-2">change_category</th>
                      <th className="p-2">proposed_date</th>
                      <th className="p-2">status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    <tr>
                      <td className="p-2 text-cyan-300 font-bold">{change.change_id}</td>
                      <td className="p-2">{change.resource_id}</td>
                      <td className="p-2 text-slate-400">{change.resource_type}</td>
                      <td className="p-2 text-indigo-300">{change.change_category}</td>
                      <td className="p-2">
                        {typeof change.proposed_date === 'string'
                          ? change.proposed_date
                          : change.proposed_date?.value}
                      </td>
                      <td className="p-2 text-emerald-400">{change.status}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 2: resources */}
          {(activeTab === 'all' || activeTab === 'resources') && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850 mb-3">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Table: cloudshield.resources
                </span>
                <span className="text-[10px] text-slate-500">{resource ? '1 Row' : 'Not found'}</span>
              </div>
              {resource ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-slate-500 bg-slate-900/60">
                      <tr>
                        <th className="p-2">resource_id</th>
                        <th className="p-2">resource_name</th>
                        <th className="p-2">resource_type</th>
                        <th className="p-2">environment</th>
                        <th className="p-2">criticality</th>
                        <th className="p-2">region</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300">
                      <tr>
                        <td className="p-2 text-cyan-300 font-bold">{resource.resource_id}</td>
                        <td className="p-2 text-slate-200">{resource.resource_name}</td>
                        <td className="p-2 text-slate-400">{resource.resource_type}</td>
                        <td className="p-2 text-amber-300">{resource.environment}</td>
                        <td className="p-2 text-rose-300">{resource.criticality}</td>
                        <td className="p-2 text-slate-400">{resource.region}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 py-2">Resource record not found in resources table.</p>
              )}
            </div>
          )}

          {/* Table 3: risk_assessment */}
          {(activeTab === 'all' || activeTab === 'risk') && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850 mb-3">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Table: cloudshield.risk_assessment
                </span>
                <span className="text-[10px] text-slate-500">{riskAssessment ? '1 Row' : 'Not found'}</span>
              </div>
              {riskAssessment ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-slate-500 bg-slate-900/60">
                      <tr>
                        <th className="p-2">change_id</th>
                        <th className="p-2">risk_level</th>
                        <th className="p-2">criticality</th>
                        <th className="p-2">environment</th>
                        <th className="p-2">historical_incident_count</th>
                        <th className="p-2">potentially_affected_resource_count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300">
                      <tr>
                        <td className="p-2 text-cyan-300 font-bold">{riskAssessment.change_id}</td>
                        <td className="p-2 text-rose-400 font-bold">{riskAssessment.risk_level}</td>
                        <td className="p-2 text-slate-300">{riskAssessment.criticality}</td>
                        <td className="p-2 text-slate-300">{riskAssessment.environment}</td>
                        <td className="p-2 text-amber-300">{riskAssessment.historical_incident_count}</td>
                        <td className="p-2 text-indigo-300">{riskAssessment.potentially_affected_resource_count}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 py-2">Risk assessment record not found in risk_assessment table.</p>
              )}
            </div>
          )}

          {/* Table 4: dependencies_clean */}
          {(activeTab === 'all' || activeTab === 'dependencies') && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850 mb-3">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Table: cloudshield.dependencies_clean
                </span>
                <span className="text-[10px] text-slate-500">{dependencies.length} Rows</span>
              </div>
              {dependencies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-slate-500 bg-slate-900/60">
                      <tr>
                        <th className="p-2">source_resource_id</th>
                        <th className="p-2">target_resource_id</th>
                        <th className="p-2">dependency_type</th>
                        <th className="p-2">semantic_interpretation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300">
                      {dependencies.map((dep, idx) => (
                        <tr key={idx}>
                          <td className="p-2 text-cyan-300">{dep.source_resource_id}</td>
                          <td className="p-2 text-indigo-300">{dep.target_resource_id}</td>
                          <td className="p-2 text-slate-300">{dep.dependency_type}</td>
                          <td className="p-2 text-slate-500 text-[11px]">
                            {dep.source_resource_id} depends on / connects to {dep.target_resource_id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 py-2">No dependency relationships found in dependencies_clean.</p>
              )}
            </div>
          )}

          {/* Table 5: incidents */}
          {(activeTab === 'all' || activeTab === 'incidents') && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850 mb-3">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Table: cloudshield.incidents
                </span>
                <span className="text-[10px] text-slate-500">{incidents.length} Rows</span>
              </div>
              {incidents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-slate-500 bg-slate-900/60">
                      <tr>
                        <th className="p-2">incident_id</th>
                        <th className="p-2">incident_date</th>
                        <th className="p-2">severity</th>
                        <th className="p-2">incident_type</th>
                        <th className="p-2">description</th>
                        <th className="p-2">resolution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300">
                      {incidents.map((inc) => (
                        <tr key={inc.incident_id}>
                          <td className="p-2 text-cyan-300 font-bold">{inc.incident_id}</td>
                          <td className="p-2 text-slate-400">
                            {typeof inc.incident_date === 'string'
                              ? inc.incident_date
                              : inc.incident_date?.value}
                          </td>
                          <td className="p-2 text-rose-300 font-bold">{inc.severity}</td>
                          <td className="p-2 text-slate-300">{inc.incident_type}</td>
                          <td className="p-2 max-w-xs truncate text-slate-200" title={inc.description}>
                            {inc.description}
                          </td>
                          <td className="p-2 max-w-xs truncate text-emerald-300" title={inc.resolution}>
                            {inc.resolution}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 py-2">No historical incidents found in incidents table.</p>
              )}
            </div>
          )}
        </div>

        {/* Audit Proof Footer */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>BigQuery Dataset: {evidenceTrail.project}.{evidenceTrail.dataset} (US)</span>
          <span>Query Execution Time: {evidenceTrail.retrievedAt}</span>
        </div>
      </div>
    </section>
  );
};
