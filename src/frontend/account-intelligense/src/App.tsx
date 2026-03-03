import { Routes, Route, Navigate } from "react-router-dom";
import DashboardNewLayout from "./pages/Dashboard.tsx";
import LoginPage from "./pages/auth/LoginPage.tsx";
import SignupPage from "./pages/auth/SignupPage.tsx";
import AccountProfile from "./pages/accounts/AccountProfile.tsx";
import StrategicInsightsPage from "./pages/accounts/StrategicInsights.tsx";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/daily"
        element={
          <PrivateRoute>
            <DashboardNewLayout />
          </PrivateRoute>
        }
      />
      <Route
        path="/account-360"
        element={
          <PrivateRoute>
            <AccountProfile />
          </PrivateRoute>
        }
      />
      <Route
        path="/insights"
        element={
          <PrivateRoute>
            <StrategicInsightsPage />
          </PrivateRoute>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
    </Routes>
  );
}