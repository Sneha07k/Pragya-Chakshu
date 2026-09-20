import { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  RefreshCw,
  Copy,
  Check,
  Printer,
  Shield,
  Clock,
  Users,
  Server,
  Link2,
  AlertTriangle,
  FileText,
  Target,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { getCaseBriefing } from "../api";

export default function CaseBriefingModal({
  caseId,
  caseData,
  onClose,
  onSelectNode,
  isDark = true,
}) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("narrative");
  const [copied, setCopied] = useState(false);

  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCaseBriefing(caseId);
      setBriefing(data);
    } catch (err) {
      setError(err.message || "Failed to generate briefing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      fetchBriefing();
    }
  }, [caseId]);

  const handleCopyMarkdown = () => {
    if (!briefing) return;
    const n = briefing.executive_narrative || {};
    const scope = briefing.scope || {};
    const text = [
      `# ${n.headline || "CASE INTELLIGENCE BRIEFING"}`,
      `**Case:** ${briefing.case_name} (${briefing.case_id})`,
      `**Status:** ${briefing.status} | **Generated:** ${briefing.generated_at}`,
      `**Time Span:** ${scope.span_days} (${scope.min_date} to ${scope.max_date})`,
      `**Entities:** ${scope.total_personas} Personas | **Events:** ${scope.total_events}`,
      "",
      "## Executive Summary",
      ...(n.paragraphs || []).map((p) => `${p}\n`),
      "## High-Confidence Attributions",
      ...(briefing.high_confidence_attributions || []).map(
        (a) =>
          `- **${a.source_handle}** (${a.source_platform}) ↔ **${a.target_handle}** (${a.target_platform}): **${a.confidence_score}% Confidence**\n  - Signals: ${a.supporting_reasons.join(", ")}`,
      ),
      "",
      "## Recommended Next Inquiries",
      ...(briefing.recommendations || []).map(
        (r) => `- [${r.priority}] **${r.title}**: ${r.description}`,
      ),
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEntityJump = (handleOrId) => {
    if (onSelectNode) {
      onSelectNode(handleOrId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl border transition-all ${
          isDark
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
            isDark
              ? "border-slate-800 bg-slate-950/60"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Automated Case Briefing & Intelligence Summary
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/80">
                  Deterministic NLG • 0% Hallucination
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Case:{" "}
                <span className="font-semibold text-slate-200">
                  {caseData?.name || briefing?.case_name}
                </span>{" "}
                • Synthesized across relational storage, graph topology, and
                provenance layers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              disabled={!briefing || loading}
              className={`p-1.5 px-2.5 text-xs rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                  : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700"
              }`}
              title="Copy Briefing as Markdown"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{copied ? "Copied" : "Copy Briefing"}</span>
            </button>

            <button
              onClick={fetchBriefing}
              disabled={loading}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200"
                  : "bg-white hover:bg-slate-100 border-slate-300 text-slate-600"
              }`}
              title="Refresh Briefing"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`}
              />
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200"
                  : "bg-white hover:bg-slate-100 border-slate-300 text-slate-600"
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top KPIs Banner */}
        {briefing && (
          <div
            className={`grid grid-cols-5 divide-x border-b text-center px-2 py-3 text-xs shrink-0 ${
              isDark
                ? "bg-slate-950/40 border-slate-800 divide-slate-800/80"
                : "bg-slate-100/60 border-slate-200 divide-slate-200"
            }`}
          >
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Observed Span
              </div>
              <div className="text-sm font-bold font-mono text-cyan-400 mt-0.5">
                {briefing.scope?.span_days}
              </div>
              <div className="text-[9px] text-slate-500">
                {briefing.scope?.min_date} → {briefing.scope?.max_date}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Normalized Events
              </div>
              <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
                {briefing.scope?.total_events?.toLocaleString()}
              </div>
              <div className="text-[9px] text-blue-400">
                {briefing.provenance_breakdown?.RESEARCH} Authentic Research
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Tracked Personas
              </div>
              <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                {briefing.scope?.total_personas}
              </div>
              <div className="text-[9px] text-slate-500">
                {briefing.scope?.forum_personas_count} Forum •{" "}
                {briefing.scope?.market_personas_count} Market
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Primary Attributions
              </div>
              <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                {briefing.high_confidence_attributions?.length || 0}
              </div>
              <div className="text-[9px] text-slate-500">
                Cross-Platform Links
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Field Notes & Integrity
              </div>
              <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                {briefing.investigator_field_notes?.length || 0} Notes
              </div>
              <div className="text-[9px] text-slate-500">SHA-256 Locked</div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div
          className={`flex items-center gap-2 px-6 pt-2 border-b shrink-0 ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          <button
            onClick={() => setActiveTab("narrative")}
            className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "narrative"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Executive Narrative</span>
          </button>
          <button
            onClick={() => setActiveTab("attributions")}
            className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "attributions"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Key Suspects & Attributions</span>
            {briefing?.high_confidence_attributions?.length > 0 && (
              <span className="text-[10px] px-1.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                {briefing.high_confidence_attributions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("infrastructure")}
            className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "infrastructure"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Infrastructure & Collusion</span>
          </button>
          <button
            onClick={() => setActiveTab("recommendations")}
            className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "recommendations"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Recommended Inquiries</span>
            {briefing?.recommendations?.length > 0 && (
              <span className="text-[10px] px-1.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                {briefing.recommendations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "notes"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Field Notes & Provenance</span>
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm font-medium">
                Synthesizing executive briefing from forensic database...
              </p>
              <p className="text-xs text-slate-500">
                Correlating personas, extracting diurnal rhythms, and compiling
                chain of custody
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Briefing Generation Failed</span>
              </div>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          ) : briefing ? (
            <>
              {/* TAB 1: EXECUTIVE NARRATIVE */}
              {activeTab === "narrative" && (
                <div className="space-y-4 text-sm leading-relaxed">
                  <div
                    className={`p-4 rounded-lg border flex items-start gap-3 ${
                      isDark
                        ? "bg-slate-950/70 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <Shield className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-slate-200 text-sm">
                        {briefing.executive_narrative?.headline}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Generated deterministically from authentic SQLite event
                        store & graph topology.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 font-sans">
                    {briefing.executive_narrative?.paragraphs?.map(
                      (para, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border text-xs leading-relaxed transition-colors ${
                            isDark
                              ? "bg-slate-800/40 border-slate-800/80 text-slate-300 hover:border-slate-700"
                              : "bg-white border-slate-200 text-slate-700 shadow-xs"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                            {idx === 0
                              ? "1. Situation & Timeframe Scope"
                              : idx === 1
                                ? "2. Cross-Platform Actor Continuity"
                                : idx === 2
                                  ? "3. Telemetry & Infrastructure Attribution"
                                  : "4. Chain-of-Custody & Audit Veracity"}
                          </div>
                          <p>{para}</p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: KEY SUSPECTS & ATTRIBUTIONS */}
              {activeTab === "attributions" && (
                <div className="space-y-6">
                  {/* High Confidence Attributions */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-cyan-400" />
                      <span>Primary Cross-Platform Attributions</span>
                    </h3>
                    {briefing.high_confidence_attributions?.length === 0 ? (
                      <div className="p-4 rounded-lg border border-slate-800 text-slate-500 text-xs italic">
                        No high-confidence cross-platform correlations have
                        crossed the 40% threshold yet. Ingest additional slices
                        to populate correlation models.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {briefing.high_confidence_attributions.map((a, i) => (
                          <div
                            key={i}
                            className={`p-4 rounded-lg border transition-all ${
                              isDark
                                ? "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-cyan-400">
                                  {a.source_handle}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ({a.source_platform})
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-bold text-sm text-purple-400">
                                  {a.target_handle}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ({a.target_platform})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  {a.confidence_score}% Match
                                </span>
                                <button
                                  onClick={() =>
                                    handleEntityJump(a.source_handle)
                                  }
                                  className="text-[10px] px-2 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 flex items-center gap-1 cursor-pointer"
                                  title="Spotlight Persona in Investigation Graph"
                                >
                                  <span>Spotlight</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 mt-2">
                              {a.summary}
                            </p>

                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {a.supporting_reasons?.map((r, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Observed Personas */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>Top Tracked Personas</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {briefing.key_suspects?.map((p) => (
                        <div
                          key={p.persona_id}
                          className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                            isDark
                              ? "bg-slate-950/50 border-slate-800"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div>
                            <div className="font-bold text-slate-200 flex items-center gap-1.5">
                              <span>{p.handle}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {p.platform}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              First Seen: {p.first_seen?.slice(0, 10) || "N/A"}{" "}
                              • {p.identifiers_count} Identifiers
                            </div>
                          </div>
                          <button
                            onClick={() => handleEntityJump(p.handle)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 cursor-pointer"
                            title="Inspect in Graph"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: INFRASTRUCTURE & COLLUSION */}
              {activeTab === "infrastructure" && (
                <div className="space-y-6">
                  {/* Co-Hosted Infrastructure Clusters */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Server className="w-4 h-4 text-amber-400" />
                      <span>Co-Hosted Infrastructure (Capability 1)</span>
                      <span className="text-[9px] px-1.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        SYNTHETIC
                      </span>
                    </h3>

                    {briefing.infrastructure_findings?.length === 0 ? (
                      <div className="p-4 rounded-lg border border-slate-800 text-slate-500 text-xs italic">
                        No synthetic infrastructure telemetry generated yet.
                        Generate a cluster from the left panel to observe
                        co-hosting correlation.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {briefing.infrastructure_findings.map((inf, i) => (
                          <div
                            key={i}
                            className={`p-4 rounded-lg border ${
                              isDark
                                ? "bg-slate-950/60 border-slate-800"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div>
                                <span className="font-mono font-bold text-amber-400 text-sm">
                                  {inf.server_ip}
                                </span>
                                <span className="ml-2 text-slate-400 font-semibold">
                                  {inf.asn} ({inf.country})
                                </span>
                              </div>
                              <button
                                onClick={() => handleEntityJump(inf.server_ip)}
                                className="text-[10px] px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-300 flex items-center gap-1 cursor-pointer"
                              >
                                <span>Locate Server</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[10px]">
                                <div className="text-slate-500 uppercase font-bold">
                                  JARM TLS Fingerprint
                                </div>
                                <div className="text-slate-300 truncate mt-0.5">
                                  {inf.tls_cert?.jarm || "N/A"}
                                </div>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[10px]">
                                <div className="text-slate-500 uppercase font-bold">
                                  Certificate Subject
                                </div>
                                <div className="text-slate-300 truncate mt-0.5">
                                  {inf.tls_cert?.subject_cn || "N/A"}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 text-xs">
                              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1.5">
                                Co-Hosted Tor Hidden Services (.onion):
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {inf.co_hosted_services?.map((svc, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-900 text-slate-300 border border-slate-800"
                                  >
                                    {svc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Coordinated Activity Discoveries */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span>Coordinated Activity & Collusion (Capability 3)</span>
                      <span className="text-[9px] px-1.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                        DERIVED
                      </span>
                    </h3>

                    {briefing.coordination_findings?.length === 0 ? (
                      <div className="p-4 rounded-lg border border-slate-800 text-slate-500 text-xs italic">
                        No coordinated thread activity detected with latency Δt
                        &lt; 60s.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {briefing.coordination_findings.map((c, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                              isDark
                                ? "bg-slate-950/50 border-slate-800"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div>
                              <div className="font-bold text-slate-200">
                                {c.cluster_name}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {c.summary}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                              {c.coordination_score}% Coordination
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: RECOMMENDED NEXT INQUIRIES */}
              {activeTab === "recommendations" && (
                <div className="space-y-3">
                  <div
                    className={`p-4 rounded-lg border text-xs ${
                      isDark
                        ? "bg-slate-950/60 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <p className="text-slate-300">
                      The intelligence briefing engine generates prioritized
                      inquiry recommendations based on current evidentiary gaps,
                      unverified indicators, and contested attribution
                      hypotheses.
                    </p>
                  </div>

                  {briefing.recommendations?.map((rec, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border flex items-start justify-between gap-4 transition-all ${
                        rec.priority === "HIGH"
                          ? "border-rose-900/60 bg-rose-950/20"
                          : rec.priority === "MEDIUM"
                            ? "border-amber-900/60 bg-amber-950/20"
                            : "border-slate-800 bg-slate-900/40"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ${
                              rec.priority === "HIGH"
                                ? "bg-rose-900 text-rose-200"
                                : rec.priority === "MEDIUM"
                                  ? "bg-amber-900 text-amber-200"
                                  : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {rec.priority} Priority
                          </span>
                          <h4 className="font-bold text-xs text-slate-200">
                            {rec.title}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400">
                          {rec.description}
                        </p>
                      </div>

                      {rec.target_entity && (
                        <button
                          onClick={() => handleEntityJump(rec.target_entity)}
                          className="shrink-0 text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>Execute</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: FIELD NOTES & PROVENANCE */}
              {activeTab === "notes" && (
                <div className="space-y-6">
                  {/* Investigator Notes */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-400" />
                      <span>
                        Investigator Field Annotations (
                        {briefing.investigator_field_notes?.length || 0})
                      </span>
                    </h3>

                    {briefing.investigator_field_notes?.length === 0 ? (
                      <div className="p-4 rounded-lg border border-slate-800 text-slate-500 text-xs italic">
                        No field notes recorded yet. Use the Node Inspector or
                        Correlation Inspector to attach notes to case entities.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {briefing.investigator_field_notes.map((n) => (
                          <div
                            key={n.note_id}
                            className={`p-3 rounded-lg border text-xs ${
                              isDark
                                ? "bg-slate-950/60 border-slate-800"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200">
                                  {n.entity_label}
                                </span>
                                <span className="text-[9px] px-1 rounded bg-purple-950 text-purple-300 border border-purple-800">
                                  {n.entity_type}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-slate-500">
                                {n.created_at?.slice(0, 19).replace("T", " ")}
                              </span>
                            </div>
                            <p className="text-slate-300 mt-1.5 italic">
                              "{n.note_text}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tripartite Provenance Breakdown */}
                  <div
                    className={`p-4 rounded-lg border text-xs space-y-3 ${
                      isDark
                        ? "bg-slate-950/40 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-300">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span>Tripartite Provenance Quarantine Verification</span>
                    </div>
                    <p className="text-slate-400">
                      To preserve evidentiary standards and avoid cognitive
                      bias, data streams are strictly segregated:
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      <div className="p-2.5 rounded bg-blue-950/30 border border-blue-900/60 text-blue-200">
                        <div className="font-bold text-blue-400 uppercase text-[10px]">
                          Research
                        </div>
                        <div className="text-base font-bold font-mono mt-0.5">
                          {briefing.provenance_breakdown?.RESEARCH}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Authentic raw forum & market records.
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-purple-950/30 border border-purple-900/60 text-purple-200">
                        <div className="font-bold text-purple-400 uppercase text-[10px]">
                          Derived
                        </div>
                        <div className="text-base font-bold font-mono mt-0.5">
                          {briefing.provenance_breakdown?.DERIVED}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Algorithmic stylometry & correlation hypotheses.
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-amber-950/30 border border-amber-900/60 text-amber-200">
                        <div className="font-bold text-amber-400 uppercase text-[10px]">
                          Synthetic
                        </div>
                        <div className="text-base font-bold font-mono mt-0.5">
                          {briefing.provenance_breakdown?.SYNTHETIC}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Simulated infrastructure for safe demonstration.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div
          className={`flex items-center justify-between px-6 py-3 border-t shrink-0 text-xs ${
            isDark
              ? "border-slate-800 bg-slate-950/40 text-slate-500"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Cryptographic State Locked</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
          >
            Close Briefing
          </button>
        </div>
      </div>
    </div>
  );
}
