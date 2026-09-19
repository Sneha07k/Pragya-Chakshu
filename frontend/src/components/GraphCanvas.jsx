import { useEffect, useRef, useState, useMemo } from "react";
import cytoscape from "cytoscape";
import {
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Info,
  Layers,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sliders,
  X,
  Target,
  Share2,
  Radio,
  Server,
} from "lucide-react";

export default function GraphCanvas({ elements, onNodeSelect, onEdgeSelect }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  // View Presets: 'CORE' | 'ATTRIBUTION' | 'COORDINATION' | 'INFRASTRUCTURE' | 'FULL'
  const [viewPreset, setViewPreset] = useState("CORE");

  // Granular Filter Toggles
  const [showPosts, setShowPosts] = useState(false);
  const [showCaseHub, setShowCaseHub] = useState(false);
  const [showPartOfEdges, setShowPartOfEdges] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [minCorrScore, setMinCorrScore] = useState(0);

  // Layout selection: 'cose' | 'concentric' | 'breadthfirst' | 'circle'
  const [layoutName, setLayoutName] = useState("cose");

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [showLegend, setShowLegend] = useState(false);
  const [activeFocusNode, setActiveFocusNode] = useState(null);

  // Filter elements based on presets & toggles
  const filteredElements = useMemo(() => {
    if (!elements || !elements.nodes) return { nodes: [], edges: [] };

    const rawNodes = elements.nodes || [];
    const rawEdges = elements.edges || [];

    // Filter nodes
    const acceptedNodes = rawNodes.filter((n) => {
      const data = n.data || {};
      const type = data.type || "Persona";

      if (viewPreset === "ATTRIBUTION") {
        return type === "Persona" || type === "Identifier";
      }
      if (viewPreset === "COORDINATION") {
        return type === "Persona";
      }
      if (viewPreset === "INFRASTRUCTURE") {
        return (
          type === "Server" ||
          type === "Certificate" ||
          type === "HiddenService"
        );
      }
      if (viewPreset === "CORE") {
        if (type === "Post" && !showPosts) return false;
        if (type === "Case" && !showCaseHub) return false;
        return true;
      }
      // FULL preset
      if (!showPosts && type === "Post") return false;
      if (!showCaseHub && type === "Case") return false;
      return true;
    });

    const acceptedNodeIds = new Set(acceptedNodes.map((n) => n.data.id));

    // Filter edges
    const acceptedEdges = rawEdges.filter((e) => {
      const data = e.data || {};
      const label = data.label || "";
      const src = data.source;
      const tgt = data.target;

      if (!acceptedNodeIds.has(src) || !acceptedNodeIds.has(tgt)) return false;

      if (label === "PART_OF" && !showPartOfEdges) return false;

      if (viewPreset === "ATTRIBUTION") {
        return label === "CORRELATED_WITH" || label === "USES_IDENTIFIER";
      }
      if (viewPreset === "COORDINATION") {
        return label === "COORDINATED_WITH";
      }
      if (viewPreset === "INFRASTRUCTURE") {
        return (
          label === "HOSTED_ON" ||
          label === "SERVES_CERTIFICATE" ||
          label === "CO_HOSTED_SERVER"
        );
      }

      if (label === "CORRELATED_WITH") {
        const score = Number(data.score) || 0;
        if (score < minCorrScore) return false;
      }

      return true;
    });

    return { nodes: acceptedNodes, edges: acceptedEdges };
  }, [
    elements,
    viewPreset,
    showPosts,
    showCaseHub,
    showPartOfEdges,
    minCorrScore,
  ]);

  // Cytoscape initialization & update
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: filteredElements,
      boxSelectionEnabled: false,
      style: [
        // Base Node Style
        {
          selector: "node",
          style: {
            label: "data(label)",
            color: "#e2e8f0",
            "font-size": "11px",
            "font-family": "Inter, system-ui, sans-serif",
            "font-weight": 500,
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-background-color": "#090d16",
            "text-background-opacity": 0.85,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
            "border-width": 2,
            "border-color": "#1e293b",
            "transition-property":
              "opacity, background-color, border-color, border-width, width, height",
            "transition-duration": "0.2s",
          },
        },
        // Persona Node (Cyan / Forum)
        {
          selector: 'node[type="Persona"]',
          style: {
            shape: "ellipse",
            "background-color": "#06b6d4", // cyan-500
            "border-color": "#22d3ee",
            width: 38,
            height: 38,
          },
        },
        // Market Vendor Persona (Violet border)
        {
          selector: 'node[platform="Evolution Market"]',
          style: {
            "background-color": "#8b5cf6", // violet-500
            "border-color": "#c084fc",
            "border-width": 3,
            width: 42,
            height: 42,
          },
        },
        // Post Node (Muted slate)
        {
          selector: 'node[type="Post"]',
          style: {
            shape: "round-rectangle",
            "background-color": "#475569", // slate-600
            "border-color": "#64748b",
            width: 26,
            height: 26,
            "font-size": "9px",
          },
        },
        // Identifier Node (Amber Diamond)
        {
          selector: 'node[type="Identifier"]',
          style: {
            shape: "diamond",
            "background-color": "#f59e0b", // amber-500
            "border-color": "#fbbf24",
            width: 34,
            height: 34,
          },
        },
        // Listing Node (Emerald)
        {
          selector: 'node[type="Listing"]',
          style: {
            shape: "round-rectangle",
            "background-color": "#10b981", // emerald-500
            "border-color": "#34d399",
            width: 32,
            height: 32,
          },
        },
        // Physical Server Node (Rose Diamond)
        {
          selector: 'node[type="Server"]',
          style: {
            shape: "diamond",
            "background-color": "#e11d48", // rose-600
            width: 46,
            height: 46,
            "border-color": "#fda4af",
            "border-width": 2.5,
          },
        },
        // TLS Certificate (Amber Hexagon)
        {
          selector: 'node[type="Certificate"]',
          style: {
            shape: "hexagon",
            "background-color": "#d97706", // amber-600
            width: 38,
            height: 38,
            "border-color": "#fde68a",
            "border-width": 2,
          },
        },
        // Tor Hidden Service (Purple Rounded)
        {
          selector: 'node[type="HiddenService"]',
          style: {
            shape: "round-rectangle",
            "background-color": "#9333ea", // purple-600
            width: 36,
            height: 36,
            "border-color": "#d8b4fe",
            "border-width": 2,
          },
        },
        // Case Hub Node (Blue Hexagon)
        {
          selector: 'node[type="Case"]',
          style: {
            shape: "hexagon",
            "background-color": "#2563eb", // blue-600
            width: 48,
            height: 48,
            "border-color": "#60a5fa",
            "border-width": 3,
          },
        },
        // Base Edge Style
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#334155",
            "target-arrow-color": "#334155",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "bezier",
            "font-size": "9px",
            color: "#94a3b8",
            "text-rotation": "autorotate",
            "text-background-color": "#090d16",
            "text-background-opacity": showEdgeLabels ? 0.9 : 0,
            "text-background-padding": "2px",
            label: showEdgeLabels ? "data(label)" : "",
            "transition-property": "opacity, line-color, width",
            "transition-duration": "0.2s",
          },
        },
        // CORRELATED_WITH Edge (Pink dashed)
        {
          selector: 'edge[label="CORRELATED_WITH"]',
          style: {
            width: 3,
            "line-color": "#ec4899", // pink-500
            "line-style": "dashed",
            "target-arrow-shape": "none",
            color: "#f472b6",
            "font-size": "10px",
            "font-weight": "bold",
            "text-background-opacity": 0.9,
            label: (ele) => {
              const score = ele.data("score");
              return score !== undefined
                ? `CORRELATED ${score}%`
                : "CORRELATED";
            },
          },
        },
        // COORDINATED_WITH Edge (Cyan dashed)
        {
          selector: 'edge[label="COORDINATED_WITH"]',
          style: {
            width: 2.5,
            "line-color": "#06b6d4", // cyan-500
            "line-style": "dashed",
            "target-arrow-shape": "none",
            color: "#22d3ee",
            "font-size": "10px",
            "font-weight": "bold",
            "text-background-opacity": 0.9,
            label: (ele) => {
              const score = ele.data("score");
              return score !== undefined
                ? `COORDINATED ${score}%`
                : "COORDINATED";
            },
          },
        },
        // CO_HOSTED_SERVER Edge (Rose dotted)
        {
          selector: 'edge[label="CO_HOSTED_SERVER"]',
          style: {
            width: 2.5,
            "line-color": "#f43f5e", // rose-500
            "line-style": "dotted",
            "target-arrow-shape": "none",
            color: "#fb7185",
            "font-size": "10px",
            "text-background-opacity": 0.9,
            label: "CO-HOSTED",
          },
        },
        // HOSTED_ON Edge
        {
          selector: 'edge[label="HOSTED_ON"]',
          style: {
            width: 2,
            "line-color": "#8b5cf6",
            "target-arrow-color": "#8b5cf6",
          },
        },
        // SERVES_CERTIFICATE Edge
        {
          selector: 'edge[label="SERVES_CERTIFICATE"]',
          style: {
            width: 2,
            "line-color": "#f59e0b",
            "target-arrow-color": "#f59e0b",
          },
        },
        // Selected element styling
        {
          selector: ":selected",
          style: {
            "border-width": 3.5,
            "border-color": "#38bdf8",
            "line-color": "#38bdf8",
            "target-arrow-color": "#38bdf8",
            "z-index": 999,
          },
        },
        // Focus & Neighborhood Spotlight
        {
          selector: ".highlighted",
          style: {
            opacity: 1,
            "z-index": 100,
          },
        },
        {
          selector: "node.highlighted",
          style: {
            "border-width": 3,
            "border-color": "#38bdf8",
            "text-background-opacity": 1,
          },
        },
        {
          selector: "edge.highlighted",
          style: {
            width: 3.5,
            "text-background-opacity": 0.95,
          },
        },
        {
          selector: ".faded",
          style: {
            opacity: 0.12,
            "text-opacity": 0,
          },
        },
      ],
      layout: getLayoutConfig(layoutName),
    });

    // Tap on node: spotlight neighborhood and notify parent
    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      const nodeData = node.data();
      setActiveFocusNode(nodeData);

      // Neighborhood spotlight
      const neighborhood = node.neighborhood().add(node);
      cy.elements().removeClass("highlighted").addClass("faded");
      neighborhood.removeClass("faded").addClass("highlighted");

      if (onNodeSelect) onNodeSelect(nodeData);
    });

    // Tap on edge: spotlight connected endpoints and notify parent
    cy.on("tap", "edge", (evt) => {
      const edge = evt.target;
      const edgeData = edge.data();

      const connected = edge.connectedNodes().add(edge);
      cy.elements().removeClass("highlighted").addClass("faded");
      connected.removeClass("faded").addClass("highlighted");

      if (onEdgeSelect) onEdgeSelect(edgeData);
    });

    // Tap on empty canvas: clear spotlight
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass("faded highlighted");
        setActiveFocusNode(null);
        if (onNodeSelect) onNodeSelect(null);
        if (onEdgeSelect) onEdgeSelect(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [filteredElements, layoutName, showEdgeLabels]);

  function getLayoutConfig(name) {
    if (name === "concentric") {
      return {
        name: "concentric",
        concentric: (node) => node.degree(),
        levelWidth: () => 2,
        padding: 40,
        spacingFactor: 1.5,
        animate: false,
      };
    }
    if (name === "breadthfirst") {
      return {
        name: "breadthfirst",
        directed: false,
        padding: 40,
        spacingFactor: 1.5,
        animate: false,
      };
    }
    if (name === "circle") {
      return {
        name: "circle",
        padding: 40,
        spacingFactor: 1.3,
        animate: false,
      };
    }
    // Default tuned COSE force-directed
    return {
      name: "cose",
      padding: 50,
      randomize: false,
      animate: false,
      componentSpacing: 120,
      nodeRepulsion: 600000,
      idealEdgeLength: 100,
      edgeElasticity: 80,
      nestingFactor: 5,
      gravity: 60,
      numIter: 1000,
    };
  }

  // Handle Search & Quick Locate
  const handleSearch = (e) => {
    e.preventDefault();
    if (!cyRef.current || !searchQuery.trim()) return;

    const query = searchQuery.toLowerCase().trim();
    const match = cyRef.current.nodes().filter((node) => {
      const data = node.data();
      const label = (data.label || "").toLowerCase();
      const id = (data.id || "").toLowerCase();
      const handle = (data.canonical_handle || "").toLowerCase();
      const onion = (data.onion_url || "").toLowerCase();
      const ip = (data.ip || "").toLowerCase();
      return (
        label.includes(query) ||
        id.includes(query) ||
        handle.includes(query) ||
        onion.includes(query) ||
        ip.includes(query)
      );
    });

    if (match.length > 0) {
      const targetNode = match[0];
      const nodeData = targetNode.data();
      setActiveFocusNode(nodeData);

      // Spotlight neighborhood
      const neighborhood = targetNode.neighborhood().add(targetNode);
      cyRef.current.elements().removeClass("highlighted").addClass("faded");
      neighborhood.removeClass("faded").addClass("highlighted");

      cyRef.current.animate({
        center: { eles: targetNode },
        zoom: 1.5,
        duration: 400,
      });

      if (onNodeSelect) onNodeSelect(nodeData);
    }
  };

  const handleResetLayout = () => {
    if (!cyRef.current) return;
    cyRef.current.elements().removeClass("faded highlighted");
    setActiveFocusNode(null);
    const layout = cyRef.current.layout(getLayoutConfig(layoutName));
    layout.run();
  };

  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(null, 40);
  };

  const handleZoomIn = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.3);
  };

  const handleZoomOut = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 0.75);
  };

  const totalRawNodes = elements?.nodes?.length || 0;
  const totalRawEdges = elements?.edges?.length || 0;
  const visibleNodesCount = filteredElements.nodes.length;
  const visibleEdgesCount = filteredElements.edges.length;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* TOP CONTROL TOOLBAR */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-10 text-xs backdrop-blur">
        {/* Left: View Presets */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewPreset("CORE")}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              viewPreset === "CORE"
                ? "bg-cyan-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Core investigation: Personas, active correlations, coordination, and infrastructure. Hides raw posts."
          >
            <Target className="w-3.5 h-3.5" />
            <span>Core Investigation</span>
          </button>

          <button
            onClick={() => setViewPreset("ATTRIBUTION")}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              viewPreset === "ATTRIBUTION"
                ? "bg-pink-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Capability 2: Actor Attribution hypotheses & PGP key continuity"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Attribution</span>
          </button>

          <button
            onClick={() => setViewPreset("COORDINATION")}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              viewPreset === "COORDINATION"
                ? "bg-cyan-500 text-slate-950 font-semibold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Capability 3: Coordinated darknet posting bursts & cliques"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Coordination</span>
          </button>

          <button
            onClick={() => setViewPreset("INFRASTRUCTURE")}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              viewPreset === "INFRASTRUCTURE"
                ? "bg-rose-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Capability 1: Controlled synthetic physical servers, JARM TLS, and Tor services"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Infrastructure</span>
          </button>

          <button
            onClick={() => setViewPreset("FULL")}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              viewPreset === "FULL"
                ? "bg-slate-700 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Full unfiltered raw graph topology"
          >
            Full Raw
          </button>
        </div>

        {/* Center: Search & Locate */}
        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Search persona / IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs pl-7 pr-6 py-1 rounded border border-slate-700 w-44 focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  cyRef.current?.elements().removeClass("faded highlighted");
                  setActiveFocusNode(null);
                }}
                className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 text-xs font-medium"
          >
            Locate
          </button>
        </form>

        {/* Right: Layout Switcher & Controls */}
        <div className="flex items-center gap-2">
          {/* Layout dropdown */}
          <div className="flex items-center gap-1 text-slate-400">
            <span className="text-[11px]">Layout:</span>
            <select
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="bg-slate-950 text-slate-300 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              <option value="cose">Force-Directed (Spaced)</option>
              <option value="concentric">Concentric (Degree)</option>
              <option value="breadthfirst">Hierarchical Tree</option>
              <option value="circle">Circular</option>
            </select>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetLayout}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
              title="Reset Layout & Clear Selection"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Legend Toggle Button */}
          <button
            onClick={() => setShowLegend((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors ${
              showLegend
                ? "bg-slate-800 text-cyan-400 border-cyan-700"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Guide & Legend</span>
          </button>
        </div>
      </div>

      {/* SECONDARY FILTER & STATUS PILL BAR */}
      <div className="bg-slate-950/90 border-b border-slate-900 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-400 z-10">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
            Toggles:
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
            <input
              type="checkbox"
              checked={showPosts}
              onChange={(e) => setShowPosts(e.target.checked)}
              className="accent-cyan-500 rounded cursor-pointer"
            />
            <span>
              Raw Posts (
              {elements?.nodes?.filter((n) => n.data.type === "Post").length ||
                0}
              )
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
            <input
              type="checkbox"
              checked={showPartOfEdges}
              onChange={(e) => setShowPartOfEdges(e.target.checked)}
              className="accent-cyan-500 rounded cursor-pointer"
            />
            <span>Structural (PART_OF) Edges</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
            <input
              type="checkbox"
              checked={showEdgeLabels}
              onChange={(e) => setShowEdgeLabels(e.target.checked)}
              className="accent-cyan-500 rounded cursor-pointer"
            />
            <span>All Edge Labels</span>
          </label>
        </div>

        {/* Current Visibility Counter */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="text-cyan-400">
            {visibleNodesCount} nodes / {visibleEdgesCount} edges displayed
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-500">
            {totalRawNodes - visibleNodesCount} clutter nodes hidden
          </span>
        </div>
      </div>

      {/* ACTIVE FOCUS NOTIFICATION PILL */}
      {activeFocusNode && (
        <div className="absolute top-20 left-4 z-20 bg-slate-900/90 border border-cyan-500/50 px-3 py-1.5 rounded-lg shadow-xl backdrop-blur flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">
              Spotlight: {activeFocusNode.label || activeFocusNode.id}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {activeFocusNode.type || "Persona"}
            </span>
          </div>
          <button
            onClick={() => {
              cyRef.current?.elements().removeClass("faded highlighted");
              setActiveFocusNode(null);
            }}
            className="text-slate-400 hover:text-slate-100"
            title="Clear Spotlight"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MAIN GRAPH CANVAS CONTAINER */}
      <div ref={containerRef} className="flex-1 w-full h-full relative" />

      {/* FLOATING COLLAPSIBLE GUIDE & LEGEND PANEL */}
      {showLegend && (
        <div className="absolute bottom-4 right-4 z-30 w-96 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl p-4 text-xs space-y-3 backdrop-blur max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>What is happening in this graph?</span>
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-slate-400 text-[11px] leading-relaxed">
            <strong>Pragya Chakshu</strong> maps multi-signal forensic
            investigations across darknet forums and markets without invasive
            crawling. Solid lines indicate verified observations (authorship,
            PGP keys), while dashed lines depict algorithmic intelligence:
          </p>

          {/* Node Guide */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
              Node Entities
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                <span className="w-3.5 h-3.5 rounded-full bg-cyan-500 shrink-0" />
                <span className="text-slate-300">Forum Persona</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 rounded border border-purple-900/40">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500 border border-purple-300 shrink-0" />
                <span className="text-slate-300">Market Vendor</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                <span className="w-3 h-3 rotate-45 bg-amber-500 shrink-0" />
                <span className="text-slate-300">Identifier (PGP/BTC)</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 rounded border border-rose-900/40">
                <span className="w-3 h-3 rotate-45 bg-rose-600 shrink-0" />
                <span className="text-slate-300">Physical Server</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                <span className="w-3.5 h-3.5 bg-amber-600 rounded-xs shrink-0" />
                <span className="text-slate-300">TLS Cert (JARM)</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 rounded border border-purple-900/40">
                <span className="w-3.5 h-3.5 bg-purple-600 rounded shrink-0" />
                <span className="text-slate-300">Hidden Service</span>
              </div>
            </div>
          </div>

          {/* Relationship Guide */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
              Investigative Relationships
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2.5 bg-slate-950/70 p-1.5 rounded border border-slate-800">
                <div className="w-7 border-t-2 border-dashed border-pink-500 shrink-0" />
                <div>
                  <div className="font-semibold text-pink-400">
                    CORRELATED_WITH (Cap 2)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Cross-market persona match via NLP stylometry & PGP key.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-slate-950/70 p-1.5 rounded border border-slate-800">
                <div className="w-7 border-t-2 border-dashed border-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold text-cyan-400">
                    COORDINATED_WITH (Cap 3)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Temporal reply cadence, co-posting bursts, and cliques.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-slate-950/70 p-1.5 rounded border border-slate-800">
                <div className="w-7 border-t-2 border-dotted border-rose-500 shrink-0" />
                <div>
                  <div className="font-semibold text-rose-400">
                    CO_HOSTED_SERVER (Cap 1)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Different onion sites sharing identical TLS/SSH host key.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
            <span>Tip: Click any node to spotlight its direct network.</span>
            <button
              onClick={() => setShowLegend(false)}
              className="text-cyan-400 hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
