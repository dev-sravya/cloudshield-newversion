import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { BigQuery } from '@google-cloud/bigquery';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'project-89de941d-00d0-4f2f-98f';
const DATASET_ID = process.env.BIGQUERY_DATASET || 'cloudshield';
const LOCATION = 'US';
const PORT = Number(process.env.PORT) || 3000;

// Lazy initialization of BigQuery client using Google Cloud Application Default Credentials (ADC)
let bigQueryClient: BigQuery | null = null;

function getBigQuery(): BigQuery {
  if (!bigQueryClient) {
    bigQueryClient = new BigQuery({
      projectId: PROJECT_ID,
      location: LOCATION,
    });
  }
  return bigQueryClient;
}

// Vertex AI / Gemini configuration using Google Cloud Application Default Credentials (ADC)
const VERTEX_PROJECT_ID = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'project-89de941d-00d0-4f2f-98f';
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'europe-west1';
const VERTEX_MODEL = process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash';

// Lazy initialization of Vertex AI client using Application Default Credentials (ADC)
let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      vertexai: true,
      project: VERTEX_PROJECT_ID,
      location: VERTEX_LOCATION,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

let lastGeminiProbeTime = 0;
let cachedGeminiStatus: {
  available: boolean;
  project: string;
  location: string;
  model: string;
  authMethod: string;
  error: string | null;
  lastChecked: string;
} | null = null;

async function checkGeminiStatus(force = false) {
  const now = Date.now();
  if (!force && cachedGeminiStatus && now - lastGeminiProbeTime < 30000) {
    return cachedGeminiStatus;
  }

  let available = false;
  let error: string | null = null;

  try {
    const gemini = getGemini();
    await callWithTimeout(
      gemini.models.generateContent({
        model: VERTEX_MODEL,
        contents: 'ping',
      }),
      3500
    );
    available = true;
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
    available = false;
  }

  lastGeminiProbeTime = now;
  cachedGeminiStatus = {
    available,
    project: VERTEX_PROJECT_ID,
    location: VERTEX_LOCATION,
    model: VERTEX_MODEL,
    authMethod: 'Application Default Credentials (ADC) / Vertex AI',
    error,
    lastChecked: new Date().toISOString(),
  };

  return cachedGeminiStatus;
}

// Helper to safely format dates from BigQuery
function formatDateField(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'object' && val !== null && 'value' in val) {
    return String((val as { value: string }).value);
  }
  return String(val);
}

function connectedIdsAdd(set: Set<string>, id: unknown) {
  if (typeof id === 'string' && id.trim()) {
    set.add(id.trim());
  }
}

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs = 4000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI generation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

// Core helper: Evaluate Change Gate from evidence
async function evaluateGateDecision(evidence: {
  change: any;
  resource: any;
  riskAssessment: any;
  dependencies: any[];
  incidents: any[];
}) {
  const { change, resource, riskAssessment, dependencies, incidents } = evidence;
  const riskLvl = (riskAssessment?.risk_level || 'UNKNOWN').toUpperCase();
  const env = (resource?.environment || riskAssessment?.environment || 'unknown').toLowerCase();
  const crit = (resource?.criticality || riskAssessment?.criticality || 'unknown').toLowerCase();
  const incCount = riskAssessment?.historical_incident_count ?? incidents.length;
  const depCount = dependencies.length;

  try {
    const gemini = getGemini();
    const prompt = `
You are the Autonomous Change Gate decision engine of CloudShield.
TASK: Issue exactly one decision: "APPROVE", "APPROVE WITH SAFEGUARDS", or "BLOCK".
CRITICAL INSTRUCTION:
"Use only the supplied evidence. Do not invent facts, numbers, incidents, dependencies, resources or historical events. If evidence is insufficient, explicitly say so."

SUPPLIED EVIDENCE:
${JSON.stringify(evidence, null, 2)}

Decision Rules:
- "BLOCK": HIGH risk in production on CRITICAL resource with prior historical incidents or high blast radius.
- "APPROVE WITH SAFEGUARDS": Changes needing active mitigations, canaries, or database backups.
- "APPROVE": LOW risk in non-production with 0 incidents.

Respond in JSON matching schema:
{
  "decision": "APPROVE | APPROVE WITH SAFEGUARDS | BLOCK",
  "decisionReason": "1-2 sentences strictly referencing supplied BigQuery values.",
  "evidencePoints": ["Specific evidence bullet 1", "Specific evidence bullet 2"],
  "recommendedSafeguards": ["Concrete safeguard 1", "Concrete safeguard 2"]
}
`;

    const geminiResponse = await callWithTimeout(
      gemini.models.generateContent({
        model: VERTEX_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              decision: { type: Type.STRING },
              decisionReason: { type: Type.STRING },
              evidencePoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedSafeguards: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['decision', 'decisionReason', 'evidencePoints', 'recommendedSafeguards'],
          },
        },
      }),
      4000
    );

    const parsed = JSON.parse(geminiResponse.text?.trim() || '{}');
    const valid = ['APPROVE', 'APPROVE WITH SAFEGUARDS', 'BLOCK'];
    const dec = (parsed.decision || '').toUpperCase();

    return {
      decision: valid.includes(dec) ? dec : 'APPROVE WITH SAFEGUARDS',
      decisionReason: parsed.decisionReason || `Decision based on BigQuery risk level ${riskLvl} in ${env}.`,
      evidencePoints: Array.isArray(parsed.evidencePoints) ? parsed.evidencePoints : [
        `Risk level from BigQuery: ${riskLvl}`,
        `Environment: ${env} | Criticality: ${crit}`,
        `Historical incident count: ${incCount}`,
        `Dependency links: ${depCount}`,
      ],
      recommendedSafeguards: Array.isArray(parsed.recommendedSafeguards) ? parsed.recommendedSafeguards : [
        'Require dual peer review prior to execution',
        'Verify backup/snapshot before deployment',
      ],
      source: 'gemini',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('Gemini gate evaluation failed, falling back to rule-based evaluation:', errorMsg);

    let fallbackDecision: 'APPROVE' | 'APPROVE WITH SAFEGUARDS' | 'BLOCK' = 'APPROVE WITH SAFEGUARDS';
    if (riskLvl === 'HIGH' && (env === 'production' || crit === 'critical')) {
      fallbackDecision = 'BLOCK';
    } else if (riskLvl === 'LOW' && incCount === 0 && env !== 'production') {
      fallbackDecision = 'APPROVE';
    }

    return {
      decision: fallbackDecision,
      decisionReason: `Rule-based evaluation (AI unavailable: ${errorMsg}): Stored BigQuery risk is ${riskLvl} in ${env} on a ${crit} resource with ${incCount} prior incidents.`,
      evidencePoints: [
        `Risk level in BigQuery: ${riskLvl}`,
        `Environment: ${env} | Criticality: ${crit}`,
        `Historical incident count: ${incCount}`,
        `Direct dependency connections: ${depCount}`,
      ],
      recommendedSafeguards: [
        'Require dual peer approval before execution',
        'Verify pre-deployment snapshot and health checks',
        'Prepare automated rollback plan',
      ],
      source: 'rule-based',
      error: errorMsg,
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // ==========================================
  // 1. GET /api/status
  // ==========================================
  app.get('/api/status', async (req: Request, res: Response) => {
    const geminiStatus = await checkGeminiStatus();

    try {
      const bq = getBigQuery();
      // Test real BigQuery access against the changes table
      const [rows] = await bq.query({
        query: `SELECT change_id FROM \`${PROJECT_ID}.${DATASET_ID}.changes\` LIMIT 1`,
        location: LOCATION,
      });

      res.json({
        ok: true,
        bigquery: {
          connected: true,
          project: PROJECT_ID,
          dataset: DATASET_ID,
          location: LOCATION,
          verifiedQuery: `SELECT change_id FROM \`${PROJECT_ID}.${DATASET_ID}.changes\` LIMIT 1`,
          sampleRowsRetrieved: rows.length,
        },
        gemini: geminiStatus,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        ok: false,
        bigquery: {
          connected: false,
          error: 'BigQuery data unavailable',
          details: message,
          project: PROJECT_ID,
          dataset: DATASET_ID,
          location: LOCATION,
        },
        gemini: geminiStatus,
      });
    }
  });

  // ==========================================
  // 2. GET /api/changes
  // ==========================================
  app.get('/api/changes', async (req: Request, res: Response) => {
    try {
      const bq = getBigQuery();
      const query = `
        SELECT 
          change_id,
          proposed_date,
          resource_id,
          resource_type,
          change_category,
          change_description,
          requested_by,
          status
        FROM \`${PROJECT_ID}.${DATASET_ID}.changes\`
        ORDER BY proposed_date DESC
      `;
      const [rows] = await bq.query({ query, location: LOCATION });
      
      const sanitized = rows.map((row: Record<string, unknown>) => ({
        ...row,
        proposed_date: formatDateField(row.proposed_date),
      }));

      res.json({ ok: true, changes: sanitized, query });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        ok: false,
        error: 'BigQuery data unavailable',
        details: message,
        operation: `SELECT FROM ${PROJECT_ID}.${DATASET_ID}.changes`,
        project: PROJECT_ID,
        dataset: DATASET_ID,
      });
    }
  });

  // ==========================================
  // 3. GET /api/resources/:resourceId
  // ==========================================
  app.get('/api/resources/:resourceId', async (req: Request, res: Response) => {
    const { resourceId } = req.params;
    try {
      const bq = getBigQuery();
      const query = `
        SELECT 
          resource_id,
          resource_name,
          resource_type,
          environment,
          region,
          criticality
        FROM \`${PROJECT_ID}.${DATASET_ID}.resources\`
        WHERE resource_id = @resourceId
        LIMIT 1
      `;
      const [rows] = await bq.query({
        query,
        params: { resourceId },
        location: LOCATION,
      });

      if (rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Resource not found in BigQuery', resourceId });
      }

      res.json({ ok: true, resource: rows[0], query });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        ok: false,
        error: 'BigQuery data unavailable',
        details: message,
        operation: `SELECT FROM ${PROJECT_ID}.${DATASET_ID}.resources`,
        resourceId,
      });
    }
  });

  // ==========================================
  // 4. GET /api/risk/:changeId
  // ==========================================
  app.get('/api/risk/:changeId', async (req: Request, res: Response) => {
    const { changeId } = req.params;
    try {
      const bq = getBigQuery();
      const query = `
        SELECT 
          change_id,
          resource_id,
          resource_type,
          resource_name,
          environment,
          criticality,
          change_category,
          historical_incident_count,
          potentially_affected_resource_count,
          risk_level
        FROM \`${PROJECT_ID}.${DATASET_ID}.risk_assessment\`
        WHERE change_id = @changeId
        LIMIT 1
      `;
      const [rows] = await bq.query({
        query,
        params: { changeId },
        location: LOCATION,
      });

      if (rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Risk assessment not found for change', changeId });
      }

      res.json({ ok: true, riskAssessment: rows[0], query });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        ok: false,
        error: 'BigQuery data unavailable',
        details: message,
        operation: `SELECT FROM ${PROJECT_ID}.${DATASET_ID}.risk_assessment`,
        changeId,
      });
    }
  });

  // ==========================================
  // 5. GET /api/dependencies/:resourceId
  // ==========================================
  app.get('/api/dependencies/:resourceId', async (req: Request, res: Response) => {
    const { resourceId } = req.params;
    try {
      const bq = getBigQuery();
      const query = `
        SELECT 
          source_resource_id,
          target_resource_id,
          dependency_type
        FROM \`${PROJECT_ID}.${DATASET_ID}.dependencies_clean\`
        WHERE source_resource_id = @resourceId OR target_resource_id = @resourceId
      `;
      const [rows] = await bq.query({
        query,
        params: { resourceId },
        location: LOCATION,
      });

      const connectedIds = new Set<string>();
      rows.forEach((r: { source_resource_id: string; target_resource_id: string }) => {
        connectedIds.add(r.source_resource_id);
        connectedIds.add(r.target_resource_id);
      });

      let resourceDetails: Record<string, unknown>[] = [];
      if (connectedIds.size > 0) {
        const idList = Array.from(connectedIds);
        const [resRows] = await bq.query({
          query: `
            SELECT resource_id, resource_name, resource_type, environment, region, criticality
            FROM \`${PROJECT_ID}.${DATASET_ID}.resources\`
            WHERE resource_id IN UNNEST(@idList)
          `,
          params: { idList },
          location: LOCATION,
        });
        resourceDetails = resRows;
      }

      res.json({ ok: true, dependencies: rows, resources: resourceDetails, query });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        ok: false,
        error: 'BigQuery data unavailable',
        details: message,
        operation: `SELECT FROM ${PROJECT_ID}.${DATASET_ID}.dependencies_clean`,
        resourceId,
      });
    }
  });

  // ==========================================
  // 6. GET /api/incidents/:resourceId
  // ==========================================
  app.get('/api/incidents/:resourceId', async (req: Request, res: Response) => {
    const { resourceId } = req.params;
    try {
      const bq = getBigQuery();
      const query = `
        SELECT 
          incident_id,
          incident_date,
          resource_id,
          severity,
          incident_type,
          description,
          resolution
        FROM \`${PROJECT_ID}.${DATASET_ID}.incidents\`
        WHERE resource_id = @resourceId
        ORDER BY incident_date DESC
      `;
      const [rows] = await bq.query({
        query,
        params: { resourceId },
        location: LOCATION,
      });

      const sanitized = rows.map((row: Record<string, unknown>) => ({
        ...row,
        incident_date: formatDateField(row.incident_date),
      }));

      res.json({ ok: true, incidents: sanitized, query });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        ok: false,
        error: 'BigQuery data unavailable',
        details: message,
        operation: `SELECT FROM ${PROJECT_ID}.${DATASET_ID}.incidents`,
        resourceId,
      });
    }
  });

  // ==========================================
  // 7. POST /api/change-gate
  // ==========================================
  app.post('/api/change-gate', async (req: Request, res: Response) => {
    const { changeId, resourceId, evidence } = req.body;

    try {
      let finalEvidence = evidence;

      if (!finalEvidence && changeId) {
        const bq = getBigQuery();
        // Fetch change
        const [cRows] = await bq.query({
          query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.changes\` WHERE change_id = @changeId LIMIT 1`,
          params: { changeId },
          location: LOCATION,
        });
        if (cRows.length === 0) {
          return res.status(404).json({ ok: false, error: `Change ${changeId} not found` });
        }
        const changeRecord = cRows[0];
        const targetRes = resourceId || changeRecord.resource_id;

        // Fetch resource
        const [resRows] = await bq.query({
          query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.resources\` WHERE resource_id = @targetRes LIMIT 1`,
          params: { targetRes },
          location: LOCATION,
        });

        // Fetch risk_assessment
        const [riskRows] = await bq.query({
          query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.risk_assessment\` WHERE change_id = @changeId LIMIT 1`,
          params: { changeId },
          location: LOCATION,
        });

        // Fetch dependencies
        const [depRows] = await bq.query({
          query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.dependencies_clean\` WHERE source_resource_id = @targetRes OR target_resource_id = @targetRes`,
          params: { targetRes },
          location: LOCATION,
        });

        // Fetch incidents
        const [incRows] = await bq.query({
          query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.incidents\` WHERE resource_id = @targetRes`,
          params: { targetRes },
          location: LOCATION,
        });

        finalEvidence = {
          change: changeRecord,
          resource: resRows[0] || null,
          riskAssessment: riskRows[0] || null,
          dependencies: depRows,
          incidents: incRows,
        };
      }

      if (!finalEvidence) {
        return res.status(400).json({ ok: false, error: 'Either changeId or evidence payload is required' });
      }

      const gateResult = await evaluateGateDecision(finalEvidence);
      res.json({ ok: true, changeGate: gateResult, changeId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        ok: false,
        error: 'BigQuery data unavailable',
        details: message,
        operation: 'POST /api/change-gate',
      });
    }
  });

  // ==========================================
  // 8. Full Assessment: POST /api/assess
  // ==========================================
  app.post('/api/assess', async (req: Request, res: Response) => {
    const { changeId, resourceId } = req.body;
    if (!changeId) {
      return res.status(400).json({ ok: false, error: 'changeId is required' });
    }

    try {
      const bq = getBigQuery();

      // Step A: Retrieve Change
      const changesQuery = `
        SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.changes\`
        WHERE change_id = @changeId LIMIT 1
      `;
      const [changeRows] = await bq.query({
        query: changesQuery,
        params: { changeId },
        location: LOCATION,
      });

      if (changeRows.length === 0) {
        return res.status(404).json({ ok: false, error: `Change ID ${changeId} not found in BigQuery` });
      }

      const changeRecord = {
        ...changeRows[0],
        proposed_date: formatDateField(changeRows[0].proposed_date),
      };

      const targetResourceId = resourceId || changeRecord.resource_id;

      // Step B: Retrieve Resource
      const resourcesQuery = `
        SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.resources\`
        WHERE resource_id = @targetResourceId LIMIT 1
      `;
      const [resourceRows] = await bq.query({
        query: resourcesQuery,
        params: { targetResourceId },
        location: LOCATION,
      });
      const resourceRecord = resourceRows[0] || null;

      // Step C: Retrieve Risk Assessment
      const riskAssessmentQuery = `
        SELECT 
          change_id,
          resource_id,
          resource_type,
          resource_name,
          environment,
          criticality,
          change_category,
          historical_incident_count,
          potentially_affected_resource_count,
          risk_level
        FROM \`${PROJECT_ID}.${DATASET_ID}.risk_assessment\`
        WHERE change_id = @changeId LIMIT 1
      `;
      const [riskRows] = await bq.query({
        query: riskAssessmentQuery,
        params: { changeId },
        location: LOCATION,
      });
      const riskRecord = riskRows[0] || null;

      // Step D: Retrieve Dependencies
      const dependenciesQuery = `
        SELECT source_resource_id, target_resource_id, dependency_type
        FROM \`${PROJECT_ID}.${DATASET_ID}.dependencies_clean\`
        WHERE source_resource_id = @targetResourceId OR target_resource_id = @targetResourceId
      `;
      const [depRows] = await bq.query({
        query: dependenciesQuery,
        params: { targetResourceId },
        location: LOCATION,
      });

      const connectedResourceIds = new Set<string>();
      connectedResourceIds.add(targetResourceId);
      depRows.forEach((d: { source_resource_id: string; target_resource_id: string }) => {
        connectedIdsAdd(connectedResourceIds, d.source_resource_id);
        connectedIdsAdd(connectedResourceIds, d.target_resource_id);
      });

      let graphNodes: Record<string, unknown>[] = [];
      if (connectedResourceIds.size > 0) {
        const idList = Array.from(connectedResourceIds);
        const [nodeDetails] = await bq.query({
          query: `
            SELECT resource_id, resource_name, resource_type, environment, region, criticality
            FROM \`${PROJECT_ID}.${DATASET_ID}.resources\`
            WHERE resource_id IN UNNEST(@idList)
          `,
          params: { idList },
          location: LOCATION,
        });
        graphNodes = nodeDetails;
      }

      // Step E: Retrieve Incidents
      const incidentsQuery = `
        SELECT incident_id, incident_date, resource_id, severity, incident_type, description, resolution
        FROM \`${PROJECT_ID}.${DATASET_ID}.incidents\`
        WHERE resource_id = @targetResourceId
        ORDER BY incident_date DESC
      `;
      const [incidentRows] = await bq.query({
        query: incidentsQuery,
        params: { targetResourceId },
        location: LOCATION,
      });
      const incidents = incidentRows.map((r: Record<string, unknown>) => ({
        ...r,
        incident_date: formatDateField(r.incident_date),
      }));

      // Assemble Dependency Graph data
      const dependencyGraph = {
        nodes: graphNodes.map((node: Record<string, unknown>) => {
          const isSelected = node.resource_id === targetResourceId;
          return {
            resource_id: String(node.resource_id || ''),
            resource_name: String(node.resource_name || node.resource_id || ''),
            resource_type: String(node.resource_type || 'Unknown'),
            environment: String(node.environment || 'prod'),
            region: String(node.region || 'US'),
            criticality: String(node.criticality || 'STANDARD'),
            role: (isSelected ? 'selected' : 'affected') as 'selected' | 'affected' | 'dependency',
          };
        }),
        edges: depRows.map((d: { source_resource_id: string; target_resource_id: string; dependency_type: string }) => ({
          source: d.source_resource_id,
          target: d.target_resource_id,
          dependency_type: d.dependency_type || 'depends_on',
        })),
        totalAffected: Math.max(0, connectedResourceIds.size - 1),
      };

      const evidencePayload = {
        change: changeRecord,
        resource: resourceRecord,
        riskAssessment: riskRecord,
        dependencies: depRows,
        incidents,
      };

      // AI Risk Explanation
      let aiExplanationText = '';
      let aiSource: 'gemini' | 'evidence-fallback' | 'unavailable' = 'unavailable';
      let aiError: string | undefined = undefined;

      try {
        const gemini = getGemini();
        const geminiPrompt = `
You are the AI reasoning engine of CloudShield, an evidence-based Cloud Change Risk Assistant.
TASK: Interpret the following cloud telemetry evidence retrieved directly from Google BigQuery.
CRITICAL INSTRUCTION:
"Use only the supplied evidence. Do not invent facts, numbers, incidents, dependencies, resources or historical events. If evidence is insufficient, explicitly say so."

SUPPLIED EVIDENCE:
${JSON.stringify(evidencePayload, null, 2)}

Provide your response in JSON format with an "explanation" string addressing:
- Why the change has its current risk level (${riskRecord?.risk_level || 'Not provided in database'}).
- What specific evidence makes this change risky or safe (environment, criticality, change category).
- What parts of the dependency graph matter.
- Whether historical incidents increase concern (reference actual incident severity and resolutions).
`;

        const geminiResponse = await callWithTimeout(
          gemini.models.generateContent({
            model: VERTEX_MODEL,
            contents: geminiPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  explanation: { type: Type.STRING },
                },
                required: ['explanation'],
              },
            },
          }),
          4000
        );

        const parsed = JSON.parse(geminiResponse.text?.trim() || '{}');
        aiExplanationText = parsed.explanation || '';
        aiSource = 'gemini';
      } catch (geminiErr: unknown) {
        aiError = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        aiSource = 'unavailable';
        aiExplanationText = `Gemini AI reasoning unavailable: ${aiError}`;
      }

      // Evaluate Change Gate
      const changeGate = await evaluateGateDecision(evidencePayload);

      res.json({
        ok: true,
        change: changeRecord,
        resource: resourceRecord,
        riskAssessment: riskRecord,
        dependencies: depRows,
        dependencyGraph,
        incidents,
        aiExplanation: {
          content: aiExplanationText,
          source: aiSource,
          error: aiError,
        },
        changeGate,
        evidenceTrail: {
          changesQuery,
          resourcesQuery,
          riskAssessmentQuery,
          dependenciesQuery,
          incidentsQuery,
          retrievedAt: new Date().toISOString(),
          dataset: DATASET_ID,
          project: PROJECT_ID,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({
        ok: false,
        error: 'BigQuery data unavailable',
        details: message,
        operation: 'Full risk assessment query pipeline',
        project: PROJECT_ID,
        dataset: DATASET_ID,
      });
    }
  });

  // ==========================================
  // 9. What-If Simulator: POST /api/what-if
  // ==========================================
  app.post('/api/what-if', async (req: Request, res: Response) => {
    const { scenario, evidence } = req.body;
    if (!scenario || !evidence) {
      return res.status(400).json({ ok: false, error: 'Scenario and evidence payload are required' });
    }

    try {
      const gemini = getGemini();
      const whatIfPrompt = `
You are the What-If simulation engine in CloudShield.
ANALYTICAL SCENARIO SIMULATION ONLY: Do not execute actual cloud changes.
SCENARIO TO SIMULATE: "${scenario}"
AVAILABLE REAL EVIDENCE:
${JSON.stringify(evidence, null, 2)}
INSTRUCTION:
"Use only the supplied evidence. Do not invent facts, numbers, incidents, dependencies, resources or historical events. If evidence is insufficient, explicitly say so."
Do NOT invent numerical improvements. Provide a clearly labelled qualitative What-If analysis based on the actual evidence.

Return JSON strictly matching schema:
{
  "scenario": "${scenario}",
  "current": {
    "riskAssessment": "string",
    "potentialBlastRadius": "string",
    "historicalEvidence": "string",
    "productionExposure": "string",
    "recommendedSafeguards": ["string"]
  },
  "whatIf": {
    "riskAssessment": "string",
    "potentialBlastRadius": "string",
    "historicalEvidence": "string",
    "productionExposure": "string",
    "recommendedSafeguards": ["string"]
  },
  "analysis": "string summarizing qualitative difference."
}
`;

      const geminiResponse = await callWithTimeout(
        gemini.models.generateContent({
          model: VERTEX_MODEL,
          contents: whatIfPrompt,
          config: {
            responseMimeType: 'application/json',
          },
        }),
        4000
      );

      const parsed = JSON.parse(geminiResponse.text?.trim() || '{}');
      res.json({ ok: true, simulation: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('What-If Gemini call failed:', message);
      res.status(503).json({
        ok: false,
        error: 'Gemini simulation unavailable',
        details: message,
      });
    }
  });

  // =========================================================================
  // 10. Explicit Catch-All for /api/*: MUST prevent falling through to Vite/SPA HTML
  // =========================================================================
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: `API endpoint not found: ${req.method} ${req.originalUrl || req.path}`,
    });
  });

  // =========================================================================
  // 11. Global Express JSON Error Handler for /api/*
  // =========================================================================
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) {
      return next(err);
    }
    if (req.path.startsWith('/api') || req.url.startsWith('/api')) {
      res.status(err.status || 500).json({
        ok: false,
        error: err.message || 'Internal Server Error',
        details: String(err),
      });
      return;
    }
    next(err);
  });

  // =========================================================================
  // 12. Vite middleware for development vs static dist for production
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudShield server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting CloudShield server:', err);
  process.exit(1);
});
