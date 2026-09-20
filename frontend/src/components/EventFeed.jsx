import {
  MessageSquare,
  User,
  ShoppingBag,
  Tag,
  AlertCircle,
} from "lucide-react";

export default function EventFeed({ events, theme = "dark" }) {
  const isDark = theme === "dark";

  if (!events || events.length === 0) {
    return (
      <div
        className={`p-8 text-center text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
      >
        No events ingested yet.
        <br />
        Select a dataset and click Ingest.
      </div>
    );
  }

  const getIcon = (type) => {
    switch (type) {
      case "post_observed":
        return (
          <MessageSquare
            className={`w-3.5 h-3.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          />
        );
      case "vendor_observed":
        return <User className="w-3.5 h-3.5 text-cyan-500" />;
      case "listing_observed":
        return <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Tag className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  const getProvenanceBadge = (prov) => {
    switch (prov?.toUpperCase()) {
      case "RESEARCH":
        return isDark
          ? "bg-blue-900/30 text-blue-400 border-blue-800/50"
          : "bg-blue-50 text-blue-700 border-blue-200";
      case "DERIVED":
        return isDark
          ? "bg-purple-900/30 text-purple-400 border-purple-800/50"
          : "bg-purple-50 text-purple-700 border-purple-200";
      case "SYNTHETIC":
        return isDark
          ? "bg-amber-900/30 text-amber-400 border-amber-800/50"
          : "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return isDark
          ? "bg-slate-800 text-slate-400 border-slate-700"
          : "bg-slate-100 text-slate-600 border-slate-300";
    }
  };

  const getEventSummary = (ev) => {
    const p = ev.payload_json || {};
    if (ev.event_type === "post_observed") {
      return (
        <div>
          <span
            className={`font-semibold ${isDark ? "text-cyan-400" : "text-cyan-600"}`}
          >
            {p.username || "User"}
          </span>{" "}
          posted:
          <p
            className={`text-xs mt-0.5 line-clamp-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}
          >
            {p.clean_text || "Post content"}
          </p>
        </div>
      );
    }
    if (ev.event_type === "vendor_observed") {
      return (
        <div>
          <span
            className={`font-semibold ${isDark ? "text-violet-400" : "text-violet-600"}`}
          >
            {p.username || "Vendor"}
          </span>{" "}
          <span className="opacity-75">(Rank: {p.rank || "N/A"})</span>
          <p
            className={`text-[11px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            Sales: {p.sales || 0} | Rating: {p.approval_rating || "100%"}
            {p.identifiers?.length > 0 &&
              ` | Identifiers: ${p.identifiers.length}`}
          </p>
        </div>
      );
    }
    if (ev.event_type === "listing_observed") {
      return (
        <div>
          <span
            className={`font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
          >
            {p.title || "Product Listing"}
          </span>
          <p
            className={`text-[11px] mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            Price: {p.price ? `${p.price} BTC` : "N/A"} | Class:{" "}
            {p.product_class || "N/A"}
          </p>
        </div>
      );
    }
    return (
      <span className={isDark ? "text-slate-300" : "text-slate-700"}>
        {ev.event_type}
      </span>
    );
  };

  return (
    <div
      className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-slate-200"}`}
    >
      {events.map((ev, idx) => (
        <div
          key={idx}
          className={`p-3 transition-colors ${
            isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-100"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div
                className={`p-1 rounded border ${
                  isDark
                    ? "bg-slate-950 border-slate-800"
                    : "bg-white border-slate-200 shadow-2xs"
                }`}
              >
                {getIcon(ev.event_type)}
              </div>
              <span
                className={`text-[11px] font-mono uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}
              >
                {ev.event_type?.replace("_observed", "")}
              </span>
            </div>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${getProvenanceBadge(
                ev.provenance,
              )}`}
            >
              {ev.provenance || "RAW"}
            </span>
          </div>

          <div className="text-xs mb-1">{getEventSummary(ev)}</div>

          <div
            className={`text-[10px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            {ev.timestamp_occurred
              ? ev.timestamp_occurred.replace("T", " ").replace("Z", " UTC")
              : "No timestamp"}
          </div>
        </div>
      ))}
    </div>
  );
}
