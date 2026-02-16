import { Navigate, Route, Routes } from 'react-router-dom';
import { isLoggedIn } from './lib/auth';
import { Navbar } from './components/Navbar';
import HomePage from './pages/HomePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import NoteDetailsPage from './pages/NoteDetailsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

function ProtectedRoute({ children }) {
  if (!isLoggedIn()) return <Navigate to="/auth?mode=login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
          <Route path="/register" element={<Navigate to="/auth?mode=signup" replace />} />
          <Route path="/note/:id" element={<NoteDetailsPage />} />
          <Route path="/notes/:id" element={<NoteDetailsPage />} />
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
            
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
