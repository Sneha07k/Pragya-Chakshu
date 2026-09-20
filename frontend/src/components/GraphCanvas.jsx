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
  LocateFixed,
  Plus,
  Minus,
  Compass,
} from "lucide-react";

export default function GraphCanvas({
  elements,
  onNodeSelect,
  onEdgeSelect,
  theme = "dark",
}) {
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

  const isDark = theme === "dark";

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

    const labelTextColor = isDark ? "#f1f5f9" : "#0f172a";
    const labelBgColor = isDark ? "#090d16" : "#ffffff";
    const edgeBaseColor = isDark ? "#334155" : "#94a3b8";
    const edgeLabelTextColor = isDark ? "#94a3b8" : "#475569";
    const nodeBorderBase = isDark ? "#1e293b" : "#cbd5e1";

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
            color: labelTextColor,
            "font-size": "11px",
            "font-family": "Inter, system-ui, sans-serif",
            "font-weight": 500,
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-background-color": labelBgColor,
            "text-background-opacity": 0.88,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
            "border-width": 2,
            "border-color": nodeBorderBase,
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
            "background-color": isDark ? "#06b6d4" : "#0284c7",
            "border-color": isDark ? "#22d3ee" : "#38bdf8",
            width: 38,
            height: 38,
          },
        },
        // Market Vendor Persona (Violet border)
        {
          selector: 'node[platform="Evolution Market"]',
          style: {
            "background-color": isDark ? "#8b5cf6" : "#7c3aed",
            "border-color": isDark ? "#c084fc" : "#a855f7",
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
            "background-color": isDark ? "#475569" : "#94a3b8",
            "border-color": isDark ? "#64748b" : "#cbd5e1",
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
            "background-color": "#f59e0b",
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
            "background-color": "#10b981",
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
            "background-color": "#e11d48",
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
            "background-color": "#d97706",
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
            "background-color": "#9333ea",
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
            "background-color": isDark ? "#2563eb" : "#1d4ed8",
            width: 48,
            height: 48,
            "border-color": isDark ? "#60a5fa" : "#93c5fd",
            "border-width": 3,
          },
        },
        // Base Edge Style
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": edgeBaseColor,
            "target-arrow-color": edgeBaseColor,
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "bezier",
            "font-size": "9px",
            color: edgeLabelTextColor,
            "text-rotation": "autorotate",
            "text-background-color": labelBgColor,
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
            "line-color": "#ec4899",
            "line-style": "dashed",
            "target-arrow-shape": "none",
            color: isDark ? "#f472b6" : "#db2777",
            "font-size": "10px",
            "font-weight": "bold",
            "text-background-opacity": 0.9,
            label: (ele) => {
              const score = ele.data("score");
              return score !== undefined ? `CORRELATED ${score}%` : "CORRELATED";
            },
          },
        },
        // COORDINATED_WITH Edge (Cyan dashed)
        {
          selector: 'edge[label="COORDINATED_WITH"]',
          style: {
            width: 2.5,
            "line-color": isDark ? "#06b6d4" : "#0284c7",
            "line-style": "dashed",
            "target-arrow-shape": "none",
            color: isDark ? "#22d3ee" : "#0369a1",
            "font-size": "10px",
            "font-weight": "bold",
            "text-background-opacity": 0.9,
            label: (ele) => {
              const score = ele.data("score");
              return score !== undefined ? `COORDINATED ${score}%` : "COORDINATED";
            },
          },
        },
        // CO_HOSTED_SERVER Edge (Rose dotted)
        {
          selector: 'edge[label="CO_HOSTED_SERVER"]',
          style: {
            width: 2.5,
            "line-color": "#f43f5e",
            "line-style": "dotted",
            "target-arrow-shape": "none",
            color: isDark ? "#fb7185" : "#e11d48",
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
            "border-color": isDark ? "#38bdf8" : "#0284c7",
            "line-color": isDark ? "#38bdf8" : "#0284c7",
            "target-arrow-color": isDark ? "#38bdf8" : "#0284c7",
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
            "border-width": 3.5,
            "border-color": isDark ? "#38bdf8" : "#0284c7",
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
            opacity: 0.1,
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
  }, [filteredElements, layoutName, showEdgeLabels, isDark]);

  function getLayoutConfig(name) {
    if (name === "concentric") {
      return {
        name: "concentric",
        concentric: (node) => node.degree(),
        levelWidth: () => 2,
        padding: 50,
        spacingFactor: 1.5,
        animate: false,
      };
    }
    if (name === "breadthfirst") {
      return {
        name: "breadthfirst",
        directed: false,
        padding: 50,
        spacingFactor: 1.5,
        animate: false,
      };
    }
    if (name === "circle") {
      return {
        name: "circle",
        padding: 50,
        spacingFactor: 1.3,
        animate: false,
      };
    }
    // Default tuned COSE force-directed
    return {
      name: "cose",
      padding: 60,
      randomize: false,
      animate: false,
      componentSpacing: 130,
      nodeRepulsion: 700000,
      idealEdgeLength: 110,
      edgeElasticity: 80,
      nestingFactor: 5,
      gravity: 50,
      numIter: 1000,
    };
  }

  // Google Maps Style Recenter on Graph (Fit to View)
  const handleRecenter = () => {
    if (!cyRef.current) return;
    cyRef.current.elements().removeClass("faded highlighted");
    setActiveFocusNode(null);

    cyRef.current.animate({
      fit: {
        eles: cyRef.current.elements(),
        padding: 60,
      },
      duration: 450,
      easing: "ease-out-cubic",
    });
  };

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
        zoom: 1.6,
        duration: 450,
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

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.animate({
        zoom: cyRef.current.zoom() * 1.3,
        duration: 200,
      });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.animate({
        zoom: cyRef.current.zoom() * 0.75,
        duration: 200,
      });
    }
  };

  const totalRawNodes = elements?.nodes?.length || 0;
  const totalRawEdges = elements?.edges?.length || 0;
  const visibleNodesCount = filteredElements.nodes.length;
  const visibleEdgesCount = filteredElements.edges.length;

  return (
    <div
      className={`relative w-full h-full flex flex-col overflow-hidden select-none ${
        isDark ? "canvas-grid-dark text-slate-100" : "canvas-grid-light text-slate-900"
      }`}
    >
      {/* TOP CONTROL TOOLBAR */}
      <div
        className={`px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-10 text-xs backdrop-blur border-b transition-colors ${
          isDark
            ? "bg-slate-900/90 border-slate-800 text-slate-200"
            : "bg-white/90 border-slate-200 text-slate-700 shadow-xs"
        }`}
      >
        {/* Left: View Presets */}
        <div
          className={`flex items-center gap-1.5 p-1 rounded-lg border ${
            isDark ? "bg-slate-950/80 border-slate-800" : "bg-slate-100 border-slate-200"
          }`}
        >
          <button
            onClick={() => setViewPreset("CORE")}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              viewPreset === "CORE"
                ? "bg-cyan-600 text-white shadow"
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
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
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
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
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
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
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
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
                ? isDark
                  ? "bg-slate-700 text-slate-100"
                  : "bg-slate-800 text-white"
                : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Full unfiltered raw graph topology"
          >
            Full Raw
          </button>
        </div>

        {/* Center: Search & Locate */}
        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Search persona / IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`text-xs pl-7 pr-6 py-1 rounded border w-44 focus:outline-none focus:border-cyan-500 transition-colors ${
                isDark
                  ? "bg-slate-950 text-slate-200 border-slate-700 placeholder-slate-500"
                  : "bg-white text-slate-800 border-slate-300 placeholder-slate-400 shadow-2xs"
              }`}
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
            className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-2xs"
            }`}
          >
            Locate
          </button>
        </form>

        {/* Right: Layout Switcher & Legend */}
        <div className="flex items-center gap-2">
          {/* Layout dropdown */}
          <div className="flex items-center gap-1">
            <span className={isDark ? "text-slate-400 text-[11px]" : "text-slate-500 text-[11px]"}>
              Layout:
            </span>
            <select
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className={`text-xs rounded border px-2 py-1 focus:outline-none focus:border-cyan-500 transition-colors ${
                isDark
                  ? "bg-slate-950 text-slate-300 border-slate-700"
                  : "bg-white text-slate-800 border-slate-300 shadow-2xs"
              }`}
            >
              <option value="cose">Force-Directed (Spaced)</option>
              <option value="concentric">Concentric (Degree)</option>
              <option value="breadthfirst">Hierarchical Tree</option>
              <option value="circle">Circular</option>
            </select>
          </div>

          <button
            onClick={handleResetLayout}
            className={`p-1.5 rounded border transition-colors ${
              isDark
                ? "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                : "bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-2xs"
            }`}
            title="Reset Layout Algorithm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Legend Toggle Button */}
          <button
            onClick={() => setShowLegend((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
              showLegend
                ? isDark
                  ? "bg-slate-800 text-cyan-400 border-cyan-700"
                  : "bg-cyan-50 text-cyan-700 border-cyan-300"
                : isDark
                ? "bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800"
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-300 shadow-2xs"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Guide & Legend</span>
          </button>
        </div>
      </div>

      {/* SECONDARY FILTER & STATUS PILL BAR */}
      <div
        className={`px-4 py-1.5 flex items-center justify-between text-[11px] z-10 border-b transition-colors ${
          isDark
            ? "bg-slate-950/80 border-slate-900 text-slate-400"
            : "bg-slate-100/90 border-slate-200 text-slate-600"
        }`}
      >
        <div className="flex items-center gap-4">
          <span className="font-semibold uppercase tracking-wider text-[10px] opacity-70">
            Toggles:
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-100 transition-opacity">
            <input
              type="checkbox"
              checked={showPosts}
              onChange={(e) => setShowPosts(e.target.checked)}
              className="accent-cyan-500 rounded cursor-pointer"
            />
            <span>
              Raw Posts ({elements?.nodes?.filter((n) => n.data.type === "Post").length || 0})
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-100 transition-opacity">
            <input
              type="checkbox"
              checked={showPartOfEdges}
              onChange={(e) => setShowPartOfEdges(e.target.checked)}
              className="accent-cyan-500 rounded cursor-pointer"
            />
            <span>Structural (PART_OF) Edges</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-100 transition-opacity">
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
          <span className={isDark ? "text-cyan-400" : "text-cyan-700 font-semibold"}>
            {visibleNodesCount} nodes / {visibleEdgesCount} edges
          </span>
          <span className="opacity-40">|</span>
          <span className="opacity-70">
            {totalRawNodes - visibleNodesCount} clutter nodes hidden
          </span>
        </div>
      </div>

      {/* ACTIVE FOCUS NOTIFICATION PILL */}
      {activeFocusNode && (
        <div
          className={`absolute top-20 left-4 z-20 px-3.5 py-1.5 rounded-lg shadow-xl backdrop-blur flex items-center gap-3 border transition-colors ${
            isDark
              ? "bg-slate-900/90 border-cyan-500/50 text-slate-200"
              : "bg-white/95 border-blue-500/50 text-slate-800 shadow-md"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-semibold">
              Spotlight: {activeFocusNode.label || activeFocusNode.id}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
              }`}
            >
              {activeFocusNode.type || "Persona"}
            </span>
          </div>
          <button
            onClick={() => {
              cyRef.current?.elements().removeClass("faded highlighted");
              setActiveFocusNode(null);
            }}
            className="opacity-60 hover:opacity-100 cursor-pointer"
            title="Clear Spotlight"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MAIN GRAPH CANVAS CONTAINER */}
      <div ref={containerRef} className="flex-1 w-full h-full relative" />

      {/* GOOGLE MAPS STYLE FLOATING NAVIGATION FAB CLUSTER */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-center gap-2">
        {/* RECENTER ON GRAPH BUTTON (GPS TARGET FAB) */}
        <button
          onClick={handleRecenter}
          className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all transform active:scale-95 group relative cursor-pointer ${
            isDark
              ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/40"
          }`}
          title="Recenter on Graph (Fit to View)"
        >
          <LocateFixed className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
          {/* Tooltip */}
          <span
            className={`absolute right-14 whitespace-nowrap text-[11px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-medium ${
              isDark ? "bg-slate-900 text-white border border-slate-700" : "bg-slate-800 text-white"
            }`}
          >
            Recenter on Graph
          </span>
        </button>

        {/* ZOOM STACK (+ / -) */}
        <div
          className={`rounded-lg shadow-xl border overflow-hidden flex flex-col backdrop-blur ${
            isDark
              ? "bg-slate-900/90 border-slate-700 text-slate-300"
              : "bg-white/95 border-slate-200 text-slate-700"
          }`}
        >
          <button
            onClick={handleZoomIn}
            className={`p-2.5 transition-colors border-b cursor-pointer ${
              isDark
                ? "hover:bg-slate-800 hover:text-white border-slate-800"
                : "hover:bg-slate-100 hover:text-slate-900 border-slate-100"
            }`}
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className={`p-2.5 transition-colors cursor-pointer ${
              isDark
                ? "hover:bg-slate-800 hover:text-white"
                : "hover:bg-slate-100 hover:text-slate-900"
            }`}
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FLOATING COLLAPSIBLE GUIDE & LEGEND PANEL */}
      {showLegend && (
        <div
          className={`absolute bottom-6 left-6 z-30 w-96 rounded-xl shadow-2xl p-4 text-xs space-y-3 backdrop-blur max-h-[80vh] overflow-y-auto border transition-colors ${
            isDark
              ? "bg-slate-900/95 border-slate-700 text-slate-300"
              : "bg-white/95 border-slate-200 text-slate-700 shadow-xl"
          }`}
        >
          <div
            className={`flex items-center justify-between border-b pb-2 ${
              isDark ? "border-slate-800" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <Info className="w-4 h-4 text-cyan-500" />
              <span>Investigator Guide & Legend</span>
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="opacity-80 text-[11px] leading-relaxed">
            <strong>Pragya Chakshu</strong> visualizes darknet actors, pseudonyms, and
            infrastructure clusters. Solid lines denote observed research data; dashed lines
            indicate analytical intelligence.
          </p>

          {/* Node Guide */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold opacity-60 tracking-wider">
              Investigative Entities
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div
                className={`flex items-center gap-2 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-slate-800/80" : "bg-slate-50 border-slate-200"
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-cyan-500 shrink-0" />
                <span>Forum Persona</span>
              </div>
              <div
                className={`flex items-center gap-2 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-purple-900/40" : "bg-purple-50 border-purple-200"
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500 border border-purple-300 shrink-0" />
                <span>Market Vendor</span>
              </div>
              <div
                className={`flex items-center gap-2 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-slate-800/80" : "bg-amber-50 border-amber-200"
                }`}
              >
                <span className="w-3 h-3 rotate-45 bg-amber-500 shrink-0" />
                <span>Identifier (PGP/BTC)</span>
              </div>
              <div
                className={`flex items-center gap-2 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-rose-900/40" : "bg-rose-50 border-rose-200"
                }`}
              >
                <span className="w-3 h-3 rotate-45 bg-rose-600 shrink-0" />
                <span>Physical Server</span>
              </div>
              <div
                className={`flex items-center gap-2 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-slate-800/80" : "bg-amber-50 border-amber-200"
                }`}
              >
                <span className="w-3.5 h-3.5 bg-amber-600 rounded-xs shrink-0" />
                <span>TLS Cert (JARM)</span>
              </div>
              <div
                className={`flex items-center gap-2 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-purple-900/40" : "bg-purple-50 border-purple-200"
                }`}
              >
                <span className="w-3.5 h-3.5 bg-purple-600 rounded shrink-0" />
                <span>Hidden Service</span>
              </div>
            </div>
          </div>

          {/* Relationship Guide */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold opacity-60 tracking-wider">
              Attribution & Network Edges
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div
                className={`flex items-center gap-2.5 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="w-7 border-t-2 border-dashed border-pink-500 shrink-0" />
                <div>
                  <div className="font-semibold text-pink-500">CORRELATED_WITH (Cap 2)</div>
                  <div className="text-[10px] opacity-70">
                    Cross-market match via NLP stylometry & PGP key.
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center gap-2.5 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="w-7 border-t-2 border-dashed border-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold text-cyan-500">COORDINATED_WITH (Cap 3)</div>
                  <div className="text-[10px] opacity-70">
                    Temporal reply cadence, co-posting bursts, and cliques.
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center gap-2.5 p-1.5 rounded border ${
                  isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="w-7 border-t-2 border-dotted border-rose-500 shrink-0" />
                <div>
                  <div className="font-semibold text-rose-500">CO_HOSTED_SERVER (Cap 1)</div>
                  <div className="text-[10px] opacity-70">
                    Different onion sites sharing identical TLS/SSH host key.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`pt-2 border-t text-[10px] flex justify-between ${
              isDark ? "border-slate-800 opacity-60" : "border-slate-200 opacity-70"
            }`}
          >
            <span>Tip: Click any node to spotlight its direct network.</span>
            <button
              onClick={() => setShowLegend(false)}
              className="text-cyan-500 hover:underline cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
