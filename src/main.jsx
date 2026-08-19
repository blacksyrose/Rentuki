import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "./lib/supabase";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import { ToastProvider } from "./components/Toast";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tenants from "./pages/Tenants";
import Units from "./pages/Units";
import Payments from "./pages/Payments";
import Maintenance from "./pages/Maintenance";
import Summary from "./pages/Summary";
import Receipts from "./pages/Receipts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import SubmeterCalculator from "./pages/SubmeterCalculator";
import "./styles.css";

function App() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  if (loading) return <div className="boot">Loading Rentuki…</div>;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="*"
        element={
          <ProtectedRoute session={session}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="units" element={<Units />} />
        <Route path="payments" element={<Payments />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="summary" element={<Summary />} />
        <Route path="receipts" element={<Receipts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="submeter-calculator" element={<SubmeterCalculator />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>,
);
