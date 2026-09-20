import { useState, useEffect } from "react";
import { PlusCircle, Shield, ChevronRight, Sun, Moon } from "lucide-react";
import { listCases, createCase } from "../api";

export default function Landing({ onSelectCase, theme = "dark", onToggleTheme }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const isDark = theme === "dark";

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const data = await listCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name) return;
    try {
      const newCase = await createCase(name, description);
      setCases([newCase, ...cases]);
      setName("");
      setDescription("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={`min-h-screen transition-colors p-8 ${isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      {/* Top Header Controls */}
      <div className="max-w-6xl mx-auto flex justify-end mb-4">
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg border transition-colors flex items-center gap-2 text-xs font-medium cursor-pointer ${
              isDark
                ? "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
                : "bg-white border-slate-200 text-slate-700 hover:text-slate-950 shadow-2xs"
            }`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
          </button>
        )}
      </div>

      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
          <div
            className={`inline-flex items-center justify-center p-3.5 rounded-full mb-4 border ${
              isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <Shield className="w-9 h-9 text-cyan-500" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">
            PRAGYA CHAKSHU
          </h1>
          <p className={isDark ? "text-slate-400 font-medium tracking-wide text-lg" : "text-slate-600 font-medium tracking-wide text-lg"}>
            Cybersecurity Research & Attribution System
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Create New Case */}
          <div className="space-y-6">
            <h2 className={`text-xl font-semibold border-b pb-2 ${isDark ? "text-slate-200 border-slate-800" : "text-slate-800 border-slate-200"}`}>
              Create New Case
            </h2>
            <form
              onSubmit={handleCreate}
              className={`p-6 rounded-xl border transition-colors ${
                isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="space-y-4">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Case Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full rounded-md py-2 px-3 text-sm focus:outline-none focus:border-cyan-500 border transition-colors ${
                      isDark
                        ? "bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500"
                        : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                    placeholder="e.g. Operation Cardinal"
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`w-full rounded-md py-2 px-3 text-sm focus:outline-none focus:border-cyan-500 border h-24 transition-colors ${
                      isDark
                        ? "bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500"
                        : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    }`}
                    placeholder="Case scope and investigation hypothesis..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 px-4 rounded-md font-medium transition-colors cursor-pointer shadow-md"
                >
                  <PlusCircle className="w-4 h-4" /> Initialize Investigation Workspace
                </button>
              </div>
            </form>
          </div>

          {/* Active Investigations */}
          <div className="space-y-6">
            <h2 className={`text-xl font-semibold border-b pb-2 ${isDark ? "text-slate-200 border-slate-800" : "text-slate-800 border-slate-200"}`}>
              Active Investigations
            </h2>

            {loading ? (
              <div className="text-slate-500 text-sm py-4">Loading cases...</div>
            ) : cases.length === 0 ? (
              <div
                className={`p-6 rounded-lg border text-center text-sm ${
                  isDark ? "bg-slate-900/40 border-slate-800 text-slate-500" : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                No active cases found. Create a new case above to begin.
              </div>
            ) : (
              <div className="space-y-3">
                {cases.map((c) => (
                  <div
                    key={c.case_id}
                    onClick={() => onSelectCase(c)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isDark
                        ? "bg-slate-900 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700"
                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-cyan-400 shadow-2xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-base transition-colors ${
                          isDark ? "text-slate-200 group-hover:text-cyan-400" : "text-slate-900 group-hover:text-cyan-600"
                        }`}>
                          {c.name}
                        </h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium uppercase border ${
                            c.status === "ACTIVE"
                              ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/50"
                              : "bg-cyan-900/30 text-cyan-400 border-cyan-800/50"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 line-clamp-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                        {c.description || "No description provided."}
                      </p>
                      <div className={`text-[10px] font-mono mt-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        Created: {c.created_at ? new Date(c.created_at).toLocaleDateString() : "N/A"}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-cyan-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
