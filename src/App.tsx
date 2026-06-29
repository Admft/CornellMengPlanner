import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Planner from './Planner'
import ChangelogPage from './pages/ChangelogPage'
import StatsPage from './pages/StatsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Planner />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
      </Routes>
    </BrowserRouter>
  )
}
