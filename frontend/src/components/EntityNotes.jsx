import { useState, useEffect } from "react";
import { MessageSquare, Plus, Trash2, Shield, Clock, Send } from "lucide-react";
import { getCaseNotes, addCaseNote, deleteCaseNote } from "../api";

export default function EntityNotes({
  caseId,
  entityType = "PERSONA",
  entityId,
  entityLabel = "",
  theme = "dark",
}) {
  const isDark = theme === "dark";
  const [notes, setNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    if (!caseId || !entityId) return;
    setLoading(true);
    try {
      const res = await getCaseNotes(caseId, entityId);
      setNotes(res?.notes || []);
    } catch (e) {
      console.error("Failed to load entity notes", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [caseId, entityId]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || submitting) return;

    setSubmitting(true);
    try {
      await addCaseNote(caseId, {
        entity_type: entityType,
        entity_id: String(entityId),
        entity_label: entityLabel || `${entityType}: ${entityId}`,
        note_text: newNoteText.trim(),
        investigator_id: "investigator_1",
      });
      setNewNoteText("");
      await fetchNotes();
    } catch (err) {
      console.error("Failed to add note", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteCaseNote(caseId, noteId);
      await fetchNotes();
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  return (
    <div
      className={`border rounded-xl p-3.5 space-y-3 ${
        isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-xs">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-500" />
          <span>Investigator Notes ({notes.length})</span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold border ${
            isDark
              ? "bg-purple-950/40 text-purple-300 border-purple-800/60"
              : "bg-purple-50 text-purple-700 border-purple-200"
          }`}
        >
          HUMAN AUDIT
        </span>
      </div>

      {/* Note Input Box */}
      <form onSubmit={handleAddNote} className="space-y-2">
        <textarea
          rows={2}
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          placeholder={`Attach forensic observation regarding ${entityLabel || "this entity"}...`}
          className={`w-full text-xs p-2.5 rounded-lg border resize-none focus:outline-none focus:border-cyan-500 transition-colors ${
            isDark
              ? "bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-500"
              : "bg-white border-slate-300 text-slate-800 placeholder-slate-400"
          }`}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newNoteText.trim()}
            className="text-xs px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Send className="w-3 h-3" />
            <span>{submitting ? "Saving..." : "Save Note"}</span>
          </button>
        </div>
      </form>

      {/* Notes List */}
      {loading && notes.length === 0 ? (
        <div className="text-[11px] opacity-60 text-center py-2">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="text-[11px] opacity-60 italic text-center py-1">
          No investigator notes attached yet.
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
          {notes.map((n) => (
            <div
              key={n.note_id}
              className={`p-2.5 rounded-lg border space-y-1.5 text-xs group transition-colors ${
                isDark
                  ? "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] opacity-75">
                <span className="font-semibold text-cyan-500">{n.investigator_id}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">
                    {n.created_at ? n.created_at.slice(0, 16).replace("T", " ") : ""}
                  </span>
                  <button
                    onClick={() => handleDeleteNote(n.note_id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity cursor-pointer p-0.5"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="leading-relaxed opacity-90 text-[11px] break-words">
                {n.note_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
