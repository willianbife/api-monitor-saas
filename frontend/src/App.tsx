import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/useAuth";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Endpoints } from "./pages/Endpoints";
import { Settings } from "./pages/Settings";
import { StatusPage } from "./pages/StatusPage";
import { DashboardSkeleton } from "./components/dashboard/DashboardSkeleton";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell-loader">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
      <Route path="/status/:slug" element={<StatusPage />} />

      <Route path="/" element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="endpoints" element={<Endpoints />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
