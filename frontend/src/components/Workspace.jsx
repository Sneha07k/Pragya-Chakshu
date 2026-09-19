import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Activity,
  RefreshCw,
  Database,
  ShieldCheck,
  Layers,
  Sparkles,
  Play,
  Pause,
  Square,
  Clock,
  FastForward,
  Server,
  Users,
  X,
  Share2,
  Target,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Download,
  FileText,
  ChevronDown,
} from "lucide-react";
import {
  getCaseGraph,
  ingestEvents,
  getCaseEvents,
  getCaseGroundTruth,
  listCorrelations,
  getReplayStatus,
  controlReplay,
  getReplayStreamUrl,
  generateSyntheticCluster,
  detectCoordination,
  getEvaluationBenchmark,
  getCaseExportJsonUrl,
  getCaseExportDossierUrl,
} from "../api";
import GraphCanvas from "./GraphCanvas";
import EventFeed from "./EventFeed";
import NodeInspector from "./NodeInspector";
import CorrelationInspector from "./CorrelationInspector";

export default function Workspace({ caseData, onBack }) {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [events, setEvents] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [correlating, setCorrelating] = useState(false);
  const [ingestSource, setIngestSource] = useState("forum");
  const [ingestLimit, setIngestLimit] = useState(20);
  const [evaluationMode, setEvaluationMode] = useState(false);
  const [groundTruthData, setGroundTruthData] = useState(null);

  // Time-Cursor Replay State
  const [replayStatus, setReplayStatus] = useState("STOPPED");
  const [replaySpeed, setReplaySpeed] = useState(5.0);
  const [replayCursor, setReplayCursor] = useState(null);
  const [eventsReplayedCount, setEventsReplayedCount] = useState(0);

  const eventSourceRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const caseId = caseData.case_id;
      const [gData, eData] = await Promise.all([
        getCaseGraph(caseId),
        getCaseEvents(caseId),
      ]);
      setGraphData(gData || { nodes: [], edges: [] });
      setEvents(eData?.events || eData || []);
    } catch (e) {
      console.error("Failed to load workspace data", e);
    } finally {
      setLoading(false);
    }
  };

  // Initial load & Replay SSE Listener setup
  useEffect(() => {
    loadData();

    // Fetch initial replay status
    getReplayStatus(caseData.case_id)
      .then((st) => {
        if (st) {
          setReplayStatus(st.status || "STOPPED");
          setReplaySpeed(st.speed || 5.0);
          setReplayCursor(st.cursor || null);
          setEventsReplayedCount(st.events_replayed || 0);
        }
      })
      .catch(() => {});

    // Open SSE stream
    const sseUrl = getReplayStreamUrl(caseData.case_id);
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener("new_observation", (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.cursor) setReplayCursor(data.cursor);
        if (data.events_replayed !== undefined)
          setEventsReplayedCount(data.events_replayed);
        if (data.event) {
          setEvents((prev) => [data.event, ...prev]);
        }
        // Refresh graph periodically
        loadData();
      } catch (e) {
        console.error("Error processing SSE observation", e);
      }
    });

    es.addEventListener("status_connected", (evt) => {
      try {
        const st = JSON.parse(evt.data);
        setReplayStatus(st.status);
      } catch (e) {}
    });

    es.addEventListener("status_changed", (evt) => {
      try {
        const st = JSON.parse(evt.data);
        setReplayStatus(st.status);
      } catch (e) {}
    });

    return () => {
      if (es) es.close();
    };
  }, [caseData.case_id]);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      await ingestEvents(caseData.case_id, Number(ingestLimit), ingestSource);
      await loadData();
    } catch (e) {
      console.error("Ingest failed", e);
    } finally {
      setIngesting(false);
    }
  };

  const handleRunCorrelation = async () => {
    setCorrelating(true);
    try {
      await listCorrelations(caseData.case_id, 0);
      await loadData();
    } catch (e) {
      console.error("Correlation failed", e);
    } finally {
      setCorrelating(false);
    }
  };

  const handlePlayReplay = async () => {
    try {
      const res = await controlReplay(caseData.case_id, "START", replaySpeed);
      setReplayStatus(res.status);
    } catch (e) {
      console.error("Failed to start replay", e);
    }
  };

  const handlePauseReplay = async () => {
    try {
      const res = await controlReplay(caseData.case_id, "PAUSE");
      setReplayStatus(res.status);
    } catch (e) {
      console.error("Failed to pause replay", e);
    }
  };

  const handleStopReplay = async () => {
    try {
      const res = await controlReplay(caseData.case_id, "STOP");
      setReplayStatus(res.status);
      setReplayCursor(null);
    } catch (e) {
      console.error("Failed to stop replay", e);
    }
  };

  const handleSpeedChange = async (newSpeed) => {
    setReplaySpeed(newSpeed);
    try {
      await controlReplay(caseData.case_id, "SET_SPEED", newSpeed);
    } catch (e) {
      console.error("Failed to set speed", e);
    }
  };

  const [benchmarkData, setBenchmarkData] = useState(null);
  const [benchmarkThreshold, setBenchmarkThreshold] = useState(10.0);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [evalActiveTab, setEvalActiveTab] = useState("benchmark"); // "benchmark" | "reference"

  const loadBenchmark = async (thresh = benchmarkThreshold) => {
    setLoadingBenchmark(true);
    try {
      const bData = await getEvaluationBenchmark(caseData.case_id, thresh);
      setBenchmarkData(bData);
    } catch (e) {
      console.error("Failed to load evaluation benchmark", e);
    } finally {
      setLoadingBenchmark(false);
    }
  };

  const handleToggleEvaluation = async () => {
    const nextState = !evaluationMode;
    setEvaluationMode(nextState);
    if (nextState) {
      if (!groundTruthData) {
        getCaseGroundTruth(caseData.case_id, 50)
          .then(setGroundTruthData)
          .catch(console.error);
      }
      loadBenchmark(benchmarkThreshold);
    }
  };

  const [generatingInfra, setGeneratingInfra] = useState(false);
  const [detectingCoord, setDetectingCoord] = useState(false);
  const [showCoordModal, setShowCoordModal] = useState(false);
  const [coordResults, setCoordResults] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleGenerateInfra = async () => {
    setGeneratingInfra(true);
    try {
      await generateSyntheticCluster(caseData.case_id);
      await loadData();
    } catch (e) {
      console.error("Failed to generate infrastructure", e);
    } finally {
      setGeneratingInfra(false);
    }
  };

  const handleDetectCoordination = async () => {
    setDetectingCoord(true);
    try {
      const res = await detectCoordination(caseData.case_id, 40);
      setCoordResults(res);
      setShowCoordModal(true);
      await loadData();
    } catch (e) {
      console.error("Failed to detect coordination", e);
    } finally {
      setDetectingCoord(false);
    }
  };

  // Compute graph statistics
  const personasCount =
    graphData.nodes?.filter((n) => n.data?.type === "Persona")?.length || 0;
  const postsCount =
    graphData.nodes?.filter((n) => n.data?.type === "Post")?.length || 0;
  const listingsCount =
    graphData.nodes?.filter((n) => n.data?.type === "Listing")?.length || 0;
  const serversCount =
    graphData.nodes?.filter((n) => n.data?.type === "Server")?.length || 0;
  const correlationsCount =
    graphData.edges?.filter((e) => e.data?.label === "CORRELATED_WITH")
      ?.length || 0;
  const coordinatedCount =
    graphData.edges?.filter((e) => e.data?.label === "COORDINATED_WITH")
      ?.length || 0;

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Cases
          </button>
          <div className="h-4 w-px bg-slate-700"></div>
          <h1 className="font-semibold text-slate-200">{caseData.name}</h1>
          <span className="text-xs bg-cyan-900/30 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 rounded-full">
            {caseData.status || "INVESTIGATING"}
          </span>
        </div>

        {/* Center: Graph Quick Stats */}
        <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Personas:{" "}
            <strong className="text-slate-200">{personasCount}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Posts: <strong className="text-slate-200">{postsCount}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Listings:{" "}
            <strong className="text-slate-200">{listingsCount}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Servers: <strong className="text-slate-200">{serversCount}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-pink-400"></span>
            Correlations:{" "}
            <strong className="text-slate-200">{correlationsCount}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Coordinated:{" "}
            <strong className="text-slate-200">{coordinatedCount}</strong>
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDetectCoordination}
            disabled={detectingCoord}
            className="text-xs bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-700 px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Detect Coordinated Activity (Capability 3)"
          >
            <Users
              className={`w-3.5 h-3.5 text-cyan-400 ${detectingCoord ? "animate-spin" : ""}`}
            />
            {detectingCoord ? "Analyzing..." : "Coordination"}
          </button>

          <button
            onClick={handleGenerateInfra}
            disabled={generatingInfra}
            className="text-xs bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-700 px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Generate controlled synthetic infrastructure cluster (Capability 1)"
          >
            <Server
              className={`w-3.5 h-3.5 text-rose-400 ${generatingInfra ? "animate-spin" : ""}`}
            />
            {generatingInfra ? "Generating..." : "+ Synthetic Cluster"}
          </button>

          <button
            onClick={handleRunCorrelation}
            disabled={correlating}
            className="text-xs bg-pink-900/30 hover:bg-pink-900/50 text-pink-300 border border-pink-700 px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Scan personas for multi-factor correlations"
          >
            <Sparkles
              className={`w-3.5 h-3.5 text-pink-400 ${correlating ? "animate-spin" : ""}`}
            />
            {correlating ? "Evaluating..." : "Correlate"}
          </button>

          <button
            onClick={handleToggleEvaluation}
            className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1.5 ${
              evaluationMode
                ? "bg-purple-900/40 text-purple-300 border-purple-700 hover:bg-purple-900/60"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
            title="Toggle Evaluation Mode (Ground Truth Reference)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            Evaluation Mode
          </button>

          {/* Export Dossier Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5"
              title="Export Forensic Case Dossier"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Export
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-md shadow-xl py-1 z-50">
                <a
                  href={getCaseExportDossierUrl(caseData.case_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowExportMenu(false)}
                  className="px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Printable Forensic Dossier (HTML)
                </a>
                <a
                  href={getCaseExportJsonUrl(caseData.case_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowExportMenu(false)}
                  className="px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Structured Case JSON
                </a>
              </div>
            )}
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors rounded hover:bg-slate-800"
            title="Refresh Graph"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`}
            />
          </button>
        </div>
      </header>

      {/* Time-Cursor Replay Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> Time-Cursor Replay
          </span>

          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase ${
              replayStatus === "RUNNING"
                ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700 animate-pulse"
                : replayStatus === "PAUSED"
                  ? "bg-amber-900/40 text-amber-400 border border-amber-700"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {replayStatus}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {replayStatus === "RUNNING" ? (
              <button
                onClick={handlePauseReplay}
                className="p-1 hover:bg-slate-800 text-amber-400 rounded transition-colors"
                title="Pause Replay"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handlePlayReplay}
                className="p-1 hover:bg-slate-800 text-emerald-400 rounded transition-colors"
                title="Play Chronological Replay"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleStopReplay}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
              title="Stop / Reset Cursor"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Multiplier */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <FastForward className="w-3 h-3" />
            <span>Speed:</span>
            {[1, 5, 20, 60].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  replaySpeed === s
                    ? "bg-cyan-600 text-white font-bold"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Current Time Cursor Display */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="text-slate-500">Historical Cursor:</span>
            <span className="text-cyan-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {replayCursor
                ? replayCursor.replace("T", " ").replace("Z", " UTC")
                : "1970-01-01 00:00:00 UTC (IDLE)"}
            </span>
          </div>

          <div className="text-slate-500 text-[11px]">
            Replayed:{" "}
            <strong className="text-slate-300">{eventsReplayedCount}</strong>{" "}
            events
          </div>
        </div>
      </div>

      {/* Evaluation Mode Banner */}
      {evaluationMode && (
        <div className="bg-purple-950/70 border-b border-purple-800/80 px-4 py-2 flex items-center justify-between text-xs text-purple-200 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>EVALUATION MODE ACTIVE:</strong> Showing historical
              ground-truth references from verified Evolution cross-platform
              matching archive. Isolated from analytical correlation engine.
            </span>
          </div>
          <span className="text-[11px] font-mono bg-purple-900/60 px-2 py-0.5 rounded border border-purple-700">
            PROVENANCE: EVALUATION_GROUND_TRUTH
          </span>
        </div>
      )}

      {/* Three Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Ingest Controls & Event Feed */}
        <aside className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col">
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Batch Ingestion
              </h2>
            </div>

            <div className="flex gap-2">
              <select
                value={ingestSource}
                onChange={(e) => setIngestSource(e.target.value)}
                className="flex-1 bg-slate-950 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none focus:border-cyan-500"
              >
                <option value="forum">Forum Posts (post.tsv)</option>
                <option value="vendors">Market Vendors (vendors.tsv)</option>
                <option value="listings">Listings (listings.tsv)</option>
                <option value="all">All Datasets (Combined)</option>
              </select>

              <select
                value={ingestLimit}
                onChange={(e) => setIngestLimit(e.target.value)}
                className="w-16 bg-slate-950 text-slate-200 text-xs rounded border border-slate-700 px-1 py-1 focus:outline-none focus:border-cyan-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <button
              onClick={handleIngest}
              disabled={ingesting}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs py-1.5 rounded font-medium transition-colors flex items-center justify-center gap-1"
            >
              {ingesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                  Ingesting...
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" /> Ingest Dataset Slice
                </>
              )}
            </button>
          </div>

          <div className="p-2 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-500" /> Live
              Observation Feed
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {events.length} events
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <EventFeed events={events} />
          </div>
        </aside>

        {/* CENTER: Graph Canvas or Evaluation Ground Truth Panel */}
        <main className="flex-1 relative bg-slate-950 flex flex-col">
          {evaluationMode ? (
            <div className="flex-1 p-6 overflow-y-auto space-y-5">
              {/* Header & Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                    Capability 2: Evaluation Mode & Benchmark
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluates multi-signal persona attribution against
                    historical ground-truth pairs (
                    <code className="text-purple-300">user-matching.tsv</code>).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-slate-900 border border-slate-800 rounded p-0.5 flex text-xs">
                    <button
                      onClick={() => setEvalActiveTab("benchmark")}
                      className={`px-3 py-1 rounded transition-colors font-medium ${
                        evalActiveTab === "benchmark"
                          ? "bg-purple-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Benchmark Metrics
                    </button>
                    <button
                      onClick={() => setEvalActiveTab("reference")}
                      className={`px-3 py-1 rounded transition-colors font-medium ${
                        evalActiveTab === "reference"
                          ? "bg-purple-600 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Ground Truth Reference
                    </button>
                  </div>
                </div>
              </div>

              {evalActiveTab === "benchmark" ? (
                <div className="space-y-5">
                  {/* Threshold Control Bar */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Target className="w-4 h-4 text-cyan-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          Confidence Score Threshold (τ):{" "}
                          <span className="text-cyan-400 font-mono">
                            {benchmarkThreshold}%
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Predictions with attribution score ≥ τ are counted as
                          predicted matches.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="5"
                        max="85"
                        step="5"
                        value={benchmarkThreshold}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBenchmarkThreshold(val);
                          loadBenchmark(val);
                        }}
                        className="w-44 accent-cyan-500 cursor-pointer"
                      />
                      <button
                        onClick={() => loadBenchmark(benchmarkThreshold)}
                        disabled={loadingBenchmark}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded transition-colors font-medium cursor-pointer"
                      >
                        {loadingBenchmark ? "Calculating..." : "Re-evaluate"}
                      </button>
                    </div>
                  </div>

                  {/* Benchmark KPI Cards */}
                  {benchmarkData && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                        <div className="text-xs text-slate-400 font-medium">
                          Precision
                        </div>
                        <div className="text-2xl font-bold text-emerald-400 mt-1">
                          {benchmarkData.metrics?.precision_percent}%
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          TP / (TP + FP) ={" "}
                          {benchmarkData.metrics?.true_positives} /{" "}
                          {benchmarkData.metrics?.true_positives +
                            benchmarkData.metrics?.false_positives}
                        </div>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                        <div className="text-xs text-slate-400 font-medium">
                          Recall
                        </div>
                        <div className="text-2xl font-bold text-cyan-400 mt-1">
                          {benchmarkData.metrics?.recall_percent}%
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          TP / (TP + FN) ={" "}
                          {benchmarkData.metrics?.true_positives} /{" "}
                          {benchmarkData.metrics?.total_case_ground_truth}
                        </div>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                        <div className="text-xs text-slate-400 font-medium">
                          F1 Score
                        </div>
                        <div className="text-2xl font-bold text-purple-400 mt-1">
                          {benchmarkData.metrics?.f1_score}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Harmonic mean of P & R
                        </div>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                        <div className="text-xs text-slate-400 font-medium">
                          Contingency
                        </div>
                        <div className="text-xs text-slate-200 mt-1.5 space-y-1 font-mono">
                          <div className="flex justify-between">
                            <span className="text-emerald-400">TP:</span>
                            <span>{benchmarkData.metrics?.true_positives}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-400">FP:</span>
                            <span>
                              {benchmarkData.metrics?.false_positives}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-rose-400">FN:</span>
                            <span>
                              {benchmarkData.metrics?.false_negatives}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* True Positive Matches Table */}
                  {benchmarkData?.true_positive_predictions?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Verified Ground Truth Attributions (True Positives)
                      </h3>
                      <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-medium">
                            <tr>
                              <th className="p-2.5">Forum Persona</th>
                              <th className="p-2.5">Market Persona</th>
                              <th className="p-2.5">UID \u2194 VID</th>
                              <th className="p-2.5">Attribution Score</th>
                              <th className="p-2.5">Ground Truth Match</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                            {benchmarkData.true_positive_predictions.map(
                              (p, idx) => (
                                <tr
                                  key={idx}
                                  className="hover:bg-slate-900/40 transition-colors"
                                >
                                  <td className="p-2.5 font-semibold text-cyan-400">
                                    {p.forum_handle}
                                  </td>
                                  <td className="p-2.5 font-semibold text-purple-400">
                                    {p.market_handle}
                                  </td>
                                  <td className="p-2.5 text-slate-400">
                                    {p.forum_uid} \u2194 {p.market_vid}
                                  </td>
                                  <td className="p-2.5 text-emerald-300 font-bold">
                                    {p.score}%
                                  </td>
                                  <td className="p-2.5">
                                    <span className="text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-sans">
                                      CONFIRMED MATCH
                                    </span>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* False Positive Predictions Table */}
                  {benchmarkData?.false_positive_predictions?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        Candidate Hypotheses Exceeding Threshold (Unverified /
                        Negative)
                      </h3>
                      <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-medium">
                            <tr>
                              <th className="p-2.5">Forum Persona</th>
                              <th className="p-2.5">Market Persona</th>
                              <th className="p-2.5">Attribution Score</th>
                              <th className="p-2.5">Classification</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                            {benchmarkData.false_positive_predictions.map(
                              (p, idx) => (
                                <tr
                                  key={idx}
                                  className="hover:bg-slate-900/40 transition-colors"
                                >
                                  <td className="p-2.5 font-semibold text-cyan-400">
                                    {p.forum_handle}
                                  </td>
                                  <td className="p-2.5 font-semibold text-purple-400">
                                    {p.market_handle}
                                  </td>
                                  <td className="p-2.5 text-amber-300 font-bold">
                                    {p.score}%
                                  </td>
                                  <td className="p-2.5">
                                    <span className="text-[10px] bg-amber-900/30 text-amber-400 border border-amber-800 px-2 py-0.5 rounded font-sans">
                                      FALSE POSITIVE (THRESHOLD EXCEEDED)
                                    </span>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Reference Ground Truth Table */
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400">
                      Unrevealed ground truth matches from{" "}
                      <code className="text-purple-300">user-matching.tsv</code>
                    </span>
                    <span className="text-xs bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded text-slate-300">
                      Total available:{" "}
                      <strong className="text-purple-300">
                        {groundTruthData?.total_reference_matches_available}
                      </strong>
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Match ID</th>
                          <th className="p-2.5">Verified Username</th>
                          <th className="p-2.5">Forum UID</th>
                          <th className="p-2.5">Market VID</th>
                          <th className="p-2.5">Evaluation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                        {groundTruthData?.sample_reference_matches?.map(
                          (m, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-slate-900/40 transition-colors"
                            >
                              <td className="p-2.5 text-slate-500">
                                #{m.match_id}
                              </td>
                              <td className="p-2.5 font-semibold text-cyan-400">
                                {m.username}
                              </td>
                              <td className="p-2.5">{m.uid}</td>
                              <td className="p-2.5">{m.vid}</td>
                              <td className="p-2.5">
                                <span className="text-[10px] bg-purple-900/30 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-sans">
                                  UNREVEALED_REFERENCE
                                </span>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 relative">
              <GraphCanvas
                elements={graphData}
                onNodeSelect={(node) => {
                  setSelectedNode(node);
                  setSelectedEdge(null);
                }}
                onEdgeSelect={(edge) => {
                  setSelectedEdge(edge);
                  setSelectedNode(null);
                }}
              />
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR: Inspector (Node or Correlation Edge) */}
        <aside className="w-80 border-l border-slate-800 bg-slate-900/50 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-medium text-slate-300 text-sm">
              {selectedEdge ? "Relationship Inspector" : "Forensic Inspector"}
            </h2>
            {selectedNode && (
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedNode.id?.substring(0, 16)}...
              </span>
            )}
            {selectedEdge && (
              <span className="text-[10px] text-pink-400 font-mono">
                {selectedEdge.label}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedEdge &&
            (selectedEdge.label === "CORRELATED_WITH" ||
              selectedEdge.score !== undefined) ? (
              <CorrelationInspector
                correlationEdge={selectedEdge}
                caseId={caseData.case_id}
                onCorrelationUpdated={loadData}
              />
            ) : (
              <NodeInspector node={selectedNode} caseId={caseData.case_id} />
            )}
          </div>
        </aside>
      </div>

      {/* Coordinated Activity Modal */}
      {showCoordModal && coordResults && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-slate-200 text-sm">
                  Capability 3: Coordinated Activity Discovery
                </h3>
                <span className="text-[10px] bg-cyan-900/40 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-mono">
                  DERIVED PROVENANCE
                </span>
              </div>
              <button
                onClick={() => setShowCoordModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3 text-center">
                  <div className="text-xl font-bold text-cyan-400">
                    {coordResults.pairs_analyzed || 0}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Interaction Pairs
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3 text-center">
                  <div className="text-xl font-bold text-purple-400">
                    {coordResults.coordination_clusters?.length || 0}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Operation Clusters
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3 text-center">
                  <div className="text-xl font-bold text-pink-400">
                    {coordResults.top_coordinated_pairs?.filter(
                      (p) => p.coordination_score >= 60,
                    ).length || 0}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    High Synchrony Pairs
                  </div>
                </div>
              </div>

              {/* Clusters List */}
              {coordResults.coordination_clusters?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                    Identified Coordination Groups
                  </h4>
                  <div className="space-y-2">
                    {coordResults.coordination_clusters.map((c) => (
                      <div
                        key={c.cluster_id}
                        className="bg-slate-950/50 border border-slate-800 rounded p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-medium text-cyan-300">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-1">
                            Members:{" "}
                            {c.members.map((m) => (
                              <span
                                key={m}
                                className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
                            Density {c.density}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pairs Table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                  Top Coordinated Persona Pairs
                </h4>
                <div className="border border-slate-800 rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                      <tr>
                        <th className="p-2.5">Personas</th>
                        <th className="p-2.5">Pattern</th>
                        <th className="p-2.5">Interactions</th>
                        <th className="p-2.5">Avg Latency</th>
                        <th className="p-2.5 text-right">Coordination Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {coordResults.top_coordinated_pairs
                        ?.slice(0, 10)
                        .map((pair, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="p-2.5 font-semibold text-cyan-400">
                              {pair.source_handle} ↔ {pair.target_handle}
                            </td>
                            <td className="p-2.5">
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                {pair.pattern}
                              </span>
                            </td>
                            <td className="p-2.5">{pair.interaction_count}</td>
                            <td className="p-2.5">
                              {pair.avg_response_latency_sec}s
                            </td>
                            <td className="p-2.5 text-right font-bold text-cyan-300">
                              {pair.coordination_score}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                onClick={() => setShowCoordModal(false)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-1.5 rounded transition-colors font-medium"
              >
                Close & Return to Graph
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
