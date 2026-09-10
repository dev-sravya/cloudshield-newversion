import React, { useState } from 'react';
import { Layers, Server, ArrowRight, Shield, ExternalLink, Network, Info } from 'lucide-react';
import { DependencyGraphData, DependencyRecord, ResourceRecord } from '../types';

interface BlastRadiusGraphProps {
  graphData: DependencyGraphData;
  selectedResourceId: string;
  selectedResource: ResourceRecord | null;
}

export const BlastRadiusGraph: React.FC<BlastRadiusGraphProps> = ({
  graphData,
  selectedResourceId,
  selectedResource,
}) => {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(selectedResourceId);

  const hasDependencies = graphData.edges.length > 0;

  // Find active node metadata
  const activeNode = graphData.nodes.find((n) => n.resource_id === activeNodeId) ||
    (activeNodeId === selectedResourceId && selectedResource ? {
      ...selectedResource,
      role: 'selected' as const,
    } : null);

  return (
    <section id="blast-radius-section" className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5" /> 3. Blast Radius Analysis
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Dependency-Based Impact Graph
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            Source: cloudshield.dependencies_clean
          </span>
        </div>
      </div>

      {!hasDependencies ? (
        <div
          id="no-dependencies-message"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center"
        >
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-base font-medium text-slate-300">
            No dependency relationships found in the available BigQuery data.
          </p>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Target resource <code className="text-cyan-400">{selectedResourceId}</code> has no registered connections in cloudshield.dependencies_clean.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visual Graph Stage */}
          <div
            id="blast-radius-graph-stage"
            className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-md p-6 shadow-xl relative min-h-[380px] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 pb-4 border-b border-slate-800/80">
              <span className="font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Root Origin: <strong className="text-cyan-300">{selectedResourceId}</strong>
              </span>
              <span className="font-mono text-slate-400">
                {graphData.edges.length} Active Relationship{graphData.edges.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Visual Topology Representation */}
            <div className="py-6 flex flex-col md:flex-row items-center justify-center gap-8 relative">
              {/* Central / Source Node */}
              <div
                id={`node-${selectedResourceId}`}
                onClick={() => setActiveNodeId(selectedResourceId)}
                className={`cursor-pointer transition-all duration-200 transform hover:scale-105 p-4 rounded-2xl border-2 ${
                  activeNodeId === selectedResourceId
                    ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-700 bg-slate-900/80'
                } w-56 text-center z-10`}
              >
                <div className="inline-flex p-2 rounded-xl bg-cyan-500/10 text-cyan-400 mb-2">
                  <Server className="w-5 h-5" />
                </div>
                <div className="font-mono font-bold text-xs text-cyan-300 truncate" title={selectedResourceId}>
                  {selectedResourceId}
                </div>
                <div className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                  {selectedResource?.resource_name || 'Target Resource'}
                </div>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    CHANGED
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {selectedResource?.environment || 'prod'}
                  </span>
                </div>
              </div>

              {/* Connecting Edges and Target Nodes */}
              <div className="flex flex-col gap-3 w-full md:w-auto">
                {graphData.edges.map((edge, idx) => {
                  const targetNode = graphData.nodes.find(
                    (n) => n.resource_id === (edge.source === selectedResourceId ? edge.target : edge.source)
                  );
                  const otherId = edge.source === selectedResourceId ? edge.target : edge.source;
                  const isTarget = edge.source === selectedResourceId;
                  const isSelected = activeNodeId === otherId;

                  return (
                    <div key={`${edge.source}-${edge.target}-${idx}`} className="flex items-center gap-4">
                      {/* Directional Connector line */}
                      <div className="hidden md:flex items-center gap-1 text-slate-500">
                        <span className="w-6 h-[2px] bg-slate-700"></span>
                        <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-indigo-300 whitespace-nowrap">
                          {edge.dependency_type || 'connects_to'}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                      </div>

                      {/* Dependent Node Card */}
                      <div
                        id={`node-${otherId}`}
                        onClick={() => setActiveNodeId(otherId)}
                        className={`cursor-pointer transition-all duration-200 transform hover:scale-102 p-3 rounded-xl border ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-950/40 shadow-md shadow-indigo-500/20'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                        } min-w-[220px] max-w-[280px]`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-slate-200 truncate" title={otherId}>
                            {otherId}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            targetNode?.criticality?.toLowerCase() === 'critical'
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {targetNode?.criticality || 'STANDARD'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {targetNode?.resource_name || targetNode?.resource_type || 'Connected Resource'}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                          <span>Env: {targetNode?.environment || 'unknown'}</span>
                          <span>•</span>
                          <span className="text-cyan-400 font-semibold">{edge.dependency_type}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Graph Legend */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-cyan-500"></span> Selected Node
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> Dependent / Downstream
                </span>
              </div>
              <span className="text-slate-500 text-[11px]">
                Click any node to view real BigQuery metadata
              </span>
            </div>
          </div>

          {/* Node Inspector Panel */}
          <div
            id="node-inspector-panel"
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-3">
                <Info className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-tight uppercase font-mono">
                  Resource Telemetry
                </h3>
              </div>

              {activeNode ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-0.5">
                      Resource ID
                    </span>
                    <p className="font-mono text-sm font-bold text-cyan-300 break-all">
                      {activeNode.resource_id}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-0.5">
                      Resource Name
                    </span>
                    <p className="text-slate-200 font-medium">
                      {activeNode.resource_name || 'N/A'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 font-mono uppercase text-[9px] block">
                        Type
                      </span>
                      <span className="font-mono text-slate-200 font-semibold text-[11px] truncate block">
                        {activeNode.resource_type || 'Unknown'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 font-mono uppercase text-[9px] block">
                        Environment
                      </span>
                      <span className="font-mono text-slate-200 font-semibold text-[11px] truncate block">
                        {activeNode.environment || 'Unknown'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 font-mono uppercase text-[9px] block">
                        Criticality
                      </span>
                      <span className={`font-mono font-semibold text-[11px] truncate block ${
                        activeNode.criticality?.toLowerCase() === 'critical' ? 'text-rose-400' : 'text-slate-200'
                      }`}>
                        {activeNode.criticality || 'Unknown'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 font-mono uppercase text-[9px] block">
                        Region
                      </span>
                      <span className="font-mono text-slate-200 font-semibold text-[11px] truncate block">
                        {activeNode.region || 'US / Multi-region'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Select a node from the topology diagram to inspect telemetry.
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 mt-4 text-[11px] font-mono text-slate-500">
              BigQuery Source: <code className="text-slate-400">cloudshield.resources</code>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
