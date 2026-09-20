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
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
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

export default function Workspace({
  caseData,
  onBack,
  theme = "dark",
  onToggleTheme,
}) {
  const isDark = theme === "dark";

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

  // Investigator Drawer States
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(true);
  const [leftTab, setLeftTab] = useState("feed"); // 'feed' | 'ingest' | 'replay'

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
  const [evalActiveTab, setEvalActiveTab] = useState("benchmark");
  const [loadingGroundTruth, setLoadingGroundTruth] = useState(false);
  const [groundTruthSearch, setGroundTruthSearch] = useState("");

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

  const loadGroundTruth = async () => {
    setLoadingGroundTruth(true);
    try {
      const data = await getCaseGroundTruth(caseData.case_id, 100);
      setGroundTruthData(data);
    } catch (e) {
      console.error("Failed to load ground truth", e);
    } finally {
      setLoadingGroundTruth(false);
    }
  };

  const handleToggleEvaluation = async () => {
    const nextState = !evaluationMode;
    setEvaluationMode(nextState);
    if (nextState) {
      if (!groundTruthData) {
        loadGroundTruth();
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
    <div
      className={`h-screen flex flex-col overflow-hidden transition-colors duration-200 ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* TOP NAVIGATION WORKBAR */}
      <header
        className={`h-14 border-b flex items-center justify-between px-4 shrink-0 transition-colors z-20 ${
          isDark
            ? "bg-slate-900/95 border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-800 shadow-2xs"
        }`}
      >
        {/* Left: Back & Case Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`transition-colors flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded border ${
              isDark
                ? "border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-800 mx-0.5"></div>

          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-tight truncate max-w-[200px]">
              {caseData.name}
            </h1>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                caseData.status === "ACTIVE"
                  ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/50"
                  : "bg-cyan-900/30 text-cyan-400 border-cyan-800/50"
              }`}
            >
              {caseData.status || "OPEN"}
            </span>
          </div>
        </div>

        {/* Center: Investigator KPI Pills */}
        <div className="hidden lg:flex items-center gap-3 text-xs">
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
              isDark
                ? "bg-slate-950 border-slate-800"
                : "bg-slate-100 border-slate-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Personas: <strong className="ml-0.5">{personasCount}</strong>
          </span>

          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
              isDark
                ? "bg-slate-950 border-slate-800"
                : "bg-slate-100 border-slate-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-pink-400"></span>
            Attributions:{" "}
            <strong className="ml-0.5">{correlationsCount}</strong>
          </span>

          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
              isDark
                ? "bg-slate-950 border-slate-800"
                : "bg-slate-100 border-slate-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            Events: <strong className="ml-0.5">{events.length}</strong>
          </span>
        </div>

        {/* Right: Core Capability Actions & Theme Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDetectCoordination}
            disabled={detectingCoord}
            className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
              isDark
                ? "bg-cyan-950/40 text-cyan-300 border-cyan-800/80 hover:bg-cyan-900/50"
                : "bg-cyan-50 text-cyan-700 border-cyan-300 hover:bg-cyan-100"
            }`}
            title="Detect Coordinated Activity (Capability 3)"
          >
            <Users
              className={`w-3.5 h-3.5 text-cyan-500 ${detectingCoord ? "animate-spin" : ""}`}
            />
            <span>{detectingCoord ? "Analyzing..." : "Coordination"}</span>
          </button>

          <button
            onClick={handleGenerateInfra}
            disabled={generatingInfra}
            className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
              isDark
                ? "bg-rose-950/40 text-rose-300 border-rose-800/80 hover:bg-rose-900/50"
                : "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
            }`}
            title="Generate controlled synthetic infrastructure cluster (Capability 1)"
          >
            <Server
              className={`w-3.5 h-3.5 text-rose-500 ${generatingInfra ? "animate-spin" : ""}`}
            />
            <span>{generatingInfra ? "Generating..." : "+ Infra"}</span>
          </button>

          <button
            onClick={handleRunCorrelation}
            disabled={correlating}
            className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
              isDark
                ? "bg-pink-950/40 text-pink-300 border-pink-800/80 hover:bg-pink-900/50"
                : "bg-pink-50 text-pink-700 border-pink-300 hover:bg-pink-100"
            }`}
            title="Run multi-signal persona correlation engine (Capability 2)"
          >
            <Sparkles
              className={`w-3.5 h-3.5 text-pink-500 ${correlating ? "animate-spin" : ""}`}
            />
            <span>{correlating ? "Scanning..." : "Correlate"}</span>
          </button>

          <button
            onClick={handleToggleEvaluation}
            className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
              evaluationMode
                ? "bg-purple-600 text-white border-purple-500 shadow-sm"
                : isDark
                  ? "bg-purple-950/40 text-purple-300 border-purple-800 hover:bg-purple-900/60"
                  : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
            }`}
            title="Evaluation Mode: Benchmark Precision/Recall against hidden Ground Truth"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Evaluation</span>
          </button>

          {/* Export Dossier Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
              }`}
            >
              <Download className="w-3.5 h-3.5 text-cyan-500" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showExportMenu && (
              <div
                className={`absolute right-0 mt-1 w-56 rounded-lg shadow-xl py-1 z-50 border backdrop-blur ${
                  isDark
                    ? "bg-slate-900/95 border-slate-700 text-slate-200"
                    : "bg-white/95 border-slate-200 text-slate-800"
                }`}
              >
                <a
                  href={getCaseExportDossierUrl(caseData.case_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowExportMenu(false)}
                  className={`px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                    isDark
                      ? "hover:bg-slate-800 text-slate-200"
                      : "hover:bg-slate-100 text-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-500" />
                  Printable Forensic Dossier (HTML)
                </a>
                <a
                  href={getCaseExportJsonUrl(caseData.case_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowExportMenu(false)}
                  className={`px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                    isDark
                      ? "hover:bg-slate-800 text-slate-200"
                      : "hover:bg-slate-100 text-slate-800"
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  Structured Case JSON
                </a>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-800 mx-0.5"></div>

          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                isDark
                  ? "bg-slate-950 border-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                  : "bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-100 shadow-2xs"
              }`}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-blue-600" />
              )}
            </button>
          )}

          {/* Panel Toggle Shortcuts */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                leftDrawerOpen
                  ? isDark
                    ? "bg-slate-800 text-cyan-400 border-cyan-800"
                    : "bg-slate-100 text-cyan-700 border-cyan-300"
                  : isDark
                    ? "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                    : "bg-white border-slate-200 text-slate-400 hover:text-slate-700"
              }`}
              title={
                leftDrawerOpen
                  ? "Collapse Activity Sidebar"
                  : "Expand Activity Sidebar"
              }
            >
              {leftDrawerOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={() => setRightDrawerOpen(!rightDrawerOpen)}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                rightDrawerOpen
                  ? isDark
                    ? "bg-slate-800 text-cyan-400 border-cyan-800"
                    : "bg-slate-100 text-cyan-700 border-cyan-300"
                  : isDark
                    ? "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                    : "bg-white border-slate-200 text-slate-400 hover:text-slate-700"
              }`}
              title={
                rightDrawerOpen
                  ? "Collapse Forensic Inspector"
                  : "Expand Forensic Inspector"
              }
            >
              {rightDrawerOpen ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Evaluation Mode Active Banner */}
      {evaluationMode && (
        <div className="bg-purple-950/70 border-b border-purple-800/80 px-4 py-1.5 flex items-center justify-between text-xs text-purple-200 shrink-0 z-10 backdrop-blur">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>EVALUATION BENCHMARK ACTIVE:</strong> Evaluating
              analytical hypotheses against hidden historical ground truth.
            </span>
          </div>
          <button
            onClick={() => setEvaluationMode(false)}
            className="text-[11px] underline hover:text-white cursor-pointer"
          >
            Return to Investigation Graph
          </button>
        </div>
      )}

      {/* THREE-PANEL INVESTIGATION WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT DRAWER (Feed / Ingest / Replay) */}
        {leftDrawerOpen ? (
          <aside
            className={`w-[340px] border-r flex flex-col shrink-0 transition-all duration-200 z-10 ${
              isDark
                ? "bg-slate-900/70 border-slate-800"
                : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            {/* Drawer Header with Tabs */}
            <div
              className={`p-2 border-b flex items-center justify-between ${
                isDark
                  ? "border-slate-800 bg-slate-950/60"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setLeftTab("feed")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    leftTab === "feed"
                      ? "bg-cyan-600 text-white shadow-xs"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Feed ({events.length})</span>
                </button>

                <button
                  onClick={() => setLeftTab("ingest")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    leftTab === "ingest"
                      ? "bg-cyan-600 text-white shadow-xs"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ingest</span>
                </button>

                <button
                  onClick={() => setLeftTab("replay")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    leftTab === "replay"
                      ? "bg-cyan-600 text-white shadow-xs"
                      : isDark
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Replay</span>
                  {replayStatus === "RUNNING" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              </div>

              <button
                onClick={() => setLeftDrawerOpen(false)}
                className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Tab 1: Live Observation Feed */}
            {leftTab === "feed" && (
              <div className="flex-1 overflow-y-auto">
                <EventFeed events={events} theme={theme} />
              </div>
            )}

            {/* Tab 2: Batch Dataset Ingestion */}
            {leftTab === "ingest" && (
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-cyan-500" /> Historical
                    Dataset Source
                  </h3>
                  <p className="text-[11px] opacity-70">
                    Stream slices from authentic Evolution forum and marketplace
                    research archives.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium opacity-80">
                    Dataset
                  </label>
                  <select
                    value={ingestSource}
                    onChange={(e) => setIngestSource(e.target.value)}
                    className={`w-full text-xs rounded-md border px-2.5 py-2 focus:outline-none focus:border-cyan-500 ${
                      isDark
                        ? "bg-slate-950 border-slate-700 text-slate-200"
                        : "bg-slate-50 border-slate-300 text-slate-800"
                    }`}
                  >
                    <option value="forum">Forum Posts (post.tsv)</option>
                    <option value="vendors">
                      Market Vendors (vendors.tsv)
                    </option>
                    <option value="listings">
                      Market Listings (listings.tsv)
                    </option>
                    <option value="all">
                      All Datasets (Combined Ingestion)
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium opacity-80">
                    Batch Size
                  </label>
                  <select
                    value={ingestLimit}
                    onChange={(e) => setIngestLimit(e.target.value)}
                    className={`w-full text-xs rounded-md border px-2.5 py-2 focus:outline-none focus:border-cyan-500 ${
                      isDark
                        ? "bg-slate-950 border-slate-700 text-slate-200"
                        : "bg-slate-50 border-slate-300 text-slate-800"
                    }`}
                  >
                    <option value={10}>10 records</option>
                    <option value={20}>20 records</option>
                    <option value={50}>50 records</option>
                  </select>
                </div>

                <button
                  onClick={handleIngest}
                  disabled={ingesting}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs py-2.5 rounded-md font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {ingesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Ingesting
                      Dataset...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" /> Ingest Dataset Slice
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Tab 3: Time-Cursor Replay Controls */}
            {leftTab === "replay" && (
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-cyan-500" /> Chronological
                      Replay
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase border ${
                        replayStatus === "RUNNING"
                          ? "bg-emerald-900/40 text-emerald-400 border-emerald-700 animate-pulse"
                          : replayStatus === "PAUSED"
                            ? "bg-amber-900/40 text-amber-400 border-amber-700"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {replayStatus}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-70">
                    Advances time cursor across authentic historical timestamps
                    via SSE.
                  </p>
                </div>

                {/* Play / Pause / Stop Buttons */}
                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 ${
                    isDark
                      ? "bg-slate-950 border-slate-800"
                      : "bg-slate-100 border-slate-200"
                  }`}
                >
                  {replayStatus === "RUNNING" ? (
                    <button
                      onClick={handlePauseReplay}
                      className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Pause className="w-4 h-4" /> Pause
                    </button>
                  ) : (
                    <button
                      onClick={handlePlayReplay}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-4 h-4" /> Start Replay
                    </button>
                  )}

                  <button
                    onClick={handleStopReplay}
                    className={`py-2 px-3 rounded font-medium text-xs flex items-center justify-center gap-1.5 border cursor-pointer ${
                      isDark
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                        : "bg-white hover:bg-slate-200 text-slate-700 border-slate-300"
                    }`}
                  >
                    <Square className="w-4 h-4" /> Reset
                  </button>
                </div>

                {/* Speed Multiplier */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs opacity-80">
                    <span>Replay Acceleration</span>
                    <span className="font-mono font-semibold text-cyan-500">
                      {replaySpeed}x
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 5, 20, 60].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className={`py-1.5 rounded text-xs font-mono font-semibold transition-colors cursor-pointer border ${
                          replaySpeed === s
                            ? "bg-cyan-600 text-white border-cyan-500 shadow-xs"
                            : isDark
                              ? "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                              : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Historical Cursor Display */}
                <div
                  className={`p-3 rounded-lg border space-y-1 ${
                    isDark
                      ? "bg-slate-950 border-slate-800"
                      : "bg-slate-100 border-slate-200"
                  }`}
                >
                  <div className="text-[10px] uppercase font-semibold opacity-60">
                    Historical Cursor
                  </div>
                  <div className="text-xs font-mono font-bold text-cyan-500 truncate">
                    {replayCursor
                      ? replayCursor.replace("T", " ").replace("Z", " UTC")
                      : "1970-01-01 00:00:00 UTC (IDLE)"}
                  </div>
                  <div className="text-[11px] opacity-70">
                    Replayed: <strong>{eventsReplayedCount}</strong> events
                  </div>
                </div>
              </div>
            )}
          </aside>
        ) : (
          /* Collapsed Left Icon Rail */
          <aside
            className={`w-12 border-r flex flex-col items-center py-3 gap-3 shrink-0 z-10 transition-colors ${
              isDark
                ? "bg-slate-900 border-slate-800"
                : "bg-white border-slate-200 shadow-2xs"
            }`}
          >
            <button
              onClick={() => setLeftDrawerOpen(true)}
              className="p-2 rounded opacity-70 hover:opacity-100 cursor-pointer"
              title="Expand Activity Drawer"
            >
              <ChevronRight className="w-4 h-4 text-cyan-500" />
            </button>

            <button
              onClick={() => {
                setLeftTab("feed");
                setLeftDrawerOpen(true);
              }}
              className="p-2 rounded opacity-70 hover:opacity-100 cursor-pointer relative"
              title={`Live Feed (${events.length})`}
            >
              <Activity className="w-4 h-4 text-cyan-500" />
              {events.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-cyan-500 absolute top-1 right-1" />
              )}
            </button>

            <button
              onClick={() => {
                setLeftTab("ingest");
                setLeftDrawerOpen(true);
              }}
              className="p-2 rounded opacity-70 hover:opacity-100 cursor-pointer"
              title="Dataset Ingestion"
            >
              <Database className="w-4 h-4 text-blue-500" />
            </button>

            <button
              onClick={() => {
                setLeftTab("replay");
                setLeftDrawerOpen(true);
              }}
              className="p-2 rounded opacity-70 hover:opacity-100 cursor-pointer relative"
              title={`Time Replay (${replayStatus})`}
            >
              <Clock className="w-4 h-4 text-purple-500" />
              {replayStatus === "RUNNING" && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse absolute top-1 right-1" />
              )}
            </button>
          </aside>
        )}

        {/* CENTER: Graph Canvas OR Evaluation Benchmark Dashboard */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          {evaluationMode ? (
            /* EVALUATION MODE DASHBOARD */
            <div className="flex-1 p-6 overflow-y-auto space-y-5">
              <div
                className={`flex items-center justify-between border-b pb-3 ${
                  isDark ? "border-slate-800" : "border-slate-200"
                }`}
              >
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-500" />
                    Capability 2: Evaluation Mode & Benchmark
                  </h2>
                  <p className="text-xs opacity-75 mt-0.5">
                    Evaluates multi-signal persona attribution against
                    historical ground truth (
                    <code className="text-purple-400 font-mono">
                      user-matching.tsv
                    </code>
                    ).
                  </p>
                </div>

                <div
                  className={`border rounded p-0.5 flex text-xs ${
                    isDark
                      ? "bg-slate-900 border-slate-800"
                      : "bg-slate-100 border-slate-200"
                  }`}
                >
                  <button
                    onClick={() => setEvalActiveTab("benchmark")}
                    className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                      evalActiveTab === "benchmark"
                        ? "bg-purple-600 text-white"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    Benchmark Metrics
                  </button>
                  <button
                    onClick={() => {
                      setEvalActiveTab("reference");
                      if (!groundTruthData && !loadingGroundTruth) {
                        loadGroundTruth();
                      }
                    }}
                    className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                      evalActiveTab === "reference"
                        ? "bg-purple-600 text-white"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    Ground Truth Catalog
                  </button>
                </div>
              </div>

              {evalActiveTab === "benchmark" ? (
                <div className="space-y-5">
                  {/* Threshold Control Bar */}
                  <div
                    className={`border rounded-xl p-4 flex items-center justify-between shadow-xs ${
                      isDark
                        ? "bg-slate-900/60 border-slate-800"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-cyan-500" />
                      <div>
                        <div className="text-xs font-semibold">
                          Confidence Score Threshold (τ):{" "}
                          <span className="text-cyan-500 font-mono font-bold">
                            {benchmarkThreshold}%
                          </span>
                        </div>
                        <div className="text-[11px] opacity-70">
                          Attribution hypotheses with score ≥ τ are evaluated as
                          predicted positives.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={benchmarkThreshold}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBenchmarkThreshold(val);
                          loadBenchmark(val);
                        }}
                        className="w-48 accent-cyan-500 cursor-pointer"
                      />
                      <button
                        onClick={() => loadBenchmark(benchmarkThreshold)}
                        disabled={loadingBenchmark}
                        className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer"
                      >
                        {loadingBenchmark ? "Calculating..." : "Re-evaluate"}
                      </button>
                    </div>
                  </div>

                  {/* Benchmark KPI Cards */}
                  {benchmarkData && (
                    <div className="grid grid-cols-4 gap-4">
                      <div
                        className={`border rounded-xl p-4 ${
                          isDark
                            ? "bg-slate-900/70 border-slate-800"
                            : "bg-white border-slate-200 shadow-2xs"
                        }`}
                      >
                        <div className="text-xs opacity-75 font-medium">
                          Precision
                        </div>
                        <div className="text-2xl font-bold text-emerald-500 mt-1">
                          {benchmarkData.metrics?.precision_percent}%
                        </div>
                        <div className="text-[11px] opacity-60 font-mono mt-0.5">
                          TP / (TP + FP) ={" "}
                          {benchmarkData.metrics?.true_positives} /{" "}
                          {(benchmarkData.metrics?.true_positives || 0) +
                            (benchmarkData.metrics?.false_positives || 0)}
                        </div>
                      </div>

                      <div
                        className={`border rounded-xl p-4 ${
                          isDark
                            ? "bg-slate-900/70 border-slate-800"
                            : "bg-white border-slate-200 shadow-2xs"
                        }`}
                      >
                        <div className="text-xs opacity-75 font-medium">
                          Recall
                        </div>
                        <div className="text-2xl font-bold text-cyan-500 mt-1">
                          {benchmarkData.metrics?.recall_percent}%
                        </div>
                        <div className="text-[11px] opacity-60 font-mono mt-0.5">
                          TP / (TP + FN) ={" "}
                          {benchmarkData.metrics?.true_positives} /{" "}
                          {(benchmarkData.metrics?.true_positives || 0) +
                            (benchmarkData.metrics?.false_negatives || 0)}
                        </div>
                      </div>

                      <div
                        className={`border rounded-xl p-4 ${
                          isDark
                            ? "bg-slate-900/70 border-slate-800"
                            : "bg-white border-slate-200 shadow-2xs"
                        }`}
                      >
                        <div className="text-xs opacity-75 font-medium">
                          F1 Score
                        </div>
                        <div className="text-2xl font-bold text-purple-500 mt-1">
                          {benchmarkData.metrics?.f1_score}
                        </div>
                        <div className="text-[11px] opacity-60 mt-0.5">
                          Harmonic mean of P & R
                        </div>
                      </div>

                      <div
                        className={`border rounded-xl p-4 ${
                          isDark
                            ? "bg-slate-900/70 border-slate-800"
                            : "bg-white border-slate-200 shadow-2xs"
                        }`}
                      >
                        <div className="text-xs opacity-75 font-medium">
                          Contingency
                        </div>
                        <div className="text-xs font-mono mt-1.5 space-y-0.5">
                          <div className="text-emerald-500 flex justify-between">
                            <span>TP (Verified):</span>{" "}
                            <strong>
                              {benchmarkData.metrics?.true_positives}
                            </strong>
                          </div>
                          <div className="text-amber-500 flex justify-between">
                            <span>FP (Mistakes):</span>{" "}
                            <strong>
                              {benchmarkData.metrics?.false_positives}
                            </strong>
                          </div>
                          <div className="text-rose-500 flex justify-between">
                            <span>FN (Missed):</span>{" "}
                            <strong>
                              {benchmarkData.metrics?.false_negatives}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Confirmed Matches Table */}
                  {benchmarkData?.true_positive_predictions?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        True Positive Predictions (Attribution Confirmed by
                        Ground Truth)
                      </h3>
                      <div
                        className={`border rounded-xl overflow-hidden ${
                          isDark ? "border-slate-800" : "border-slate-200"
                        }`}
                      >
                        <table className="w-full text-xs text-left">
                          <thead
                            className={`border-b font-medium ${
                              isDark
                                ? "bg-slate-900 text-slate-400 border-slate-800"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            <tr>
                              <th className="p-2.5">Forum Persona</th>
                              <th className="p-2.5">Market Persona</th>
                              <th className="p-2.5">Pairing (UID ↔ VID)</th>
                              <th className="p-2.5">Attribution Score</th>
                              <th className="p-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody
                            className={`divide-y font-mono ${
                              isDark
                                ? "divide-slate-800/60"
                                : "divide-slate-200"
                            }`}
                          >
                            {benchmarkData.true_positive_predictions.map(
                              (p, idx) => (
                                <tr
                                  key={idx}
                                  className={
                                    isDark
                                      ? "hover:bg-slate-900/40"
                                      : "hover:bg-slate-50"
                                  }
                                >
                                  <td className="p-2.5 font-semibold text-cyan-500">
                                    {p.forum_handle}
                                  </td>
                                  <td className="p-2.5 font-semibold text-purple-500">
                                    {p.market_handle}
                                  </td>
                                  <td className="p-2.5 opacity-75">
                                    {p.forum_uid} ↔ {p.market_vid}
                                  </td>
                                  <td className="p-2.5 text-emerald-500 font-bold">
                                    {p.score}%
                                  </td>
                                  <td className="p-2.5">
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 px-2 py-0.5 rounded font-sans font-semibold">
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
                </div>
              ) : (
                /* Ground Truth Reference Catalog */
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-purple-500" />
                        Verified Evolution Forum ↔ Market Ground Truth Archive
                      </h3>
                      <p className="text-[11px] opacity-70">
                        Historical ground truth pairings from{" "}
                        <code className="text-purple-400 font-mono">
                          user-matching.tsv
                        </code>{" "}
                        used to score attribution precision and recall.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={loadGroundTruth}
                        disabled={loadingGroundTruth}
                        className={`text-xs px-2.5 py-1.5 rounded-md border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isDark
                            ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                            : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs"
                        }`}
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-purple-500 ${loadingGroundTruth ? "animate-spin" : ""}`}
                        />
                        <span>
                          {loadingGroundTruth ? "Loading..." : "Reload Archive"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Filter & Counter Bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                      <input
                        type="text"
                        placeholder="Search by username, Forum UID, or Market VID..."
                        value={groundTruthSearch}
                        onChange={(e) => setGroundTruthSearch(e.target.value)}
                        className={`text-xs pl-8 pr-3 py-1.5 rounded-lg border w-full focus:outline-none focus:border-purple-500 ${
                          isDark
                            ? "bg-slate-900/90 border-slate-700 text-slate-200 placeholder-slate-500"
                            : "bg-white border-slate-300 text-slate-800 placeholder-slate-400 shadow-2xs"
                        }`}
                      />
                    </div>

                    <div className="text-[11px] opacity-75 font-mono">
                      {(() => {
                        const allMatches =
                          groundTruthData?.matches ||
                          groundTruthData?.sample_reference_matches ||
                          [];
                        const filtered = allMatches.filter((m) => {
                          if (!groundTruthSearch.trim()) return true;
                          const q = groundTruthSearch.toLowerCase().trim();
                          return (
                            (m.username &&
                              m.username.toLowerCase().includes(q)) ||
                            String(m.uid).includes(q) ||
                            String(m.vid).includes(q) ||
                            String(m.match_id).includes(q)
                          );
                        });
                        return `Showing ${filtered.length} of ${allMatches.length} ground-truth pairs`;
                      })()}
                    </div>
                  </div>

                  {/* Table or Empty State */}
                  {(() => {
                    const allMatches =
                      groundTruthData?.matches ||
                      groundTruthData?.sample_reference_matches ||
                      [];
                    const filtered = allMatches.filter((m) => {
                      if (!groundTruthSearch.trim()) return true;
                      const q = groundTruthSearch.toLowerCase().trim();
                      return (
                        (m.username && m.username.toLowerCase().includes(q)) ||
                        String(m.uid).includes(q) ||
                        String(m.vid).includes(q) ||
                        String(m.match_id).includes(q)
                      );
                    });

                    if (loadingGroundTruth && allMatches.length === 0) {
                      return (
                        <div className="p-8 text-center border rounded-xl flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
                          <span className="text-xs opacity-70">
                            Loading verified ground-truth archive from
                            database...
                          </span>
                        </div>
                      );
                    }

                    if (allMatches.length === 0) {
                      return (
                        <div
                          className={`p-8 text-center border rounded-xl flex flex-col items-center justify-center gap-3 ${
                            isDark
                              ? "border-slate-800 bg-slate-900/40"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <Database className="w-8 h-8 text-purple-500/60" />
                          <div>
                            <div className="text-xs font-semibold">
                              No Ground Truth Records Loaded
                            </div>
                            <p className="text-[11px] opacity-70 mt-0.5">
                              Click below to read and cache verified pairings
                              from{" "}
                              <code>
                                dataset/forum-market/user-matching.tsv
                              </code>
                              .
                            </p>
                          </div>
                          <button
                            onClick={loadGroundTruth}
                            disabled={loadingGroundTruth}
                            className="text-xs px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-medium cursor-pointer"
                          >
                            Load Ground Truth Now
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        className={`border rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto ${
                          isDark
                            ? "border-slate-800"
                            : "border-slate-200 shadow-2xs"
                        }`}
                      >
                        <table className="w-full text-xs text-left">
                          <thead
                            className={`border-b font-medium sticky top-0 z-10 backdrop-blur ${
                              isDark
                                ? "bg-slate-900/95 text-slate-400 border-slate-800"
                                : "bg-slate-100/95 text-slate-600 border-slate-200"
                            }`}
                          >
                            <tr>
                              <th className="p-2.5">ID</th>
                              <th className="p-2.5">Username</th>
                              <th className="p-2.5">Forum UID</th>
                              <th className="p-2.5">Market VID</th>
                              <th className="p-2.5">Provenance</th>
                            </tr>
                          </thead>
                          <tbody
                            className={`divide-y font-mono ${
                              isDark
                                ? "divide-slate-800/60"
                                : "divide-slate-200"
                            }`}
                          >
                            {filtered.map((m, idx) => (
                              <tr
                                key={idx}
                                className={
                                  isDark
                                    ? "hover:bg-slate-900/40"
                                    : "hover:bg-slate-50"
                                }
                              >
                                <td className="p-2.5 opacity-60">
                                  #{m.match_id}
                                </td>
                                <td className="p-2.5 font-semibold text-purple-500">
                                  {m.username}
                                </td>
                                <td className="p-2.5">{m.uid}</td>
                                <td className="p-2.5">{m.vid}</td>
                                <td className="p-2.5">
                                  <span className="text-[10px] bg-purple-500/20 text-purple-500 border border-purple-500/40 px-2 py-0.5 rounded font-sans">
                                    UNREVEALED_REFERENCE
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            /* INTERACTIVE GRAPH CANVAS */
            <div className="flex-1 w-full h-full relative">
              <GraphCanvas
                elements={graphData}
                theme={theme}
                onNodeSelect={(node) => {
                  setSelectedNode(node);
                  setSelectedEdge(null);
                  if (node) setRightDrawerOpen(true);
                }}
                onEdgeSelect={(edge) => {
                  setSelectedEdge(edge);
                  setSelectedNode(null);
                  if (edge) setRightDrawerOpen(true);
                }}
              />
            </div>
          )}
        </main>

        {/* RIGHT DRAWER: FORENSIC / RELATIONSHIP INSPECTOR */}
        {rightDrawerOpen ? (
          <aside
            className={`w-[340px] border-l flex flex-col shrink-0 transition-all duration-200 z-10 ${
              isDark
                ? "bg-slate-900/70 border-slate-800"
                : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div
              className={`p-3 border-b flex justify-between items-center ${
                isDark
                  ? "border-slate-800 bg-slate-950/60"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <h2 className="font-semibold text-xs uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-cyan-500" />
                {selectedEdge ? "Relationship Inspector" : "Forensic Inspector"}
              </h2>

              <button
                onClick={() => setRightDrawerOpen(false)}
                className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                title="Collapse Inspector"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedEdge && (
                <CorrelationInspector
                  relationship={selectedEdge}
                  caseId={caseData.case_id}
                  onEvidenceUpdated={loadData}
                />
              )}

              {!selectedEdge && (
                <NodeInspector node={selectedNode} caseId={caseData.case_id} />
              )}
            </div>
          </aside>
        ) : (
          /* Collapsed Right Tab Button */
          <button
            onClick={() => setRightDrawerOpen(true)}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 py-3 px-1.5 rounded-l-lg border-y border-l shadow-xl flex items-center gap-1 cursor-pointer transition-colors ${
              isDark
                ? "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
                : "bg-white border-slate-300 text-slate-700 hover:text-slate-950"
            }`}
            title="Expand Forensic Inspector"
          >
            <ChevronLeft className="w-4 h-4 text-cyan-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-lr] rotate-180">
              Inspector
            </span>
          </button>
        )}
      </div>

      {/* COORDINATED ACTIVITY MODAL */}
      {showCoordModal && coordResults && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl ${
              isDark
                ? "bg-slate-900 border-slate-700 text-slate-200"
                : "bg-white border-slate-200 text-slate-800"
            }`}
          >
            <div
              className={`p-4 border-b flex items-center justify-between ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                <h3 className="font-bold text-sm">
                  Capability 3: Coordinated Activity Analysis
                </h3>
              </div>
              <button
                onClick={() => setShowCoordModal(false)}
                className="p-1 rounded opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isDark
                    ? "bg-slate-950 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div>
                  <div className="text-[11px] opacity-60">
                    Coordinated Pairs Detected
                  </div>
                  <div className="text-xl font-bold text-cyan-500 mt-0.5">
                    {coordResults.coordinated_pairs_count}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] opacity-60">
                    Graph Links Added
                  </div>
                  <div className="text-xl font-bold text-purple-500 mt-0.5">
                    {coordResults.coordination_links_added}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold opacity-80">
                  Top Coordinated Persona Pairs
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {coordResults.top_coordinated_pairs?.map((cp, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex items-center justify-between ${
                        isDark
                          ? "bg-slate-950/70 border-slate-800"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-cyan-500">
                          {cp.source} ↔ {cp.target}
                        </div>
                        <div className="text-[10px] opacity-60 mt-0.5">
                          Pattern: {cp.pattern?.replace(/_/g, " ")} | Co-posts:{" "}
                          {cp.co_posts}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-cyan-500">
                          {cp.coordination_score}%
                        </div>
                        <div className="text-[10px] opacity-60">
                          Avg Δt: {cp.avg_latency_sec}s
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`p-3 border-t flex justify-end ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <button
                onClick={() => setShowCoordModal(false)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-medium text-xs cursor-pointer shadow-xs"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
