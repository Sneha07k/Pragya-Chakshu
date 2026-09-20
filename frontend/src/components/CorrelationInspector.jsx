import { useState, useEffect } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Scale,
} from "lucide-react";
import {
  getCorrelationDetail,
  challengeEvidence,
  restoreEvidence,
} from "../api";
import EntityNotes from "./EntityNotes";

export default function CorrelationInspector({
  correlationEdge,
  caseId,
  onCorrelationUpdated,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [challengeReason, setChallengeReason] = useState("");
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  const [processing, setProcessing] = useState(false);

  const sourceId = correlationEdge?.source;
  const targetId = correlationEdge?.target;

  const loadDetail = async () => {
    if (!caseId || !sourceId || !targetId) return;
    setLoading(true);
    try {
      const data = await getCorrelationDetail(caseId, sourceId, targetId);
      setDetail(data);
    } catch (e) {
      console.error("Failed to load correlation detail", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [caseId, sourceId, targetId]);

  const handleChallenge = async (evidenceId) => {
    if (!challengeReason.trim()) return;
    setProcessing(true);
    try {
      await challengeEvidence(caseId, evidenceId, challengeReason);
      setChallengeReason("");
      setActiveChallengeId(null);
      await loadDetail();
      if (onCorrelationUpdated) onCorrelationUpdated();
    } catch (e) {
      console.error("Challenge failed", e);
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async (evidenceId) => {
    setProcessing(true);
    try {
      await restoreEvidence(caseId, evidenceId);
      await loadDetail();
      if (onCorrelationUpdated) onCorrelationUpdated();
    } catch (e) {
      console.error("Restore failed", e);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-slate-500 text-center py-6 text-xs">
        Loading correlation analysis...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-slate-500 text-center py-6 text-xs">
        No correlation details found.
      </div>
    );
  }

  const supportingItems =
    detail.evidence_items?.filter((e) => e.polarity === "SUPPORTING") || [];
  const conflictingItems =
    detail.evidence_items?.filter((e) => e.polarity === "CONFLICTING") || [];

  return (
    <div className="space-y-4 text-xs">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-pink-400" /> Correlation
            Hypothesis
          </span>
          <span className="text-[9px] bg-purple-900/30 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded font-mono">
            PROVENANCE: DERIVED
          </span>
        </div>

        <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800 my-2">
          <div>
            <div className="font-semibold text-cyan-400 text-sm">
              {detail.persona_a?.handle}
            </div>
            <div className="text-[10px] text-slate-500">
              {detail.persona_a?.platform}
            </div>
          </div>
          <span className="text-slate-500 font-bold text-base">&harr;</span>
          <div className="text-right">
            <div className="font-semibold text-violet-400 text-sm">
              {detail.persona_b?.handle}
            </div>
            <div className="text-[10px] text-slate-500">
              {detail.persona_b?.platform}
            </div>
          </div>
        </div>
      </div>

      {/* Correlation Score Card */}
      <div className="bg-slate-900 p-3 rounded border border-slate-800 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-medium">Analytical Score</span>
          <span className="text-lg font-bold font-mono text-pink-400">
            {detail.correlation_score} / 100
          </span>
        </div>

        {/* Score Bar */}
        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-cyan-500 to-pink-500 h-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, detail.correlation_score))}%`,
            }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>Active Supp. Weight: +{detail.active_supporting_weight}</span>
          <span>Active Conf. Weight: -{detail.active_conflicting_weight}</span>
        </div>

        <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-800/60">
          * Analytical score represents mathematical correlation of observed
          signals. It is not identity proof.
        </p>
      </div>

      {/* Supporting Evidence */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase font-semibold text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Supporting Evidence (
          {supportingItems.length})
        </div>

        {supportingItems.length === 0 ? (
          <div className="text-slate-500 text-[11px] p-2 bg-slate-900/50 rounded border border-slate-800/50">
            No supporting evidence items recorded.
          </div>
        ) : (
          supportingItems.map((item) => {
            const isChallenged = item.challenge_status === "CHALLENGED";
            return (
              <div
                key={item.evidence_id}
                className={`p-2.5 rounded border transition-all ${
                  isChallenged
                    ? "bg-slate-900/30 border-slate-800/40 opacity-60 line-through-text"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-slate-200 text-[11px]">
                    {item.evidence_type}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      +{item.confidence_weight}
                    </span>
                    {isChallenged && (
                      <span className="text-[9px] bg-amber-900/40 text-amber-300 border border-amber-800 px-1 rounded">
                        CHALLENGED
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-slate-300 text-[11px] mb-2">
                  {item.description}
                </p>

                {/* Challenge / Restore Actions */}
                {isChallenged ? (
                  <button
                    onClick={() => handleRestore(item.evidence_id)}
                    disabled={processing}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" /> Restore
                    Evidence
                  </button>
                ) : activeChallengeId === item.evidence_id ? (
                  <div className="space-y-1.5 pt-1 border-t border-slate-800">
                    <input
                      type="text"
                      value={challengeReason}
                      onChange={(e) => setChallengeReason(e.target.value)}
                      placeholder="Investigator challenge reason (e.g. shared VPN, common boilerplate)..."
                      className="w-full bg-slate-950 text-slate-200 text-[11px] rounded border border-slate-700 px-2 py-1 focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleChallenge(item.evidence_id)}
                        disabled={processing || !challengeReason.trim()}
                        className="text-[10px] bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-2 py-0.5 rounded font-medium transition-colors"
                      >
                        Submit Challenge
                      </button>
                      <button
                        onClick={() => setActiveChallengeId(null)}
                        className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded hover:text-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setActiveChallengeId(item.evidence_id);
                      setChallengeReason("");
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" /> Challenge this
                    evidence
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Conflicting Evidence */}
      {conflictingItems.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-semibold text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Conflicting Evidence (
            {conflictingItems.length})
          </div>

          {conflictingItems.map((item) => {
            const isChallenged = item.challenge_status === "CHALLENGED";
            return (
              <div
                key={item.evidence_id}
                className={`p-2.5 rounded border transition-all ${
                  isChallenged
                    ? "bg-slate-900/30 border-slate-800/40 opacity-60"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-slate-200 text-[11px]">
                    {item.evidence_type}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-rose-400 font-bold">
                      -{item.confidence_weight}
                    </span>
                    {isChallenged && (
                      <span className="text-[9px] bg-amber-900/40 text-amber-300 border border-amber-800 px-1 rounded">
                        CHALLENGED
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-slate-300 text-[11px] mb-2">
                  {item.description}
                </p>

                {isChallenged ? (
                  <button
                    onClick={() => handleRestore(item.evidence_id)}
                    disabled={processing}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" /> Restore
                    Evidence
                  </button>
                ) : activeChallengeId === item.evidence_id ? (
                  <div className="space-y-1.5 pt-1 border-t border-slate-800">
                    <input
                      type="text"
                      value={challengeReason}
                      onChange={(e) => setChallengeReason(e.target.value)}
                      placeholder="Investigator challenge reason..."
                      className="w-full bg-slate-950 text-slate-200 text-[11px] rounded border border-slate-700 px-2 py-1 focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleChallenge(item.evidence_id)}
                        disabled={processing || !challengeReason.trim()}
                        className="text-[10px] bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-2 py-0.5 rounded font-medium transition-colors"
                      >
                        Submit Challenge
                      </button>
                      <button
                        onClick={() => setActiveChallengeId(null)}
                        className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded hover:text-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setActiveChallengeId(item.evidence_id);
                      setChallengeReason("");
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" /> Challenge this
                    evidence
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Challenge Audit History */}
      {detail.challenge_audit_history?.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            Investigation Audit Trail ({detail.challenge_audit_history.length})
          </div>
          <div className="space-y-1.5 font-mono text-[10px]">
            {detail.challenge_audit_history.map((log) => (
              <div
                key={log.challenge_id}
                className="bg-slate-900/60 p-2 rounded border border-slate-800 text-slate-400"
              >
                <div className="flex justify-between text-slate-300 font-semibold mb-0.5">
                  <span
                    className={
                      log.action === "CHALLENGE"
                        ? "text-amber-400"
                        : "text-cyan-400"
                    }
                  >
                    {log.action} by {log.investigator_id}
                  </span>
                  <span>
                    Score: {log.previous_score} &rarr; {log.new_score}
                  </span>
                </div>
                <div className="text-slate-400">{log.reason}</div>
                <div className="text-slate-500 text-[9px] mt-0.5">
                  {log.timestamp}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investigator Field Notes & Observations on this Evidence Link */}
      <EntityNotes
        caseId={caseId}
        entityType="EVIDENCE"
        entityId={`${sourceId}_${targetId}`}
        entityLabel={`Correlation: ${detail.source_persona?.canonical_handle || sourceId} ↔ ${detail.target_persona?.canonical_handle || targetId}`}
      />
    </div>
  );
}
