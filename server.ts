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

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs = 20000): Promise<T> {
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
      20000
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

// Safe in-memory caches with short TTL
let cachedChanges: { data: any; timestamp: number } | null = null;
const CHANGES_CACHE_TTL = 45000; // 45 seconds

const resourceCache = new Map<string, { data: any; timestamp: number }>();
const RESOURCE_CACHE_TTL = 120000; // 2 minutes

// Keyed strictly by changeId to guarantee no cross-change contamination
const assessmentCache = new Map<string, { data: any; timestamp: number }>();
const ASSESSMENT_CACHE_TTL = 60000; // 60 seconds

const whatIfCache = new Map<string, { data: any; timestamp: number }>();
const WHAT_IF_CACHE_TTL = 60000; // 60 seconds

async function generateAiExplanation(evidencePayload: any, riskLevel?: string): Promise<{
  content: string;
  source: 'gemini' | 'unavailable';
  error?: string;
}> {
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
- Why the change has its current risk level (${riskLevel || 'Not provided in database'}).
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
      20000
    );

    const parsed = JSON.parse(geminiResponse.text?.trim() || '{}');
    return {
      content: parsed.explanation || '',
      source: 'gemini',
    };
  } catch (geminiErr: unknown) {
    const aiError = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    return {
      content: `Gemini AI reasoning unavailable: ${aiError}`,
      source: 'unavailable',
      error: aiError,
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
    const bqPromise = (async () => {
      try {
        const bq = getBigQuery();
        const [rows] = await bq.query({
          query: `SELECT change_id FROM \`${PROJECT_ID}.${DATASET_ID}.changes\` LIMIT 1`,
          location: LOCATION,
        });
        return {
          connected: true,
          project: PROJECT_ID,
          dataset: DATASET_ID,
          location: LOCATION,
          verifiedQuery: `SELECT change_id FROM \`${PROJECT_ID}.${DATASET_ID}.changes\` LIMIT 1`,
          sampleRowsRetrieved: rows.length,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          connected: false,
          error: 'BigQuery data unavailable',
          details: message,
          project: PROJECT_ID,
          dataset: DATASET_ID,
          location: LOCATION,
        };
      }
    })();

    // Probe Gemini and BigQuery in parallel
    const [geminiStatus, bqStatus] = await Promise.all([
      checkGeminiStatus(req.query.force === 'true'),
      bqPromise,
    ]);

    if (bqStatus.connected) {
      res.json({
        ok: true,
        bigquery: bqStatus,
        gemini: geminiStatus,
      });
    } else {
      res.status(503).json({
        ok: false,
        bigquery: bqStatus,
        gemini: geminiStatus,
      });
    }
  });

  // ==========================================
  // 2. GET /api/changes
  // ==========================================
  app.get('/api/changes', async (req: Request, res: Response) => {
    const force = req.query.force === 'true';
    if (!force && cachedChanges && (Date.now() - cachedChanges.timestamp < CHANGES_CACHE_TTL)) {
      return res.json(cachedChanges.data);
    }

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

      const payload = { ok: true, changes: sanitized, query };
      cachedChanges = { data: payload, timestamp: Date.now() };

      res.json(payload);
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
    const force = req.query.force === 'true';
    if (!force && resourceCache.has(resourceId)) {
      const cached = resourceCache.get(resourceId)!;
      if (Date.now() - cached.timestamp < RESOURCE_CACHE_TTL) {
        return res.json(cached.data);
      }
    }

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

      const payload = { ok: true, resource: rows[0], query };
      resourceCache.set(resourceId, { data: payload, timestamp: Date.now() });

      res.json(payload);
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
        
        let changeRecord: any;
        let targetRes = resourceId;

        if (targetRes) {
          // Parallelize all 5 queries when resourceId is already known
          const [cRes, resRes, riskRes, depRes, incRes] = await Promise.all([
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.changes\` WHERE change_id = @changeId LIMIT 1`,
              params: { changeId },
              location: LOCATION,
            }),
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.resources\` WHERE resource_id = @targetRes LIMIT 1`,
              params: { targetRes },
              location: LOCATION,
            }),
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.risk_assessment\` WHERE change_id = @changeId LIMIT 1`,
              params: { changeId },
              location: LOCATION,
            }),
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.dependencies_clean\` WHERE source_resource_id = @targetRes OR target_resource_id = @targetRes`,
              params: { targetRes },
              location: LOCATION,
            }),
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.incidents\` WHERE resource_id = @targetRes`,
              params: { targetRes },
              location: LOCATION,
            }),
          ]);

          if (cRes[0].length === 0) {
            return res.status(404).json({ ok: false, error: `Change ${changeId} not found` });
          }

          finalEvidence = {
            change: cRes[0][0],
            resource: resRes[0][0] || null,
            riskAssessment: riskRes[0][0] || null,
            dependencies: depRes[0],
            incidents: incRes[0],
          };
        } else {
          // Fetch change first, then parallelize the remaining 4
          const [cRows] = await bq.query({
            query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.changes\` WHERE change_id = @changeId LIMIT 1`,
            params: { changeId },
            location: LOCATION,
          });
          if (cRows.length === 0) {
            return res.status(404).json({ ok: false, error: `Change ${changeId} not found` });
          }
          changeRecord = cRows[0];
          targetRes = changeRecord.resource_id;

          const [resRes, riskRes, depRes, incRes] = await Promise.all([
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.resources\` WHERE resource_id = @targetRes LIMIT 1`,
              params: { targetRes },
              location: LOCATION,
            }),
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.risk_assessment\` WHERE change_id = @changeId LIMIT 1`,
              params: { changeId },
              location: LOCATION,
            }),
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.dependencies_clean\` WHERE source_resource_id = @targetRes OR target_resource_id = @targetRes`,
              params: { targetRes },
              location: LOCATION,
            }),
            bq.query({
              query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.incidents\` WHERE resource_id = @targetRes`,
              params: { targetRes },
              location: LOCATION,
            }),
          ]);

          finalEvidence = {
            change: changeRecord,
            resource: resRes[0][0] || null,
            riskAssessment: riskRes[0][0] || null,
            dependencies: depRes[0],
            incidents: incRes[0],
          };
        }
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
    const { changeId, resourceId, force } = req.body;
    if (!changeId) {
      return res.status(400).json({ ok: false, error: 'changeId is required' });
    }

    // Safe in-memory caching keyed strictly by changeId
    if (!force && assessmentCache.has(changeId)) {
      const cached = assessmentCache.get(changeId)!;
      if (Date.now() - cached.timestamp < ASSESSMENT_CACHE_TTL) {
        return res.json(cached.data);
      }
    }

    try {
      const bq = getBigQuery();

      const changesQuery = `
        SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.changes\`
        WHERE change_id = @changeId LIMIT 1
      `;
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
      const resourcesQuery = `
        SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.resources\`
        WHERE resource_id = @targetResourceId LIMIT 1
      `;
      const dependenciesQuery = `
        SELECT source_resource_id, target_resource_id, dependency_type
        FROM \`${PROJECT_ID}.${DATASET_ID}.dependencies_clean\`
        WHERE source_resource_id = @targetResourceId OR target_resource_id = @targetResourceId
      `;
      const incidentsQuery = `
        SELECT incident_id, incident_date, resource_id, severity, incident_type, description, resolution
        FROM \`${PROJECT_ID}.${DATASET_ID}.incidents\`
        WHERE resource_id = @targetResourceId
        ORDER BY incident_date DESC
      `;

      let changeRows: any[];
      let resourceRows: any[] = [];
      let riskRows: any[] = [];
      let depRows: any[] = [];
      let incidentRows: any[] = [];

      // PARALLELIZE BIGQUERY QUERIES:
      // If resourceId is supplied by the caller, run all 5 queries simultaneously in Promise.all!
      if (resourceId) {
        const [cRes, resRes, riskRes, depRes, incRes] = await Promise.all([
          bq.query({ query: changesQuery, params: { changeId }, location: LOCATION }),
          bq.query({ query: resourcesQuery, params: { targetResourceId: resourceId }, location: LOCATION }),
          bq.query({ query: riskAssessmentQuery, params: { changeId }, location: LOCATION }),
          bq.query({ query: dependenciesQuery, params: { targetResourceId: resourceId }, location: LOCATION }),
          bq.query({ query: incidentsQuery, params: { targetResourceId: resourceId }, location: LOCATION }),
        ]);
        changeRows = cRes[0];
        resourceRows = resRes[0];
        riskRows = riskRes[0];
        depRows = depRes[0];
        incidentRows = incRes[0];
      } else {
        const [cRes] = await bq.query({ query: changesQuery, params: { changeId }, location: LOCATION });
        changeRows = cRes;
      }

      if (!changeRows || changeRows.length === 0) {
        return res.status(404).json({ ok: false, error: `Change ID ${changeId} not found in BigQuery` });
      }

      const changeRecord = {
        ...changeRows[0],
        proposed_date: formatDateField(changeRows[0].proposed_date),
      };

      const actualResourceId = changeRecord.resource_id;

      // In the rare event resourceId was not passed or differed from the actual record:
      if (!resourceId || actualResourceId !== resourceId) {
        const [resRes, riskRes, depRes, incRes] = await Promise.all([
          bq.query({ query: resourcesQuery, params: { targetResourceId: actualResourceId }, location: LOCATION }),
          riskRows.length > 0 ? Promise.resolve([riskRows]) : bq.query({ query: riskAssessmentQuery, params: { changeId }, location: LOCATION }),
          bq.query({ query: dependenciesQuery, params: { targetResourceId: actualResourceId }, location: LOCATION }),
          bq.query({ query: incidentsQuery, params: { targetResourceId: actualResourceId }, location: LOCATION }),
        ]);
        resourceRows = resRes[0];
        riskRows = riskRes[0];
        depRows = depRes[0];
        incidentRows = incRes[0];
      }

      const resourceRecord = resourceRows[0] || null;
      if (resourceRecord && resourceRecord.resource_id) {
        resourceCache.set(resourceRecord.resource_id, { data: { ok: true, resource: resourceRecord }, timestamp: Date.now() });
      }

      const riskRecord = riskRows[0] || null;
      const incidents = incidentRows.map((r: Record<string, unknown>) => ({
        ...r,
        incident_date: formatDateField(r.incident_date),
      }));

      // Correlate connected resources for Blast Radius
      const connectedResourceIds = new Set<string>();
      connectedResourceIds.add(actualResourceId);
      depRows.forEach((d: { source_resource_id: string; target_resource_id: string }) => {
        connectedIdsAdd(connectedResourceIds, d.source_resource_id);
        connectedIdsAdd(connectedResourceIds, d.target_resource_id);
      });

      let graphNodes: Record<string, unknown>[] = [];
      if (connectedResourceIds.size > 0) {
        const idList = Array.from(connectedResourceIds);
        // Optimize: if the only node is the target resource, reuse it directly without an extra query
        if (idList.length === 1 && resourceRecord) {
          graphNodes = [resourceRecord];
        } else {
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
          nodeDetails.forEach((node: any) => {
            if (node.resource_id) {
              resourceCache.set(node.resource_id, { data: { ok: true, resource: node }, timestamp: Date.now() });
            }
          });
        }
      }

      // Assemble Dependency Graph data
      const dependencyGraph = {
        nodes: graphNodes.map((node: Record<string, unknown>) => {
          const isSelected = node.resource_id === actualResourceId;
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

      // PARALLELIZE AI GENERATION:
      // Run AI Risk Explanation and Change Gate evaluation concurrently!
      const [aiExplanation, changeGate] = await Promise.all([
        generateAiExplanation(evidencePayload, riskRecord?.risk_level),
        evaluateGateDecision(evidencePayload),
      ]);

      const assessmentResult = {
        ok: true,
        change: changeRecord,
        resource: resourceRecord,
        riskAssessment: riskRecord,
        dependencies: depRows,
        dependencyGraph,
        incidents,
        aiExplanation,
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
      };

      // Store in safe in-memory cache strictly for this changeId
      assessmentCache.set(changeId, {
        data: assessmentResult,
        timestamp: Date.now(),
      });

      res.json(assessmentResult);
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

    const changeId = evidence?.change?.change_id || 'general';
    const cacheKey = `${changeId}:::${scenario}`;
    if (whatIfCache.has(cacheKey)) {
      const cached = whatIfCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < WHAT_IF_CACHE_TTL) {
        return res.json(cached.data);
      }
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
        20000
      );

      const parsed = JSON.parse(geminiResponse.text?.trim() || '{}');
      const payload = { ok: true, simulation: parsed };
      whatIfCache.set(cacheKey, { data: payload, timestamp: Date.now() });

      res.json(payload);
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
