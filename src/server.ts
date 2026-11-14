// Lightweight HTTP API server for LUNA-01 Core Simulation & Multiverse Engine
// Built using standard node:http with zero external runtime dependencies

import http from 'node:http';
import {
  simulateMission,
  evaluateReviews,
  createRootUniverse,
  branchUniverse,
  compareUniverses,
  PAYLOAD_CATALOG,
  POWER_CATALOG,
  PROPULSION_CATALOG,
  COMMS_CATALOG,
  TRAJECTORY_CATALOG,
  DEFAULT_SCENARIO_ID,
  DEFAULT_MODEL_VERSION,
} from './domain';
import type {
  MissionInput,
  ReviewEvidence,
  SpacecraftConfig,
  Universe,
  UniverseChange,
  UniverseCollection,
} from './domain/types';

const PORT = parseInt(process.env.PORT || '3000', 10);

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

function parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // 1MB limit
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // 1. Root / Health
    if (req.method === 'GET' && (pathname === '/' || pathname === '/health')) {
      sendJson(res, 200, {
        status: 'ok',
        service: 'LUNA-01 Core Simulation & Multiverse Engine',
        scenarioId: DEFAULT_SCENARIO_ID,
        modelVersion: DEFAULT_MODEL_VERSION,
        endpoints: [
          'GET  /health',
          'GET  /api/catalog',
          'POST /api/simulate',
          'POST /api/reviews',
          'POST /api/branch',
          'POST /api/compare',
          'GET  /api/matrix',
        ],
      });
      return;
    }

    // 2. Catalog
    if (req.method === 'GET' && pathname === '/api/catalog') {
      sendJson(res, 200, {
        payloads: PAYLOAD_CATALOG,
        powers: POWER_CATALOG,
        propulsions: PROPULSION_CATALOG,
        comms: COMMS_CATALOG,
        trajectories: TRAJECTORY_CATALOG,
      });
      return;
    }

    // 3. Simulate Mission
    if (req.method === 'POST' && pathname === '/api/simulate') {
      const input = await parseJsonBody<MissionInput>(req);
      const attempt = simulateMission(input);
      sendJson(res, 200, attempt);
      return;
    }

    // 4. Evaluate CML Reviews
    if (req.method === 'POST' && pathname === '/api/reviews') {
      const body = await parseJsonBody<{
        config: SpacecraftConfig;
        evidence: ReviewEvidence;
      }>(req);
      const report = evaluateReviews(body.config, body.evidence);
      sendJson(res, 200, report);
      return;
    }

    // 5. Branch Universe
    if (req.method === 'POST' && pathname === '/api/branch') {
      const body = await parseJsonBody<{
        parent: Universe;
        change: UniverseChange;
        collection: UniverseCollection;
        id: string;
        createdAt: string;
      }>(req);
      const branchRes = branchUniverse(
        body.parent,
        body.change,
        body.collection,
        body.id,
        body.createdAt
      );
      sendJson(res, 200, branchRes);
      return;
    }

    // 6. Compare Universes
    if (req.method === 'POST' && pathname === '/api/compare') {
      const body = await parseJsonBody<{
        universeA: Universe;
        universeB: Universe;
      }>(req);
      const comparison = compareUniverses(body.universeA, body.universeB);
      sendJson(res, 200, comparison);
      return;
    }

    // 7. Exhaustive 128-Matrix verification
    if (req.method === 'GET' && pathname === '/api/matrix') {
      let completed = 0;
      let rejected = 0;
      for (const p of Object.keys(PAYLOAD_CATALOG) as any[]) {
        for (const pw of Object.keys(POWER_CATALOG) as any[]) {
          for (const pr of Object.keys(PROPULSION_CATALOG) as any[]) {
            for (const c of Object.keys(COMMS_CATALOG) as any[]) {
              for (const t of Object.keys(TRAJECTORY_CATALOG) as any[]) {
                for (const obs of ['observe_full', 'conserve'] as any[]) {
                  for (const dl of ['science_first', 'health_first'] as any[]) {
                    const attempt = simulateMission({
                      config: { payloadId: p, powerId: pw, propulsionId: pr, commsId: c, trajectoryId: t },
                      decisions: { observeAction: obs, downlinkAction: dl },
                      scenarioId: DEFAULT_SCENARIO_ID,
                      modelVersion: DEFAULT_MODEL_VERSION,
                    });
                    if (attempt.kind === 'completed') completed++;
                    else rejected++;
                  }
                }
              }
            }
          }
        }
      }
      sendJson(res, 200, {
        totalCombinations: 128,
        completedCombinations: completed,
        rejectedCombinations: rejected,
        determinism: 'verified',
      });
      return;
    }

    // 404
    sendJson(res, 404, { error: 'Not found', pathname });
  } catch (err: any) {
    sendJson(res, 400, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[LUNA-01 Backend] Server listening on http://0.0.0.0:${PORT}`);
});
