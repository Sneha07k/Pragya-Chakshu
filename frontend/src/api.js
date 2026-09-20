const API_BASE = "/api";

export async function createCase(name, description) {
  const res = await fetch(`${API_BASE}/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  return res.json();
}

export async function listCases() {
  const res = await fetch(`${API_BASE}/cases`);
  return res.json();
}

export async function getCase(caseId) {
  const res = await fetch(`${API_BASE}/cases/${caseId}`);
  return res.json();
}

export async function getCaseGraph(caseId) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/graph`);
  return res.json();
}

export async function ingestEvents(caseId, limit = 20, source = "forum") {
  const res = await fetch(`${API_BASE}/cases/${caseId}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit, source }),
  });
  return res.json();
}

export async function getCaseEvents(caseId, limit = 50, offset = 0) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/events?limit=${limit}&offset=${offset}`,
  );
  return res.json();
}

export async function getCaseGroundTruth(caseId, limit = 50) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/ground-truth?limit=${limit}`,
  );
  return res.json();
}

export async function getPersonaStylometry(caseId, personaId) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/analytics/stylometry/${personaId}`,
  );
  return res.json();
}

export async function getPersonaBehavioral(caseId, personaId) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/analytics/behavioral/${personaId}`,
  );
  return res.json();
}

export async function comparePersonas(caseId, personaAId, personaBId) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/analytics/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      persona_a_id: personaAId,
      persona_b_id: personaBId,
    }),
  });
  return res.json();
}

export async function listCorrelations(caseId, minScore = 0) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/correlations?min_score=${minScore}`,
  );
  return res.json();
}

export async function getCorrelationDetail(caseId, personaAId, personaBId) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/correlations/${personaAId}/${personaBId}`,
  );
  return res.json();
}

export async function challengeEvidence(
  caseId,
  evidenceId,
  reason,
  investigatorId = "investigator_1",
) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/evidence/${evidenceId}/challenge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, investigator_id: investigatorId }),
    },
  );
  return res.json();
}

export async function restoreEvidence(
  caseId,
  evidenceId,
  investigatorId = "investigator_1",
) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/evidence/${evidenceId}/restore`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ investigator_id: investigatorId }),
    },
  );
  return res.json();
}

export async function getReplayStatus(caseId) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/replay/status`);
  return res.json();
}

export async function controlReplay(caseId, action, speed = null) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/replay/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, speed }),
  });
  return res.json();
}

export function getReplayStreamUrl(caseId) {
  return `${API_BASE}/cases/${caseId}/replay/stream`;
}

export async function generateSyntheticCluster(
  caseId,
  clusterName = "Evolution Infrastructure Cluster",
) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/synthetic/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cluster_name: clusterName }),
  });
  return res.json();
}

export async function listSyntheticClusters(caseId) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/synthetic/clusters`);
  return res.json();
}

export async function detectCoordination(caseId, maxPairs = 50) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/coordination/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_pairs: maxPairs }),
  });
  return res.json();
}

export async function getCoordinationClusters(caseId) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/coordination/clusters`);
  return res.json();
}

export async function getEvaluationBenchmark(caseId, threshold = 40.0) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/evaluation/benchmark?threshold=${threshold}`,
  );
  return res.json();
}

export function getCaseExportJsonUrl(caseId) {
  return `${API_BASE}/cases/${caseId}/export/json`;
}

export function getCaseExportDossierUrl(caseId) {
  return `${API_BASE}/cases/${caseId}/export/dossier`;
}

export async function addCaseNote(caseId, noteData) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(noteData),
  });
  return res.json();
}

export async function getCaseNotes(caseId, entityId = null) {
  const url = entityId
    ? `${API_BASE}/cases/${caseId}/notes?entity_id=${encodeURIComponent(entityId)}`
    : `${API_BASE}/cases/${caseId}/notes`;
  const res = await fetch(url);
  return res.json();
}

export async function deleteCaseNote(caseId, noteId) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/notes/${noteId}`, {
    method: "DELETE",
  });
  return res.json();
}

export async function getCaseBriefing(caseId) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/briefing`);
  return res.json();
}
