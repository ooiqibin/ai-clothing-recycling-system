import { useState } from 'react'
import { getSavedUser, getToken, clearSession } from './api'
import Login from './Login'
import Overview from './Overview'
import Analytics from './Analytics'
import Activity from './Activity'
import Users from './Users'
import Rewards from './Rewards'
import Tips from './Tips'
import Centres from './Centres'
import NgoApplications from './NgoApplications'
import NgoAccounts from './ngoAccounts'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'activity', label: 'Activity' },
  { id: 'users', label: 'Users' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'tips', label: 'Sustainability Tips' },
  { id: 'centres', label: 'Donation Centres' },
  { id: 'applications', label: 'NGO Applications' },
  { id: 'ngo', label: 'NGO Accounts' },
]

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getSavedUser() : null))
  const [tab, setTab] = useState('overview')

  function handleLogout() {
    clearSession()
    setUser(null)
  }

  if (!user || user.role !== 'admin') {
    return <Login onLogin={setUser} />
  }

  return (
    <div>
      <nav className="bg-green-700 text-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                  tab === t.id ? 'bg-green-800' : 'hover:bg-green-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        <button
          onClick={handleLogout}
          className="ml-3 flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5m0 0-5-5m5 5H3"
            />
          </svg>
          Logout
        </button>
        </div>
      </nav>

      {tab === 'overview' && <Overview onLogout={handleLogout} />}
      {tab === 'analytics' && <Analytics onLogout={handleLogout} />}
      {tab === 'activity' && <Activity onLogout={handleLogout} />}
      {tab === 'users' && <Users onLogout={handleLogout} />}
      {tab === 'rewards' && <Rewards onLogout={handleLogout} />}
      {tab === 'tips' && <Tips onLogout={handleLogout} />}
      {tab === 'centres' && <Centres user={user} onLogout={handleLogout} />}
      {tab === 'applications' && <NgoApplications onLogout={handleLogout} />}
      {tab === 'ngo' && <NgoAccounts onLogout={handleLogout} />}
    </div>
  )
}