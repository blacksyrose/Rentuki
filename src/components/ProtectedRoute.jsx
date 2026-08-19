import { Navigate } from "react-router-dom";
export default function ProtectedRoute({ session, children }) {
  return session ? children : <Navigate to="/login" replace />;
}
