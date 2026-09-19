import { useState, useEffect } from "react";
import { PlusCircle, Shield, ChevronRight } from "lucide-react";
import { listCases, createCase } from "../api";

export default function Landing({ onSelectCase }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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
    <div className="max-w-6xl mx-auto p-8">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-slate-900 border border-slate-700 rounded-full mb-4">
          <Shield className="w-8 h-8 text-cyan-500" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-100 mb-2">
          PRAGYA CHAKSHU
        </h1>
        <p className="text-slate-400 font-medium tracking-wide text-lg">
          Cybersecurity Research & Attribution System
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">
            Create New Case
          </h2>
          <form
            onSubmit={handleCreate}
            className="bg-slate-900 p-6 rounded-lg border border-slate-800"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Case Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. Operation Phantom"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 h-24"
                  placeholder="Initial observations..."
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-2 px-4 rounded-md font-medium transition-colors"
              >
                <PlusCircle className="w-4 h-4" /> Initialize Workspace
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">
            Active Investigations
          </h2>
          {loading ? (
            <div className="text-slate-500 animate-pulse">Loading cases...</div>
          ) : cases.length === 0 ? (
            <div className="text-slate-500 bg-slate-900/50 p-6 rounded border border-slate-800/50 text-center">
              No active cases found.
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <div
                  key={c.case_id}
                  onClick={() => onSelectCase(c)}
                  className="group bg-slate-900 border border-slate-800 hover:border-cyan-500/50 p-4 rounded-lg cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                        {c.name}
                      </h3>
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                        {c.status || "ACTIVE"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1">
                      {c.description || "No description provided"}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
