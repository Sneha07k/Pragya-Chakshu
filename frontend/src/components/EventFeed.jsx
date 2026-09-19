import {
  MessageSquare,
  User,
  ShoppingBag,
  Tag,
  AlertCircle,
} from "lucide-react";

export default function EventFeed({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 text-xs">
        No events ingested yet.
        <br />
        Select a dataset and click Ingest.
      </div>
    );
  }

  const getIcon = (type) => {
    switch (type) {
      case "post_observed":
        return <MessageSquare className="w-3.5 h-3.5 text-slate-400" />;
      case "vendor_observed":
        return <User className="w-3.5 h-3.5 text-cyan-400" />;
      case "listing_observed":
        return <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Tag className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getProvenanceBadge = (prov) => {
    switch (prov?.toUpperCase()) {
      case "RESEARCH":
        return "bg-blue-900/30 text-blue-400 border-blue-800/50";
      case "DERIVED":
        return "bg-purple-900/30 text-purple-400 border-purple-800/50";
      case "SYNTHETIC":
        return "bg-amber-900/30 text-amber-400 border-amber-800/50";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const getEventSummary = (ev) => {
    const p = ev.payload_json || {};
    if (ev.event_type === "post_observed") {
      return (
        <div>
          <span className="font-semibold text-cyan-400">
            {p.username || "User"}
          </span>{" "}
          posted:
          <p className="text-slate-300 text-xs mt-0.5 line-clamp-2">
            {p.clean_text || "Post content"}
          </p>
        </div>
      );
    }
    if (ev.event_type === "vendor_observed") {
      return (
        <div>
          <span className="font-semibold text-violet-400">
            {p.username || "Vendor"}
          </span>{" "}
          (Rank: {p.rank || "N/A"})
          <p className="text-slate-400 text-[11px] mt-0.5">
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
          <span className="font-medium text-emerald-400">
            {p.title || "Product Listing"}
          </span>
          <p className="text-slate-400 text-[11px] mt-0.5">
            Price: {p.price ? `${p.price} BTC` : "N/A"} | Class:{" "}
            {p.product_class || "N/A"}
          </p>
        </div>
      );
    }
    return <span className="text-slate-300">{ev.event_type}</span>;
  };

  return (
    <div className="divide-y divide-slate-800/60">
      {events.map((ev, idx) => (
        <div key={idx} className="p-3 hover:bg-slate-800/40 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="bg-slate-950 p-1 rounded border border-slate-800">
                {getIcon(ev.event_type)}
              </div>
              <span className="text-[11px] font-mono text-slate-400 uppercase">
                {ev.event_type?.replace("_observed", "")}
              </span>
            </div>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${getProvenanceBadge(ev.provenance)}`}
            >
              {ev.provenance || "RAW"}
            </span>
          </div>

          <div className="text-xs text-slate-200 mb-1">
            {getEventSummary(ev)}
          </div>

          <div className="text-[10px] text-slate-500 font-mono">
            {ev.timestamp_occurred
              ? ev.timestamp_occurred.replace("T", " ").replace("Z", " UTC")
              : "No timestamp"}
          </div>
        </div>
      ))}
    </div>
  );
}
