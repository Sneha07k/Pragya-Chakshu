import { useState, useEffect } from "react";
import Landing from "./components/Landing";
import Workspace from "./components/Workspace";

function App() {
  const [currentCase, setCurrentCase] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("pc_theme") || "dark";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("pc_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-200 ${
        theme === "dark"
          ? "bg-slate-950 text-slate-100"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      {!currentCase ? (
        <Landing
          onSelectCase={setCurrentCase}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <Workspace
          caseData={currentCase}
          onBack={() => setCurrentCase(null)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}

export default App;
