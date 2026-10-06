import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) =>
    location.pathname === path ? 'text-casino-gold border-b border-casino-gold' : 'text-gray-400 hover:text-white'

  return (
    <nav className="border-b border-casino-border bg-casino-surface sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="font-casino text-xl text-casino-gold tracking-wide">
          🎰 Casino Adiil
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link to="/" className={`${isActive('/')} transition-colors pb-0.5`}>Accueil</Link>

          {user && (
            <>
              <Link to="/dashboard" className={`${isActive('/dashboard')} transition-colors pb-0.5`}>Mon compte</Link>
              <Link to="/exchange" className={`${isActive('/exchange')} transition-colors pb-0.5`}>Échanges</Link>
              <Link to="/roulette" className={`${isActive('/roulette')} transition-colors pb-0.5`}>Roulette</Link>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <div className="w-px h-4 bg-casino-border" />
              <Link to="/admin/exchange" className={`${isActive('/admin/exchange')} transition-colors pb-0.5`}>Admin Échanges</Link>
              <Link to="/admin/roulette" className={`${isActive('/admin/roulette')} transition-colors pb-0.5`}>Admin Roulette</Link>
              <Link to="/admin/users" className={`${isActive('/admin/users')} transition-colors pb-0.5`}>Joueurs</Link>
            </>
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              {user.role === 'participant' && (
                <span className="bg-casino-dark border border-casino-gold px-3 py-1 rounded-full text-casino-gold font-semibold">
                  {user.credits.toLocaleString()} jetons
                </span>
              )}
              <span className="text-gray-400">{user.username}</span>
              {user.role === 'admin' && (
                <span className="text-xs bg-casino-gold text-black px-2 py-0.5 rounded-full font-semibold">ADMIN</span>
              )}
              <button onClick={handleLogout} className="btn-ghost text-xs px-3 py-1">
                Déconnexion
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary text-sm px-4 py-1.5">
              Connexion
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
