import { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell"; // <-- ajusta
import { Search, ChevronDown, X } from "lucide-react";
import { InsightCardTile } from "../../components/ui/InsightCard";
import type { InsightCardDTO } from "../../types/insights"; // ajusta ruta
import { fetchWithAuth } from "../../services/api";

function Select({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
}) {
    return (
        <div className="min-w-[160px]">
            <div className="text-[11px] font-semibold tracking-wide text-text-muted">
                {label.toUpperCase()}
            </div>

            {/* UI-only: cicla opciones para mantener simple (luego lo cambias por dropdown real) */}
            <button
                type="button"
                className="mt-1 w-full rounded-2xl border border-border bg-app px-3 py-2 text-left text-sm text-text-primary hover:bg-hover"
                onClick={() => {
                    const idx = options.indexOf(value);
                    const next = options[(idx + 1) % options.length];
                    onChange(next);
                }}
            >
                <span className="flex items-center justify-between">
                    <span className="truncate">{value}</span>
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                </span>
            </button>
        </div>
    );
}

export default function StrategicInsightsPage() {
    // filtros (UI)
    const [impacto, setImpacto] = useState("Todos");
    const [area, setArea] = useState("Todas");
    const [propension, setPropension] = useState("Todas");
    const [ordenarPor, setOrdenarPor] = useState("Prioridad estratégica");
    const [smartQuery, setSmartQuery] = useState("");

    // data
    const [cards, setCards] = useState<Array<InsightCardDTO | null>>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchCards = async () => {
            setLoading(true);
            try {
                const res = await fetchWithAuth("/insights/");
                if (res.ok) {
                    const json = await res.json();
                    setCards(json);
                } else {
                    console.error("Failed to fetch insights");
                    setCards([]);
                }
            } catch (err) {
                console.error("Error loading insights:", err);
                setCards([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCards();
    }, []);

    return (
        <AppShell>
            {/* HEADER */}
            <div className="mt-2">
                <h1 className="text-2xl font-bold text-text-primary">Strategic Insights</h1>
                <p className="mt-1 text-sm text-text-secondary">
                    Explora señales estratégicas y oportunidades detectadas en tus cuentas prioritarias.
                </p>
            </div>

            {/* FILTROS (como en tu diseño) */}
            <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Select
                        label="Impacto"
                        value={impacto}
                        onChange={setImpacto}
                        options={["Todos", "Crítica", "Alta", "Media", "Baja"]}
                    />

                    <Select
                        label="Área estratégica"
                        value={area}
                        onChange={setArea}
                        options={["Todas", "Finanzas", "Infraestructura", "Seguridad", "Data & AI"]}
                    />

                    <Select
                        label="Propensión de compra"
                        value={propension}
                        onChange={setPropension}
                        options={["Todas", "Alta", "Media", "Baja"]}
                    />

                    <Select
                        label="Ordenar por"
                        value={ordenarPor}
                        onChange={setOrdenarPor}
                        options={["Prioridad estratégica", "Más recientes", "Mayor propensión"]}
                    />
                </div>

                {/* BUSCADOR INTELIGENTE */}
                <div className="mt-4">
                    <div className="text-[11px] font-semibold tracking-wide text-text-muted">
                        BUSCADOR INTELIGENTE
                    </div>

                    <div className="relative mt-1">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                        <input
                            value={smartQuery}
                            onChange={(e) => setSmartQuery(e.target.value)}
                            placeholder="Buscar insight o noticia relevante..."
                            className="h-11 w-full rounded-2xl border border-border bg-app pl-11 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                        {smartQuery.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setSmartQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-text-muted hover:bg-hover"
                                aria-label="Limpiar"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* GRID DE CARDS (como tu diseño, NO full screen) */}
            <div className="mt-6">
                <div className="grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {cards.map((c, idx) => (
                        <InsightCardTile key={c?.id ?? `empty-${idx}`} data={c} loading={loading} />
                    ))}
                </div>
            </div>
        </AppShell>
    );
}