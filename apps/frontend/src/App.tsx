import { PanelistApp } from './features/PanelistApp'
import { ResearcherApp } from './features/ResearcherApp'
import './App.css'

/**
 * Top-level router. The backoffice (researcher console) and the user
 * (responder) app are two fully separated products that never share chrome.
 *
 * - `/researcher*` → ResearcherApp (PC backoffice console)
 * - everything else → PanelistApp (mobile-first responder app, standalone)
 */
function App() {
  const isResearcher = window.location.pathname.startsWith('/researcher')
  return isResearcher ? <ResearcherApp /> : <PanelistApp />
}

export default App
