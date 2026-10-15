import { useState } from 'react'
import { getSavedUser, getToken, clearSession } from './api'
import Login from './Login'
import Centres from './Centres'
import NgoAccounts from './NgoAccounts'

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getSavedUser() : null))
  const [tab, setTab] = useState('centres')

  function handleLogout() {
    clearSession()
    setUser(null)
  }

  if (!user || user.role !== 'admin') {
    return <Login onLogin={setUser} />
  }

  const tabClass = (name) =>
    `px-4 py-3 text-sm font-medium ${
      tab === name ? 'bg-green-800' : 'hover:bg-green-600'
    }`

  return (
    <div>
      <nav className="bg-green-700 text-white">
        <div className="max-w-5xl mx-auto flex">
          <button className={tabClass('centres')} onClick={() => setTab('centres')}>
            Donation Centres
          </button>
          <button className={tabClass('ngo')} onClick={() => setTab('ngo')}>
            NGO Accounts
          </button>
        </div>
      </nav>

      {tab === 'centres' ? (
        <Centres user={user} onLogout={handleLogout} />
      ) : (
        <NgoAccounts onLogout={handleLogout} />
      )}
    </div>
  )
}