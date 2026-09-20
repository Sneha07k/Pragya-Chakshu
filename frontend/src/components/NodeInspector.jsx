import { useState, useEffect } from 'react'
import { getPersonaStylometry, getPersonaBehavioral } from '../api'
import { FileText, Clock, BarChart3, ShieldAlert } from 'lucide-react'
import EntityNotes from './EntityNotes'

export default function NodeInspector({ node, caseId }) {
  const [stylometry, setStylometry] = useState(null)
  const [behavioral, setBehavioral] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [activeTab, setActiveTab] = useState('properties')

  useEffect(() => {
    setStylometry(null)
    setBehavioral(null)
    setActiveTab('properties')

    if (node?.type === 'Persona' && caseId) {
      setLoadingAnalytics(true)
      Promise.all([
        getPersonaStylometry(caseId, node.id).catch(() => null),
        getPersonaBehavioral(caseId, node.id).catch(() => null)
      ]).then(([sty, beh]) => {
        if (sty?.stylometric_profile) setStylometry(sty.stylometric_profile)
        if (beh?.behavioral_profile) setBehavioral(beh.behavioral_profile)
      }).finally(() => {
        setLoadingAnalytics(false)
      })
    }
  }, [node?.id, caseId])

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 p-4">
        <div className="w-12 h-12 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center">
          <span className="text-xl opacity-40">?</span>
        </div>
        <p className="text-xs text-center text-slate-400">Select any graph node to inspect forensic attributes and analytical profiles.</p>
      </div>
    )
  }

  const getProvenanceBadge = (prov) => {
    switch (prov?.toUpperCase()) {
      case 'RESEARCH': return 'bg-blue-900/30 text-blue-400 border-blue-800/50'
      case 'DERIVED': return 'bg-purple-900/30 text-purple-400 border-purple-800/50'
      case 'SYNTHETIC': return 'bg-amber-900/30 text-amber-400 border-amber-800/50'
      default: return 'bg-slate-800 text-slate-400 border-slate-700'
    }
  }

  const displayEntries = Object.entries(node).filter(([key]) => !['id', 'label'].includes(key))

  return (
    <div className="space-y-4">
      {/* Node Header */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-base font-semibold text-slate-100 truncate" title={node.label || node.id}>
            {node.label || node.id}
          </h3>
          {node.provenance && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${getProvenanceBadge(node.provenance)}`}>
              {node.provenance}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[11px] rounded border border-slate-700">
            Type: {node.type || 'Unknown'}
          </span>
          {node.platform && (
            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[11px] rounded border border-slate-700">
              {node.platform}
            </span>
          )}
        </div>
      </div>

      {/* Tabs for Persona nodes */}
      {node.type === 'Persona' && (
        <div className="flex border-b border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('properties')}
            className={`pb-1.5 px-2.5 transition-colors border-b-2 ${
              activeTab === 'properties' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Attributes
          </button>
          <button
            onClick={() => setActiveTab('stylometry')}
            className={`pb-1.5 px-2.5 transition-colors border-b-2 flex items-center gap-1 ${
              activeTab === 'stylometry' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3 h-3" /> Stylometry
          </button>
          <button
            onClick={() => setActiveTab('behavioral')}
            className={`pb-1.5 px-2.5 transition-colors border-b-2 flex items-center gap-1 ${
              activeTab === 'behavioral' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3 h-3" /> Diurnal
          </button>
        </div>
      )}

      {/* Tab 1: Standard Properties */}
      {activeTab === 'properties' && (
        <div className="space-y-2">
          {displayEntries.map(([key, value]) => {
            if (key === 'provenance' || key === 'type') return null
            return (
              <div key={key} className="bg-slate-900/90 p-2.5 rounded border border-slate-800 text-xs">
                <div className="text-[10px] text-slate-500 mb-0.5 font-medium uppercase">{key}</div>
                <div className="text-slate-200 break-words whitespace-pre-wrap font-mono text-[11px]">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab 2: Forensic Stylometry */}
      {activeTab === 'stylometry' && (
        <div className="space-y-3 text-xs">
          {loadingAnalytics ? (
            <div className="text-slate-500 text-center py-4">Extracting stylometric features...</div>
          ) : stylometry ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Forensic Metrics</span>
                <span className="text-[9px] bg-purple-900/30 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded">
                  PROVENANCE: DERIVED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Yule's Characteristic K</div>
                  <div className="text-sm font-bold text-purple-400 font-mono mt-0.5">{stylometry.yules_k}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Vocabulary richness</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Type-Token Ratio</div>
                  <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">{stylometry.type_token_ratio}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Lexical diversity</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Mean Sentence Length</div>
                  <div className="text-sm font-bold text-slate-200 font-mono mt-0.5">{stylometry.avg_sentence_len} words</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Var: {stylometry.sentence_len_var}</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Language Verification</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5 uppercase">{stylometry.language}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{stylometry.total_words} words analyzed</div>
                </div>
              </div>

              {/* Punctuation Profile */}
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                  Punctuation Signature (per 1,000 words)
                </div>
                <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
                  {Object.entries(stylometry.punctuation_vector || {}).map(([p, v]) => (
                    <div key={p} className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
                      <span className="text-slate-500 font-bold">{p}</span>
                      <div className="text-slate-200">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-center py-4">No text samples available for this persona.</div>
          )}
        </div>
      )}

      {/* Tab 3: Behavioral Diurnal Profile */}
      {activeTab === 'behavioral' && (
        <div className="space-y-3 text-xs">
          {loadingAnalytics ? (
            <div className="text-slate-500 text-center py-4">Calculating diurnal curves...</div>
          ) : behavioral ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">24-Hour Diurnal Cycle (UTC)</span>
                <span className="text-[9px] bg-purple-900/30 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded">
                  PROVENANCE: DERIVED
                </span>
              </div>

              {/* Mini Bar Chart for 24h Distribution */}
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-2">
                <div className="h-16 flex items-end gap-1 pt-2">
                  {behavioral.diurnal_24h?.map((count, hr) => {
                    const maxCount = Math.max(...(behavioral.diurnal_24h || [1]), 1)
                    const heightPct = Math.round((count / maxCount) * 100)
                    return (
                      <div
                        key={hr}
                        className="flex-1 bg-cyan-600 hover:bg-cyan-400 rounded-t transition-all relative group"
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                        title={`${hr}:00 UTC — ${count} events`}
                      >
                        <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-950 text-slate-200 text-[9px] px-1 py-0.5 rounded border border-slate-700 whitespace-nowrap z-20">
                          {hr}:00: {count}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </div>

              {/* Cadence Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Mean Posting Interval</div>
                  <div className="text-sm font-bold text-slate-200 font-mono mt-0.5">{behavioral.mean_interval_hours} hrs</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Activity Bursts (&le;1h)</div>
                  <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">{behavioral.burst_count}</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800 col-span-2">
                  <div className="text-[10px] text-slate-500">Active Observation Span</div>
                  <div className="text-xs text-slate-200 font-mono mt-0.5">{behavioral.active_span_days} days ({behavioral.total_events} events)</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-center py-4">No timestamped events recorded for this persona.</div>
          )}
        </div>
      )}

      {/* Investigator Field Notes & Chain of Custody */}
      <EntityNotes
        caseId={caseId}
        entityType={node.type ? node.type.toUpperCase() : "PERSONA"}
        entityId={node.id}
        entityLabel={node.label || node.canonical_handle || node.id}
      />
    </div>
  )
}
