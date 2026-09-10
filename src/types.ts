export interface ChangeRecord {
  change_id: string;
  proposed_date: string | { value: string };
  resource_id: string;
  resource_type: string;
  change_category: string;
  change_description: string;
  requested_by: string;
  status: string;
}

export interface ResourceRecord {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  environment: string;
  region: string;
  criticality: string;
}

export interface DependencyRecord {
  source_resource_id: string;
  target_resource_id: string;
  dependency_type: string;
}

export interface IncidentRecord {
  incident_id: string;
  incident_date: string | { value: string };
  resource_id: string;
  severity: string;
  incident_type: string;
  description: string;
  resolution: string;
}

export interface RiskAssessmentRecord {
  change_id: string;
  resource_id: string;
  resource_type: string;
  resource_name: string;
  environment: string;
  criticality: string;
  change_category: string;
  historical_incident_count: number;
  potentially_affected_resource_count: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | string;
}

export interface DependencyNode extends ResourceRecord {
  role: 'selected' | 'downstream' | 'upstream' | 'connected';
  dependency_type?: string;
}

export interface DependencyGraphData {
  nodes: DependencyNode[];
  edges: {
    source: string;
    target: string;
    dependency_type: string;
  }[];
  totalAffected: number;
}

export interface WhatIfComparison {
  scenario: string;
  current: {
    riskAssessment: string;
    potentialBlastRadius: string;
    historicalEvidence: string;
    productionExposure: string;
    recommendedSafeguards: string[];
  };
  whatIf: {
    riskAssessment: string;
    potentialBlastRadius: string;
    historicalEvidence: string;
    productionExposure: string;
    recommendedSafeguards: string[];
  };
  analysis: string;
}

export type GateDecision = 'APPROVE' | 'APPROVE WITH SAFEGUARDS' | 'BLOCK';

export interface ChangeGateResult {
  decision: GateDecision;
  decisionReason: string;
  evidencePoints: string[];
  recommendedSafeguards: string[];
}

export interface AssessmentResponse {
  change: ChangeRecord;
  resource: ResourceRecord | null;
  riskAssessment: RiskAssessmentRecord | null;
  dependencies: DependencyRecord[];
  dependencyGraph: DependencyGraphData;
  incidents: IncidentRecord[];
  aiExplanation: {
    content: string;
    source: 'gemini' | 'evidence-fallback';
    error?: string;
  };
  changeGate: ChangeGateResult;
  evidenceTrail: {
    changesQuery: string;
    resourcesQuery: string;
    riskAssessmentQuery: string;
    dependenciesQuery: string;
    incidentsQuery: string;
    retrievedAt: string;
    dataset: string;
    project: string;
  };
}

export interface BigQueryStatus {
  connected: boolean;
  message?: string;
  error?: string;
  project: string;
  dataset: string;
  lastChecked?: string;
}
