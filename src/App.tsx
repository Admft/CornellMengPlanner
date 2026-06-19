import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Planner from './Planner'
import StatsPage from './pages/StatsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Planner />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
