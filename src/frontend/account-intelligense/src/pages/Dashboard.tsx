import React, { useMemo, useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell"; // ✅ AJUSTA ESTA RUTA a tu proyecto
import { fetchWithAuth } from "../services/api";

type AccountItem = {
  analysis_id: number;
  company_id: number;
  company_name: string;
  industry: string;
  score: number;
};

type SummaryData = {
  prioritized_companies: number;
  total_analyses: number;
  opportunities_detected: number;
  analyses_this_week: number;
};

function levelStyles(level: AccountItem["reason"]["level"]) {
  if (level === "critico") return { bar: "bg-error", dot: "bg-error", text: "text-error" };
  if (level === "alto") return { bar: "bg-warning", dot: "bg-warning", text: "text-warning" };
  if (level === "medio") return { bar: "bg-success", dot: "bg-success", text: "text-success" };
  return { bar: "bg-text-disabled", dot: "bg-text-disabled", text: "text-text-secondary" };
}

export default function DashboardNewLayout() {
  const today = useMemo(() => {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());
  }, []);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [topAccounts, setTopAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [sumRes, topRes] = await Promise.all([
          fetchWithAuth("/dashboard/summary"),
          fetchWithAuth("/dashboard/top-accounts")
        ]);

        if (sumRes.ok) setSummary(await sumRes.json());
        if (topRes.ok) setTopAccounts(await topRes.json());
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1680px]">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">Buenos días.</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Aquí tienes tu hoja de ruta estratégica para hoy, {today}.
            </p>
          </div>

          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark active:translate-y-px">
            <SparkleIcon />
            Nuevo análisis
          </button>
        </div>

        {/* KPI */}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            value={String(summary?.prioritized_companies ?? 0)}
            label="CUENTAS PRIORIZADAS"
            icon={<DocIcon className="text-brand" />}
          />
          <KpiCard
            value={String(summary?.opportunities_detected ?? 0)}
            label="OPORTUNIDADES DETECTADAS"
            icon={<BoltIcon className="text-info" />}
          />
          <KpiCard
            value={String(summary?.analyses_this_week ?? 0)}
            label="ANÁLISIS ESTA SEMANA"
            icon={<CalendarIcon className="text-info" />}
          />
        </div>

        {/* Section */}
        <div className="mt-10 flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold">Cuentas para contactar hoy</h2>
          <a href="#" className="no-underline text-sm font-semibold text-brand hover:underline">
            VER TODAS LAS CUENTAS →
          </a>
        </div>

        {/* Rows */}
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="p-10 text-center text-text-muted">Cargando cuentas prioritarias...</div>
          ) : topAccounts.length === 0 ? (
            <div className="p-10 text-center text-text-muted rounded-2xl border border-dashed border-border">
              No hay cuentas analizadas aún. Comienza creando un nuevo análisis.
            </div>
          ) : (
            topAccounts.map((a) => {
              const level =
                a.score >= 80
                  ? "critico"
                  : a.score >= 60
                  ? "alto"
                  : a.score >= 40
                  ? "medio"
                  : "bajo";

              const s = levelStyles(level);

              return (
                <div key={a.analysis_id} className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${s.bar}`} />

                  <div className="grid gap-4 p-4 lg:grid-cols-[480px_1fr_220px] xl:grid-cols-[560px_1fr_240px] lg:items-center lg:gap-6 lg:p-5">
                    {/* Left */}
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-card grid place-items-center border border-border">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-brand">
                          <path
                            d="M10 3h4a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v4h-2V11H4v10h8v2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold">{a.company_name}</div>
                        <div className="text-xs text-text-muted">
                          ID: #{a.company_id}
                        </div>
                      </div>

                      <div className="ml-auto hidden items-center gap-6 text-xs text-text-muted lg:flex">
                        <span className="inline-flex items-center gap-1.5">
                          <BuildingIcon />
                          {a.industry}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <PinIcon />
                          N/A
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold tracking-wide text-text-muted">MOTIVO DE PRIORIZACIÓN</div>
                      <div className="mt-1 flex items-start gap-2 text-sm font-semibold">
                        <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${s.dot}`} />
                        <span className={`break-words ${s.text}`}>
                          Score calculado automáticamente
                        </span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex items-center justify-between gap-4 lg:justify-end">
                      <div className="text-right">
                        <div className="text-[11px] font-semibold tracking-wide text-text-muted">SCORE</div>
                        <div className="text-3xl font-semibold text-brand">{a.score}</div>
                      </div>

                      <button className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark active:translate-y-px">
                        Ver detalles
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------- UI components ---------------- */

function KpiCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl border border-border bg-brand-accent grid place-items-center">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-4xl font-semibold leading-none">{value}</div>
          <div className="mt-1 text-xs font-semibold tracking-wide text-text-muted">{label}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Icons (los dejé como estaban para NO romper nada) ---------------- */

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l1.1 3.4a1 1 0 0 0 .95.69H18l-2.75 2a1 1 0 0 0-.36 1.12L15.8 12l-2.9-2.1a1 1 0 0 0-1.18 0L8.8 12l.91-2.79a1 1 0 0 0-.36-1.12L6.6 6.09H10a1 1 0 0 0 .95-.69L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DocIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 2h7l5 5v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L14 3.5Z" fill="currentColor" />
    </svg>
  );
}

function BoltIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v15a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h3V2Z" fill="currentColor" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-text-muted">
      <path d="M3 21V3h12v18H3Z" fill="currentColor" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-text-muted">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z" fill="currentColor" />
    </svg>
  );
}