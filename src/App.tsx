import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminFacesPage from './pages/AdminFacesPage';
import PresencePage from './pages/PresencePage';
import FaceEnrollmentPage from './pages/FaceEnrollmentPage';
import FaceProfilePage from './pages/FaceProfilePage';
import { Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0078d4]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/presence"
        element={
          <ProtectedRoute>
            <PresencePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/faces"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminFacesPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/faces/profile"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <FaceProfilePage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/faces/new"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <FaceEnrollmentPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/admin/faces" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;