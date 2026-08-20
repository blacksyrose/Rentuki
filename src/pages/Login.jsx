import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff } from "lucide-react";
import { signIn } from "../lib/auth";
import { useToast } from "../components/Toast";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(form.email, form.password);
      navigate("/");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand large">
          <div className="brand-mark" aria-hidden="true">
            <Building2 size={22} strokeWidth={2.2} />
          </div>
          <div>
            <strong>Rental Management System</strong>
            <small>by Erika Ferolino</small>
          </div>
        </div>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage your properties and tenants.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <span className="password-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                minLength="6"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          <button className="primary full" disabled={busy}>
            {busy ? "Please wait…" : "Sign in"}
          </button>
        </form>
        <p className="invite-notice">
          <span aria-hidden="true">✉</span>
          Access is invite-only. Ask an administrator to create your account.
        </p>
      </div>
    </div>
  );
}
