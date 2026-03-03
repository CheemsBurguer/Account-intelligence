import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { useNavigate } from "react-router-dom";
import {
  PanelLeft,
  PanelRight,
  Plus,
  Zap,
  Trash2,
  ArrowUp,
  ExternalLink,
  Copy,
  Send,
  Check,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import { fetchWithAuth } from "../../services/api";

/* ===================== TYPES ===================== */

type InputSource = "main" | "additional" | null;
type AnalysisStatus = "running" | "completed" | "failed";
type ChatStage = "input" | "analysis_progress" | "recommendations" | "commercial_progress" | "commercial";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  tsISO: string;
}

interface RecommendationCardUI {
  id: number;          // recommendation id
  productId: number;
  title: string;
  need: string;        // reasoning from backend
  matchPercentage: number;
  confidenceScore: number;
  isAccepted: boolean;
}

interface CommercialFocusCard {
  id: string;
  title: string;
  subtitle: string;
}

interface CommercialPack {
  companyName: string;
  problem: string;
  solution: string;
  strategicMatchPct: number;
  howToStart: string;
  tone: string;
  emphasize: string;
  avoid: string;
  speechText: string;
  speechWordCount: number;
  versionLabel: string;
  strategicData: CommercialFocusCard[];
}

interface ChatItem {
  id: string;
  companyName: string;
  domain: string;
  whenISO: string;
  initial: string;
  color: string;
  analysisType: string;
  source: InputSource;
  url?: string;
  industryLabel?: string;
  industryId?: number;
  messages: Message[];

  // feature/ai-engine-merged additions
  analysisStatus?: AnalysisStatus;
  analysisProgress?: number;
  analysisProgressLabel?: string;
  stage?: ChatStage;
  insights?: string;
  recommendationCards?: RecommendationCardUI[];
  noInsights?: boolean; // true if analysis completed but found no data
  loadingRecommendations?: boolean;
  selectedRecommendationIds?: number[];
  commercialProgress?: number;
  commercialProgressLabel?: string;
  commercialPack?: CommercialPack;
}

/* ===================== HELPERS ===================== */

const uid = () => Math.random().toString(36).substring(2, 11);

const validateUrl = (val: string) => {
  if (!val) return { ok: false };
  let test = val.trim().toLowerCase();
  if (!test.includes(".")) return { ok: false, error: "Falta el dominio (ej. .com)." };
  if (!test.startsWith("http")) test = "https://" + test;
  try {
    const url = new URL(test);
    return { ok: true, normalized: url.toString() };
  } catch {
    return { ok: false, error: "Formato no válido." };
  }
};

const extractDomain = (url: string) => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};



const formatWhen = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Reciente";
  if (minutes < 60) return `Hace ${minutes}m`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)}h`;
  return d.toLocaleDateString();
};

const pickColorFromString = (str: string) => {
  const colors = [
    "bg-blue-600",
    "bg-emerald-600",
    "bg-indigo-600",
    "bg-violet-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-slate-700",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const countWords = (text: string) => (text ? text.trim().split(/\s+/).length : 0);

const INDUSTRY_ID_MAP = {
  Tecnología: 1,
  Finanzas: 2,
  Retail: 3,
  Manufactura: 4,
  Logística: 5,
  Salud: 6,
  Educación: 7,
  Gobierno: 8,
  "E-commerce": 9,
};

function getIndustryId(label: string): number {
  return (INDUSTRY_ID_MAP as any)[label] ?? 1;
}



/* ===================== MAIN COMPONENT ===================== */

export default function AccountProfile() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [popupOpen, setPopupOpen] = useState(false);
  const [analysisType, setAnalysisType] = useState("Análisis Completo");

  const [extraCompanyName, setExtraCompanyName] = useState("");
  const [extraIndustry, setExtraIndustry] = useState("");
  const [inputSource, setInputSource] = useState<InputSource>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("hpe_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem("hpe_sidebar_collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  // Persistence for chats (fallback)
  useEffect(() => {
    const saved = localStorage.getItem("hpe_chats_v3");
    if (saved) {
      try { setChats(JSON.parse(saved)); } catch { }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("hpe_chats_v3", JSON.stringify(chats));
  }, [chats]);

  // Load from Backend (Real merge)
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetchWithAuth("/analysis/");
        if (res.ok) {
          const data = await res.json();
          const DONE_STATUSES = ["analysis_completed", "completed"];
          const mapped: ChatItem[] = data.map((a: any) => ({
            id: a.analysis_id.toString(),
            companyName: a.company_name,
            domain: "",
            whenISO: new Date().toISOString(),
            initial: (a.company_name?.[0] || "?").toUpperCase(),
            color: pickColorFromString(a.company_name),
            analysisType: "An\u00e1lisis Completo",
            source: "main" as InputSource,
            stage: DONE_STATUSES.includes(a.status) ? "recommendations" : "analysis_progress",
            analysisStatus: DONE_STATUSES.includes(a.status) ? "completed" : "running",
            analysisProgress: DONE_STATUSES.includes(a.status) ? 100 : 0,
            messages: [{ id: uid(), role: "assistant" as "assistant", text: `An\u00e1lisis cargado (${a.status})`, tsISO: new Date().toISOString() }],
            recommendationCards: [],
          }));
          if (mapped.length > 0) {
            setChats(mapped);
            // Auto-load full data for completed analyses
            mapped
              .filter(c => DONE_STATUSES.includes(
                data.find((d: any) => d.analysis_id.toString() === c.id)?.status
              ))
              .forEach(c => fetchFullAnalysis(c.id));
          }
        }
      } catch (err) {
        console.error("History fetch error:", err);
      }
    }
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const companyRef = useRef<HTMLInputElement | null>(null);

  const mainValue = query.trim();
  const additionalHasValue = extraCompanyName.trim().length > 0 || extraIndustry.trim().length > 0;
  const mainLocked = inputSource === "additional";
  const additionalLocked = inputSource === "main";
  const mainValidation = mainValue ? validateUrl(mainValue) : { ok: false };

  const canSend =
    (inputSource === "main" && mainValue.length > 0 && mainValidation.ok) ||
    (inputSource === "additional" && additionalHasValue) ||
    (inputSource === null &&
      ((mainValue.length > 0 && mainValidation.ok) ||
        (mainValue.length === 0 && additionalHasValue)));

  const switchToMain = () => {
    setInputSource("main");
    setExtraCompanyName("");
    setExtraIndustry("");
    setQuery("");
    setUrlError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const switchToAdditional = () => {
    setInputSource("additional");
    setQuery("");
    setPopupOpen(true);
    requestAnimationFrame(() => companyRef.current?.focus());
  };

  const resetSource = () => {
    setInputSource(null);
    setUrlError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  async function pollAnalysisProgress(chatId: string) {
    const poll = async () => {
      try {
        const res = await fetchWithAuth(`/analysis/${chatId}/progress`);
        if (!res.ok) return;
        const data = await res.json();
        const { status, progress_percentage } = data;

        // Terminal statuses: stop polling and fetch full data
        const TERMINAL = ["analysis_completed", "completed", "failed"];

        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                ...c,
                analysisStatus: (TERMINAL.includes(status) ? "completed" : "running") as AnalysisStatus,
                analysisProgress: progress_percentage,
                analysisProgressLabel: getLabelFromStatus(status),
                stage: TERMINAL.includes(status) ? "recommendations" : "analysis_progress",
              }
              : c
          )
        );

        if (TERMINAL.includes(status)) {
          if (status !== "failed") fetchFullAnalysis(chatId);
          return; // Stop polling
        }

        setTimeout(poll, 1000);
      } catch (err) {
        console.error("Polling error:", err);
      }
    };
    poll();
  }

  function getLabelFromStatus(status: string) {
    const map: any = {
      researching: "Investigando cuenta...",
      insight_processing: "Extrayendo insights estratégicos...",
      recommending: "Generando recomendaciones HPE...",
      analysis_completed: "Análisis listo.",
      strategy_generating: "Generando estrategia de venta...",
      completed: "Proceso finalizado.",
    };
    return map[status] || "Procesando...";
  }

  async function fetchFullAnalysis(chatId: string, attempt = 0) {
    // Mark as loading while we fetch
    if (attempt === 0) {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, loadingRecommendations: true } : c));
    }

    try {
      const res = await fetchWithAuth(`/analysis/${chatId}/full`);
      if (res.ok) {
        const data = await res.json();

        // Retry logic: analysis_completed fires before Celery recommendation tasks finish.
        // However, if there are also 0 insights, it means the analysis had no useful data at all
        // (Tavily returned nothing, or embedding/LLM failed silently). In that case, stop retrying.
        const hasInsights = data.insights.length > 0;
        if (data.recommendations.length === 0 && hasInsights && attempt < 6) {
          setTimeout(() => fetchFullAnalysis(chatId, attempt + 1), 2000);
          return;
        }

        // If after all retries (or no insights at all), mark as empty
        const isEmpty = data.recommendations.length === 0 && data.insights.length === 0;

        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                ...c,
                loadingRecommendations: false,
                noInsights: isEmpty,
                insights: data.insights
                  .map((ins: any) => `\u2022 [${ins.severity?.toUpperCase() || 'INFO'}] ${ins.title}\n${ins.description}`)
                  .join("\n\n"),
                recommendationCards: data.recommendations.map((r: any): RecommendationCardUI => ({
                  id: r.id,
                  productId: r.product_id,
                  title: `Producto HPE #${r.product_id}`,
                  need: r.reasoning || "Oportunidad estrat\u00e9gica detectada.",
                  matchPercentage: Math.round(r.match_percentage ?? 0),
                  confidenceScore: r.confidence_score ?? 0,
                  isAccepted: Boolean(r.is_accepted),
                })),
                selectedRecommendationIds: data.recommendations
                  .filter((r: any) => r.is_accepted)
                  .map((r: any) => r.id as number),
                commercialPack: data.sales_strategy ? mapBackendStrategyToPack(data) : undefined,
                stage: data.sales_strategy ? "commercial" : "recommendations",
              }
              : c
          )
        );
      } else {
        const errText = await res.text();
        console.error("fetchFullAnalysis failed:", res.status, errText);
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, loadingRecommendations: false } : c));
      }
    } catch (err) {
      console.error("Fetch full error:", err);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, loadingRecommendations: false } : c));
    }
  }

  function mapBackendStrategyToPack(data: any): CommercialPack {
    const s = data.sales_strategy;
    return {
      companyName: data.company_name,
      problem: s.account_strategic_overview || "",
      solution: (s.priority_initiatives || []).join(", "),
      strategicMatchPct: data.strategic_score || 90,
      howToStart: s.executive_conversation_version || "",
      tone: "Consultivo / Ejecutivo",
      emphasize: "Eficiencia y Valor Comercial",
      avoid: "Tecnicismos sin contexto",
      speechText: s.email_version || "",
      speechWordCount: countWords(s.email_version || ""),
      versionLabel: "HPE INSIGHT AI v3.0",
      strategicData: [
        { id: "s1", title: "Visión Estratégica", subtitle: s.account_strategic_overview },
        { id: "s2", title: "Posicionamiento Financiero", subtitle: s.financial_positioning },
      ],
    };
  }

  const toggleRecommendation = async (chatId: string, recId: number) => {
    // Optimistic update
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const current = c.selectedRecommendationIds || [];
        const isSelected = current.includes(recId);
        const next = isSelected ? current.filter((id) => id !== recId) : [...current, recId];
        return { ...c, selectedRecommendationIds: next };
      })
    );

    try {

      const chat = chats.find(c => c.id === chatId);
      const isSelected = !(chat?.selectedRecommendationIds || []).includes(recId);
      await fetchWithAuth(`/analysis/${chatId}/recommendations/${recId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_accepted: isSelected }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateStrategy = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat || (chat.selectedRecommendationIds || []).length === 0) {
      alert("Debes seleccionar al menos una recomendación para continuar");
      return;
    }

    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, stage: "commercial_progress", commercialProgress: 10, commercialProgressLabel: "Iniciando generación comercial..." }
          : c
      )
    );

    try {
      const res = await fetchWithAuth(`/analysis/${chatId}/regenerate-strategy`, { method: "POST" });
      if (res.ok) {
        pollAnalysisProgress(chatId); // Poll for "completed" again
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerate = async (chatId: string) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, stage: "commercial_progress", commercialProgress: 10, commercialProgressLabel: "Regenerando estrategia..." }
          : c
      )
    );
    try {
      const res = await fetchWithAuth(`/analysis/${chatId}/regenerate-strategy`, { method: "POST" });
      if (res.ok) pollAnalysisProgress(chatId); // MUST poll — strategy is generated async via Celery
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAnalysis = async (chatId: string) => {
    try {
      const res = await fetchWithAuth(`/analysis/${chatId}`, { method: "DELETE" });
      if (res.ok) {
        deleteChat(chatId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    const source: InputSource = inputSource ?? (mainValue ? "main" : additionalHasValue ? "additional" : null);
    if (!source) return;

    let normalized = "";
    let companyName = "";
    let domain = "";
    let industryLabel = "";
    let indId = 1;

    if (source === "main") {
      const v = validateUrl(mainValue);
      if (!v.ok) { setUrlError(v.error!); return; }
      normalized = v.normalized!;
      domain = extractDomain(normalized);
      companyName = domain;
    } else {
      companyName = extraCompanyName.trim();
      industryLabel = extraIndustry.trim();
      indId = getIndustryId(industryLabel);
    }

    try {
      const payload: Record<string, any> = {
        company_name: companyName,
        industry_id: indId,
        analysis_type: analysisType,
      };
      if (normalized) payload["website_url"] = normalized;

      const res = await fetchWithAuth("/analysis/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const chatId = data.analysis_id.toString();

        const newChat: ChatItem = {
          id: chatId,
          companyName,
          domain,
          whenISO: new Date().toISOString(),
          initial: (companyName[0] || "?").toUpperCase(),
          color: pickColorFromString(companyName),
          analysisType,
          source,
          url: normalized,
          industryLabel,
          industryId: indId,
          messages: [],
          analysisStatus: "running",
          analysisProgress: 0,
          analysisProgressLabel: "Iniciando an\u00e1lisis...",
          stage: "analysis_progress",
        };

        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(chatId);
        setQuery("");
        setExtraCompanyName("");
        setExtraIndustry("");
        setInputSource(null);
        setPopupOpen(false);
        setUrlError(null);

        pollAnalysisProgress(chatId);
      } else {
        // Try to read the error body for a clearer message
        let msg = "Error del servidor al iniciar an\u00e1lisis.";
        try {
          const errData = await res.json();
          if (errData?.detail) msg = errData.detail;
        } catch { }
        setUrlError(msg);
      }
    } catch (err) {
      console.error(err);
      setUrlError("Error de conexión con el backend.");
    }
  };



  const handleNewChat = () => {
    setActiveChatId(null);
    setQuery("");
    setExtraCompanyName("");
    setExtraIndustry("");
    setInputSource(null);
    setUrlError(null);
    setPopupOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const showComposer = !activeChat || activeChat.stage === "input";

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-140px)] gap-6">
        {/* Sidebar */}
        <section className={[
          "shrink-0 rounded-2xl border border-border bg-app shadow-sm h-full flex flex-col min-h-0 transition-all duration-300",
          sidebarCollapsed ? "w-[96px]" : "w-[360px]",
        ].join(" ")}>
          <div className={["border-b border-border", sidebarCollapsed ? "px-2 py-3" : "px-5 py-4"].join(" ")}>
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Historial</div>
                <button onClick={() => setSidebarCollapsed(true)} className="icon-btn h-10 w-10 rounded-xl border border-border"><PanelLeft size={18} /></button>
              </div>
            ) : (
              <button onClick={() => setSidebarCollapsed(false)} className="mx-auto block icon-btn h-10 w-10 rounded-xl border border-border"><PanelRight size={18} /></button>
            )}
            <button onClick={handleNewChat} className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border bg-card py-2 text-sm font-semibold hover:bg-hover">
              <Plus size={16} /> {!sidebarCollapsed && "Nuevo chat"}
            </button>
          </div>

          <div className="flex-1 overflow-auto px-2 py-3">
            {chats.map((h) => (
              <div key={h.id} className={["relative flex items-center p-3 mb-2 rounded-2xl border transition group", h.id === activeChatId ? "border-brand bg-brand-accent" : "border-border bg-card hover:bg-hover"].join(" ")}>
                <button onClick={() => setActiveChatId(h.id)} className="flex-1 flex items-center gap-3 overflow-hidden text-left">
                  <div className={["h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold", h.color].join(" ")}>{h.initial}</div>
                  {!sidebarCollapsed && (
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate">{h.companyName}</div>
                      <div className="text-[10px] text-text-muted">{formatWhen(h.whenISO)}</div>
                    </div>
                  )}
                </button>
                {!sidebarCollapsed && (
                  <button onClick={() => deleteChat(h.id)} className="opacity-0 group-hover:opacity-100 p-2 text-text-muted hover:text-error transition"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Main Content */}
        <section className="flex-1 rounded-2xl border border-border bg-app shadow-sm h-full flex flex-col min-h-0 overflow-hidden">
          <header className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brand flex items-center justify-center text-white"><Zap size={18} /></div>
              <div>
                <div className="text-sm font-bold">HPE Insight AI</div>
                <div className="text-[10px] text-text-secondary">Enterprise Intelligence</div>
              </div>
            </div>
          </header>

          <div className="flex-1 flex flex-col min-h-0 relative">
            <div className="flex-1 overflow-auto px-6 py-8 pb-44">
              {!activeChat ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <h2 className="text-3xl font-bold tracking-tight">Bienvenido a HPE Insight AI</h2>
                  <p className="mt-2 text-text-secondary">Ingresa una cuenta para comenzar el análisis estratégico.</p>
                </div>
              ) : (
                <div className="max-w-[860px] mx-auto space-y-8">
                  {activeChat.analysisStatus === "running" && (
                    <ProgressCard title="Análisis en curso" progress={activeChat.analysisProgress ?? 0} label={activeChat.analysisProgressLabel ?? ""} />
                  )}

                  {activeChat.stage === "recommendations" && (
                    <div className="space-y-6">
                      {/* Case: analysis completed but found no useful data */}
                      {activeChat.noInsights && (
                        <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 border border-dashed border-amber-400/40 bg-amber-50/10 rounded-2xl">
                          <div className="text-3xl">🔍</div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-text-primary">Sin datos suficientes para analizar</p>
                            <p className="text-xs text-text-secondary mt-1 max-w-sm">
                              El motor de búsqueda no encontró información pública disponible para <strong>{activeChat.companyName}</strong>.
                              Prueba con el nombre exacto de la empresa o una URL diferente.
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteAnalysis(activeChat.id)}
                            className="px-4 py-2 text-xs font-bold border border-error/50 text-error rounded-xl hover:bg-error/5 transition flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Eliminar e intentar de nuevo
                          </button>
                        </div>
                      )}

                      {/* Normal recommendations flow */}
                      {!activeChat.noInsights && (
                        <>
                          {activeChat.insights && (
                            <div className="p-5 rounded-2xl bg-card border border-border text-sm text-text-primary leading-relaxed shadow-sm">
                              <h4 className="font-bold mb-3 flex items-center gap-2"><Lightbulb size={16} className="text-amber-500" /> Insights del Análisis</h4>
                              <pre className="whitespace-pre-wrap font-sans text-xs text-text-secondary">{activeChat.insights}</pre>
                            </div>
                          )}

                          {/* Loading state while retrying */}
                          {activeChat.loadingRecommendations && (
                            <div className="flex flex-col items-center justify-center gap-3 py-10 text-text-secondary">
                              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                              <p className="text-sm font-medium">Cargando recomendaciones HPE...</p>
                              <p className="text-xs text-text-muted">El análisis está procesando las recomendaciones. Espera un momento.</p>
                            </div>
                          )}

                          {!activeChat.loadingRecommendations && (
                            <>
                              {(activeChat.recommendationCards?.length ?? 0) > 0 ? (
                                <RecommendationsSection
                                  cards={activeChat.recommendationCards}
                                  selectedIds={activeChat.selectedRecommendationIds || []}
                                  onToggle={(id) => toggleRecommendation(activeChat.id, id)}
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-3 py-10 border border-dashed border-border rounded-2xl text-text-secondary">
                                  <p className="text-sm font-medium">No hay recomendaciones disponibles aún.</p>
                                  <p className="text-xs text-text-muted">El motor de IA puede estar procesando. Intenta recargar.</p>
                                  <button
                                    onClick={() => fetchFullAnalysis(activeChat.id)}
                                    className="mt-2 px-4 py-2 text-xs font-bold border border-brand text-brand rounded-xl hover:bg-brand/5 transition flex items-center gap-2"
                                  >
                                    <RefreshCw size={14} /> Recargar recomendaciones
                                  </button>
                                </div>
                              )}
                              {(activeChat.recommendationCards?.length ?? 0) > 0 && (
                                <div className="flex justify-center pt-4">
                                  <button
                                    onClick={() => handleGenerateStrategy(activeChat.id)}
                                    className="px-8 py-4 bg-brand text-white rounded-2xl font-bold shadow-lg hover:bg-brand-dark transition-all transform hover:scale-105"
                                  >
                                    Generar Estrategia de Venta
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeChat.stage === "commercial_progress" && (
                    <ProgressCard title="Estrategia Comercial" progress={activeChat.commercialProgress ?? 0} label={activeChat.commercialProgressLabel ?? ""} />
                  )}

                  {activeChat.stage === "commercial" && activeChat.commercialPack && (
                    <CommercialSection
                      pack={activeChat.commercialPack}
                      onCopySpeech={() => navigator.clipboard.writeText(activeChat.commercialPack!.speechText)}
                      onDelete={() => handleDeleteAnalysis(activeChat.id)}
                      onRegenerate={() => handleRegenerate(activeChat.id)}
                      onGoInsights={() => navigate("/insights")}
                    />
                  )}

                  <div className="pt-8 border-t border-border space-y-4">
                    {activeChat.messages.map(m => (
                      <div key={m.id} className={["flex w-full", m.role === "user" ? "justify-end" : "justify-start"].join(" ")}>
                        <div className={["max-w-[70%] px-4 py-3 rounded-2xl text-sm border", m.role === "user" ? "bg-brand-accent border-brand/20" : "bg-card border-border"].join(" ")}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {showComposer && (
              <div className="absolute bottom-0 left-0 w-full px-6 py-5 bg-gradient-to-t from-app via-app pt-10">
                <Composer
                  mode="bottom"
                  query={query}
                  setQuery={setQuery}
                  popupOpen={popupOpen}
                  setPopupOpen={setPopupOpen}
                  analysisType={analysisType}
                  setAnalysisType={setAnalysisType}
                  popupRef={popupRef}
                  plusBtnRef={plusBtnRef}
                  onSend={handleSend}
                  inputRef={inputRef}
                  companyRef={companyRef}
                  extraCompanyName={extraCompanyName}
                  setExtraCompanyName={setExtraCompanyName}
                  extraIndustry={extraIndustry}
                  setExtraIndustry={setExtraIndustry}
                  inputSource={inputSource}
                  setInputSource={setInputSource}
                  mainLocked={mainLocked}
                  additionalLocked={additionalLocked}
                  canSend={canSend}
                  switchToMain={switchToMain}
                  switchToAdditional={switchToAdditional}
                  resetSource={resetSource}
                  urlError={urlError}
                  setUrlError={setUrlError}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ===================== SUB-COMPONENTS ===================== */

function ProgressCard({ title, progress, label }: { title: string; progress: number; label: string }) {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
        </div>
        <div className="text-lg font-bold text-brand tabular-nums">{p}%</div>
      </div>
      <div className="h-2 w-full bg-hover rounded-full overflow-hidden border border-border">
        <div className="h-full bg-brand transition-all duration-300" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function RecommendationsSection({ cards, selectedIds, onToggle }: { cards?: RecommendationCardUI[]; selectedIds: number[]; onToggle: (id: number) => void }) {
  if (!cards?.length) return null;

  return (
    <div className="space-y-4">
      <div className="text-sm font-bold text-text-secondary uppercase tracking-widest pl-1">Recomendaciones Detectadas</div>
      <div className="grid grid-cols-1 gap-4">
        {cards.map(c => {
          const isSelected = selectedIds.includes(c.id);
          return (
            <div
              key={c.id}
              onClick={() => onToggle(c.id)}
              className={["cursor-pointer group relative p-5 rounded-2xl border transition-all duration-200 shadow-sm", isSelected ? "border-brand bg-brand-accent/30 ring-1 ring-brand" : "border-border bg-card hover:border-brand/40"].join(" ")}
            >
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <div className={["w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors", isSelected ? "bg-brand border-brand" : "border-border bg-app"].join(" ")}>
                    {isSelected && <Check size={14} className="text-white" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-base truncate">{c.title}</h4>
                    <span className="text-[10px] bg-hover px-2 py-0.5 rounded-full font-bold uppercase text-text-muted">Product ID: {c.productId}</span>
                  </div>
                  <p className="text-sm text-text-secondary mb-3 leading-relaxed">{c.need}</p>
                  <div className="flex items-center gap-4 text-[11px] text-text-muted font-semibold">
                    <span className="flex items-center gap-1"><Zap size={12} className="text-amber-500" /> {c.matchPercentage}% Match</span>
                    <span>Confianza: {(c.confidenceScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CommercialSection({ pack, onCopySpeech, onDelete, onRegenerate, onGoInsights }: { pack: CommercialPack; onCopySpeech: () => void; onDelete: () => void; onRegenerate: () => void; onGoInsights: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pack.strategicData.map(d => (
          <div key={d.id} className="p-5 rounded-2xl border border-border bg-card shadow-sm">
            <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1">{d.title}</div>
            <div className="text-sm font-semibold text-text-primary leading-snug">{d.subtitle}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-md">
        <div className="px-6 py-4 bg-page border-b border-border flex justify-between items-center">
          <div className="text-xs font-bold flex items-center gap-2"><Send size={14} /> SPEECH DE VENTA SUGERIDO</div>
          <button onClick={onCopySpeech} className="p-2 hover:bg-hover rounded-lg transition text-text-secondary"><Copy size={16} /></button>
        </div>
        <div className="p-8 text-sm leading-relaxed whitespace-pre-wrap text-text-primary bg-app/40 m-4 rounded-2xl border border-border italic border-dashed">
          "{pack.speechText}"
        </div>
        <div className="px-8 py-6 border-t border-border bg-card grid grid-cols-2 gap-8">
          <div>
            <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Tono Recomendado</div>
            <div className="text-xs font-medium">{pack.tone}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Qué Evitar</div>
            <div className="text-xs font-medium">{pack.avoid}</div>
          </div>
          <div>
            <button onClick={onGoInsights} className="text-xs font-bold text-brand flex items-center gap-1 underline">Más insights <ExternalLink size={12} /></button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
        <button
          onClick={onDelete}
          className="px-6 py-3 rounded-2xl border border-error/50 text-error font-bold text-sm hover:bg-error/5 transition-colors flex items-center gap-2"
        >
          <Trash2 size={16} /> Eliminar Análisis
        </button>
        <button
          onClick={onRegenerate}
          className="px-6 py-3 rounded-2xl border border-brand text-brand font-bold text-sm hover:bg-brand/5 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} /> Regenerar Estrategia
        </button>
      </div>
    </div>
  );
}

interface ComposerProps {
  mode: "center" | "bottom";
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  popupOpen: boolean;
  setPopupOpen: Dispatch<SetStateAction<boolean>>;
  analysisType: string;
  setAnalysisType: Dispatch<SetStateAction<string>>;
  popupRef: RefObject<HTMLDivElement | null>;
  plusBtnRef: RefObject<HTMLButtonElement | null>;
  onSend: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  companyRef: RefObject<HTMLInputElement | null>;
  extraCompanyName: string;
  setExtraCompanyName: Dispatch<SetStateAction<string>>;
  extraIndustry: string;
  setExtraIndustry: Dispatch<SetStateAction<string>>;
  inputSource: InputSource;
  setInputSource: Dispatch<SetStateAction<InputSource>>;
  mainLocked: boolean;
  additionalLocked: boolean;
  canSend: boolean;
  switchToMain: () => void;
  switchToAdditional: () => void;
  resetSource: () => void;
  urlError: string | null;
  setUrlError: Dispatch<SetStateAction<string | null>>;
}

function Composer({
  mode, query, setQuery, popupOpen, setPopupOpen, analysisType, setAnalysisType, popupRef, plusBtnRef, onSend, inputRef, companyRef, extraCompanyName, setExtraCompanyName, extraIndustry, setExtraIndustry, setInputSource, mainLocked, additionalLocked, canSend, switchToMain, urlError
}: ComposerProps) {
  const industries = ["Tecnología", "Finanzas", "Retail", "Manufactura", "Logística", "Salud", "Educación", "Gobierno", "E-commerce"];
  const options = ["Análisis Completo", "Detectar Oportunidades", "Mapear Stack Actual", "Analizar Madurez Digital"];
  const openUp = mode === "bottom";

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 shadow-xl">
        <div className="relative">
          <button ref={plusBtnRef} onClick={() => setPopupOpen(!popupOpen)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-app border border-border hover:bg-hover transition"><Plus size={18} /></button>

          {popupOpen && (
            <div ref={popupRef} className={["absolute left-0 w-[400px] bg-app border border-border rounded-2xl shadow-2xl p-4 z-50 space-y-4", openUp ? "bottom-14" : "top-14"].join(" ")}>
              <div>
                <div className="text-[10px] font-bold text-text-muted uppercase mb-2">Análisis</div>
                <div className="grid grid-cols-2 gap-2">
                  {options.map(o => (
                    <button key={o} onClick={() => { setAnalysisType(o); setPopupOpen(false); }} className={["px-3 py-2 text-[10px] rounded-lg border text-left font-semibold transition", analysisType === o ? "border-brand bg-brand-accent text-brand" : "border-border hover:bg-hover"].join(" ")}>{o}</button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="text-[10px] font-bold text-text-muted uppercase mb-2">Información Manual</div>
                <input ref={companyRef} value={extraCompanyName} disabled={additionalLocked} onChange={e => { setInputSource("additional"); setExtraCompanyName(e.target.value); setQuery(""); }} placeholder="Nombre de empresa..." className="w-full bg-card border border-border rounded-xl px-4 py-2 text-xs mb-2 outline-none focus:border-brand" />
                <select value={extraIndustry} disabled={additionalLocked} onChange={e => { setInputSource("additional"); setExtraIndustry(e.target.value); setQuery(""); }} className="w-full bg-card border border-border rounded-xl px-4 py-2 text-xs outline-none focus:border-brand">
                  <option value="">Industria...</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center min-w-0">
          {mainLocked ? (
            <button onClick={switchToMain} className="text-xs font-bold text-brand bg-brand-accent px-3 py-1 rounded-lg border border-brand/20">Usando Manual (Reset?)</button>
          ) : (
            <input ref={inputRef} value={query} onChange={e => { setInputSource("main"); setQuery(e.target.value); setExtraCompanyName(""); setExtraIndustry(""); }} onKeyDown={e => e.key === "Enter" && canSend && onSend()} placeholder="URL o nombre de la cuenta..." className="w-full bg-transparent outline-none text-sm placeholder:text-text-muted" />
          )}
        </div>

        <button onClick={onSend} disabled={!canSend} className={["h-10 w-10 flex items-center justify-center rounded-full transition-all", canSend ? "bg-brand text-white shadow-lg scale-105" : "bg-border text-text-muted"].join(" ")}><ArrowUp size={18} /></button>
      </div>
      {urlError && <div className="mt-2 ml-2 text-[10px] text-error font-semibold">⚠ {urlError}</div>}
    </div>
  );
}
