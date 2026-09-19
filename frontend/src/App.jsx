import { useState } from 'react'
import Landing from './components/Landing'
import Workspace from './components/Workspace'

function App() {
  const [currentCase, setCurrentCase] = useState(null)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {!currentCase ? (
        <Landing onSelectCase={setCurrentCase} />
      ) : (
        <Workspace caseData={currentCase} onBack={() => setCurrentCase(null)} />
      )}
    </div>
  )
}

export default App
