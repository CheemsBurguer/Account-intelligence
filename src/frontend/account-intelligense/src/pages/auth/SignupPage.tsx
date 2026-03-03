import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../services/api";

const REGIONS = [
  "North America",
  "Latin America",
  "EMEA",
  "APJ",
  "Global",
];

const REGION_MAP: Record<string, number> = {
  "North America": 1,
  "Latin America": 2,
  "EMEA": 3,
  "APJ": 4,
  "Global": 5,
};

export default function SignUpPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !region || !email || !password || !confirmPassword) {
      setError("Por favor, llena todos los campos.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          region_id: REGION_MAP[region] || 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Handle FastAPI validation errors (422) or custom errors
        const detail = data.detail;
        let errorMessage = "Error al registrar la cuenta";

        if (typeof detail === "string") {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Validation errors from FastAPI are often an array
          errorMessage = detail.map((err: any) => `${err.loc.join('.')}: ${err.msg}`).join(", ");
        } else if (typeof detail === "object" && detail !== null) {
          errorMessage = JSON.stringify(detail);
        }

        throw new Error(errorMessage);
      }

      // Redirigir al inicio de sesión con estado
      navigate("/login", { state: { successMessage: "Se creó la cuenta exitosamente, inicia sesión." } });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* LEFT / HERO (same as Login) */}
        <section className="relative hidden lg:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(src/assets/brand/HPE_imgBuilding.png)" }}
          />
          <div className="absolute inset-0 bg-slate-900/60" />

          <div className="relative flex h-full flex-col justify-end p-12">
            <div className="max-w-xl text-white">
              <div className="text-5xl font-semibold leading-none tracking-tight">
                <img src="src/assets/brand/HPE_logoWhite.png" alt="HPE_logo" />
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">
                Account Intelligence
              </div>

              <div className="mt-8 text-lg font-medium opacity-95">
                AI-Powered Strategic Account Platform
              </div>

              <div className="mt-14 flex items-center gap-4 text-white/90">
                <div className="h-px w-40 bg-white/50" />
                <span className="text-base font-semibold">www.hpe.com</span>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT / FORM */}
        <section className="relative flex items-center justify-center px-6 py-10 lg:px-16">
          {/* Language pill */}
          <div className="absolute right-6 top-6">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <span aria-hidden>🌐</span>
              English (US)
            </button>
          </div>

          <div className="w-full max-w-xl">
            <h1 className="text-4xl font-semibold tracking-tight">Sign Up</h1>
            <p className="mt-2 text-base text-slate-600">
              You&apos;ll be able to start analyzing as soon as you sign up.
            </p>

            <div className="mt-6 h-px w-full bg-slate-200" />

            <form className="mt-8 space-y-6" onSubmit={handleSignup}>
              {error && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Create New Account
                </div>
              </div>

              {/* Name row */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    autoComplete="given-name"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    autoComplete="family-name"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              {/* Region */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Región
                </label>

                <div className="relative mt-2">
                  <select
                    className="w-full appearance-none rounded-md border border-slate-200 bg-white px-4 py-3 pr-10 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="" disabled>
                      Seleccionar región...
                    </option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  {/* chevron */}
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-700 text-[10px] leading-none">
                    i
                  </span>
                  Password requirements:
                </button>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Re-enter your new password to confirm
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex w-72 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create account"}
              </button>

              <div className="rounded-md bg-slate-100 px-6 py-4">
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                      to="/"
                      className="text-hpe-green font-semibold hover:opacity-80 transition"
                    >
                      Sign In
                    </Link>
                  </p>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}