import { AppProvider } from './contexts/AppContext'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <AppProvider>
      <AdminPage />
    </AppProvider>
  )
}
