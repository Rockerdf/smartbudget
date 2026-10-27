import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { UsersProvider } from './contexts/UsersContext'
import { AppSettingsProvider } from './lib/appSettings'
import { isSupabaseConfigured } from './lib/supabase'
import './index.css'

function SetupNotice() {
  return (
    <div style={{ maxWidth: 560, margin: "15vh auto", padding: 24, fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>SmartBudget is not configured yet</h1>
      <p>
        Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to a <code>.env</code> file
        (see <code>.env.example</code>) or to your hosting provider’s environment settings, then rebuild.
      </p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSupabaseConfigured ? (
      <AppSettingsProvider>
        <UsersProvider>
          <App />
        </UsersProvider>
      </AppSettingsProvider>
    ) : (
      <SetupNotice />
    )}
  </React.StrictMode>,
)
