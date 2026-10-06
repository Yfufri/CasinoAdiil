import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { reconnectSocket } from '../socket'

interface User {
  id: number
  username: string
  role: 'admin' | 'participant'
  credits: number
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  updateCredits: (credits: number) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  function login(token: string, user: User) {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setToken(token)
    setUser(user)
    reconnectSocket()
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  function updateCredits(credits: number) {
    setUser(u => u ? { ...u, credits } : null)
    const saved = localStorage.getItem('user')
    if (saved) {
      const parsed = JSON.parse(saved)
      localStorage.setItem('user', JSON.stringify({ ...parsed, credits }))
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateCredits }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
