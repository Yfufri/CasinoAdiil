import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useEffect } from 'react'
import { getSocket } from './socket'

import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ExchangeTable from './pages/ExchangeTable'
import RouletteTable from './pages/RouletteTable'
import RouletteDisplay from './pages/RouletteDisplay'
import AdminExchange from './pages/admin/Exchange'
import AdminRoulette from './pages/admin/Roulette'
import AdminUsers from './pages/admin/Users'

function RequireAuth({ children, admin = false }: { children: JSX.Element; admin?: boolean }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function AppInner() {
  const { user, updateCredits } = useAuth()

  useEffect(() => {
    if (!user) return
    const socket = getSocket()
    socket.on('credits:update', ({ credits }: { credits: number }) => {
      updateCredits(credits)
    })
    return () => { socket.off('credits:update') }
  }, [user])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-casino-dark">
        <Routes>
          {/* Écrans plein écran — pas de navbar */}
          <Route path="/roulette/display" element={<RouletteDisplay />} />
          <Route path="/roulette" element={<RequireAuth><RouletteTable /></RequireAuth>} />

          {/* Pages normales avec navbar */}
          <Route path="/*" element={
            <>
              <Navbar />
              <main className="max-w-7xl mx-auto px-4 py-6">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                  <Route path="/exchange" element={<RequireAuth><ExchangeTable /></RequireAuth>} />
                  <Route path="/admin/exchange" element={<RequireAuth admin><AdminExchange /></RequireAuth>} />
                  <Route path="/admin/roulette" element={<RequireAuth admin><AdminRoulette /></RequireAuth>} />
                  <Route path="/admin/users" element={<RequireAuth admin><AdminUsers /></RequireAuth>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
