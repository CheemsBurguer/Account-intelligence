import React, { useMemo, useState } from "react";
import {
    BarChart3,
    ChevronDown,
    ChevronUp,
    Zap,
    Info,
    DollarSign,
    TrendingUp,
    ArrowUp,
} from "lucide-react";

export type InsightCardDTO = {
    id: string;
    category?: string;
    title?: string;
    quote?: string;
    opportunityTitle?: string;
    opportunityBody?: string;
    propensityValue?: number; // puede venir undefined
    impactTag?: { label?: string; tone?: "critica" | "alta" | "media" | "baja" };
    detectedAt?: string;
    factors?: Array<{ label: string; level: "ALTA" | "MEDIA" | "BAJA" }>;
};

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(" ");

const tonePill: Record<string, string> = {
    critica: "bg-red-50 text-red-700 ring-1 ring-red-200",
    alta: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    media: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    baja: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
};

export function InsightCardTile({
    data,
    loading,
    onSave,
    onWorkWithAI,
}: {
    data?: InsightCardDTO | null;
    loading?: boolean;
    onSave?: () => void;
    onWorkWithAI?: () => void;
}) {
    const [openFactors, setOpenFactors] = useState(true);
    type Factor = { label: string; level: "ALTA" | "MEDIA" | "BAJA" };

    // ✅ safe fallbacks (evita undefined% y textos raros)
    const safe = useMemo(() => {
        // 👇 Esto evita que TS lo trate como {}
        const d: Partial<InsightCardDTO> = data ?? {};

        const propensity =
            typeof d.propensityValue === "number" && Number.isFinite(d.propensityValue)
                ? `${Math.round(d.propensityValue)}%`
                : "—%";

        const tone = d.impactTag?.tone ?? "baja";
        const impactLabel = d.impactTag?.label ?? "—";

        const factors: Factor[] =
            d.factors ??
            [
                { label: "—", level: "ALTA" },
                { label: "—", level: "ALTA" },
                { label: "—", level: "MEDIA" },
            ];

        return {
            id: d.id ?? "empty",
            category: d.category ?? "—",
            title: d.title ?? "Título (vacío)",
            quote: d.quote ?? "“—”",
            opportunityTitle: d.opportunityTitle ?? "OPORTUNIDAD HPE",
            opportunityBody: d.opportunityBody ?? "Descripción (vacía)",
            detectedAt: d.detectedAt ?? "Detectada: —",
            impactLabel,
            tone,
            propensity,
            factors,
        };
    }, [data]);

    const hasData = !!data && !loading;

    return (
        <div className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* BODY */}
            <div className="p-5">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-2.5">
                        <BarChart3 className="h-6 w-6 text-indigo-600" />
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className={cx("rounded-full px-3 py-1 text-xs font-bold tracking-wide", tonePill[safe.tone])}>
                            {safe.impactLabel}
                        </span>

                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Info className="h-3.5 w-3.5" />
                            <span>{safe.detectedAt}</span>
                        </div>
                    </div>
                </div>

                {/* Category */}
                <div className="mt-4 text-sm font-extrabold uppercase tracking-wide text-indigo-600">
                    {safe.category}
                </div>

                {/* Title */}
                <div className="mt-2 text-xl font-extrabold leading-snug text-slate-900">
                    {safe.title}
                </div>

                {/* Quote */}
                <div className="mt-4 border-l-2 border-slate-200 pl-4 text-sm italic leading-relaxed text-slate-600">
                    {safe.quote}
                </div>

                {/* Opportunity */}
                <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                    <div className="flex gap-3">
                        <div className="w-1 rounded-full bg-emerald-600" />
                        <div className="min-w-0">
                            <div className="text-sm font-extrabold tracking-wide text-emerald-700">
                                {safe.opportunityTitle}
                            </div>
                            <div className="mt-1 text-sm leading-relaxed text-slate-700">
                                {safe.opportunityBody}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Propensity + Factors */}
                <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                            <div className="rounded-xl bg-emerald-100 p-2">
                                <Zap className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div className="text-sm font-extrabold tracking-wide text-emerald-700">
                                PROPENSIÓN DE COMPRA
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-2xl font-extrabold text-emerald-700">{safe.propensity}</div>

                            {/* ✅ botón ya NO es negro (evita look dark) */}
                            <button
                                type="button"
                                onClick={() => setOpenFactors((v) => !v)}
                                className="rounded-xl border border-emerald-200 bg-white p-2 text-emerald-700 hover:bg-emerald-100"
                                aria-label="Toggle factors"
                            >
                                {openFactors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {openFactors && (
                        <div className="border-t border-emerald-100 px-4 py-4">
                            <div className="text-xs font-bold tracking-wide text-slate-500">
                                FACTORES QUE INFLUYEN
                            </div>

                            <div className="mt-3 space-y-3">
                                {safe.factors.map((f, idx) => (
                                    <div key={`${f.label}-${idx}`} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {idx === 0 ? (
                                                <DollarSign className="h-4 w-4 text-slate-600" />
                                            ) : idx === 1 ? (
                                                <TrendingUp className="h-4 w-4 text-slate-600" />
                                            ) : (
                                                <ArrowUp className="h-4 w-4 text-slate-600" />
                                            )}
                                            <div className="truncate text-sm text-slate-700">{f.label}</div>
                                        </div>

                                        <span  className={cx(
                                            "border-t border-emerald-100 overflow-hidden transition-[max-height,opacity] duration-200",
                                            openFactors ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
                                        )}>
                                            <div className="px-4 py-4">
                                                {/* contenido factores */}
                                            </div>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* FOOTER ✅ ya NO negro */}
            <div className="grid grid-cols-2 border-t border-slate-200 bg-white">
                <button
                    type="button"
                    className="h-14 font-extrabold tracking-wide text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    disabled={!hasData}
                    onClick={onSave}
                >
                    GUARDAR
                </button>

                <button
                    type="button"
                    className="h-14 font-extrabold tracking-wide text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={!hasData}
                    onClick={onWorkWithAI}
                >
                    <Zap className="h-4 w-4" />
                    TRABAJAR CON AI
                </button>
            </div>
        </div>
    );
}
