const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const TOKEN_KEY = 'admin_token'
const USER_KEY = 'admin_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// Sends a request to the backend and adds the login token automatically.
export async function api(path, options = {}) {
  const token = getToken()

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Request failed (${response.status})`
    )
    error.status = response.status
    throw error
  }

  return data
}