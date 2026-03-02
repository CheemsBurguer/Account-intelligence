import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../components/layout/AppShell";
import {
  Search,
  Plus,
  ArrowUp,
  ChevronDown,
  MoreHorizontal,
  Zap,
  Check,
  PanelLeft,
  PanelRight,
  Trash2,
  ExternalLink,
  MessageSquare,
  Send,
  Lightbulb,
  Ban,
  Copy,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";

/* ===================== FRONTEND ONLY ===================== */
/* UI/UX listo. Endpoints se integrarán después. */

/* ===================== TYPES ===================== */

type AnalysisStatus = "idle" | "running" | "completed" | "error";
type ChatStage = "input" | "analysis_progress" | "recommendations" | "commercial_progress" | "commercial";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tsISO: string;
};

type StrategyLevelUI = "alta" | "media" | "pequeña";

type RecommendationCardUI = {
  id: number; // id recommendation (backend)
  productId?: number;
  cardId: 1 | 2 | 3; // 1=alta, 2=media, 3=pequeña
  strategy: StrategyLevelUI;

  title: string;
  need: string;
  solution: string;
  howResolves: string;
  sourceLabel?: string;
  sourceUrl: string;

  matchPercentage?: number; // 0-100 (backend: match_percentage)
  confidenceScore?: number; // 0-1 (backend: confidence_score)
  isAccepted?: boolean; // (backend: is_accepted)
};

type CommercialFocusCard = {
  id: string;
  title: string;
  subtitle: string;
};

type CommercialPack = {
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
};

type ChatItem = {
  id: string;
  companyName: string;
  domain: string;
  whenISO: string;
  initial: string;
  color: string;
  analysisType: string;

  url?: string;
  industryLabel?: string;
  industryId?: number;

  messages: Message[];

  // pipeline UI
  analysisStatus?: AnalysisStatus;
  analysisProgress?: number;
  analysisProgressLabel?: string;

  stage?: ChatStage;

  // recommendations
  recommendationCards?: RecommendationCardUI[];
  selectedRecommendationId?: number | null;

  // commercial generation UI
  commercialProgress?: number;
  commercialProgressLabel?: string;
  commercialPack?: CommercialPack | null;
};

/* ===================== HELPERS ===================== */

function uid() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`) as string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function validateUrl(raw: string): { ok: boolean; normalized?: string; error?: string } {
  const v = raw.trim();
  if (!v) return { ok: false, error: "Ingresa una URL válida." };

  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "Solo se permiten URLs http o https." };
    }
    const host = u.hostname ?? "";
    if (!host.includes(".") || host.startsWith(".") || host.endsWith(".")) {
      return { ok: false, error: "La URL debe incluir un dominio válido (ej. empresa.com)." };
    }
    if (/\s/.test(v)) return { ok: false, error: "La URL no puede contener espacios." };
    return { ok: true, normalized: u.toString() };
  } catch {
    return { ok: false, error: "Eso no parece una URL válida. Ej: https://empresa.com" };
  }
}

function extractDomain(normalizedUrl: string) {
  const u = new URL(normalizedUrl);
  return u.hostname.replace(/^www\./i, "");
}

function truncateIfUrl(text: string, max = 110) {
  const t = text.trim();
  const looksLikeUrl = /^https?:\/\//i.test(t) || /^[\w-]+\.[a-z]{2,}/i.test(t);
  if (!looksLikeUrl) return text;
  if (t.length <= max) return t;
  return t.slice(0, max) + "…";
}

function formatWhen(whenISO: string) {
  const d = new Date(whenISO);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Hoy";
  if (days === 1) return "1 día";
  if (days < 30) return `${days} días`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 mes";
  return `${months} meses`;
}

function pickColorFromString(input: string) {
  const colors = [
    "bg-black",
    "bg-red-600",
    "bg-blue-600",
    "bg-orange-600",
    "bg-emerald-600",
    "bg-purple-600",
    "bg-sky-600",
    "bg-pink-600",
  ];
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

function strategyToCardId(strategy: StrategyLevelUI): 1 | 2 | 3 {
  if (strategy === "alta") return 1;
  if (strategy === "media") return 2;
  return 3;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* ===== Industry mapping (TEMP) ===== */
const INDUSTRIES = [
  "Tecnología",
  "Finanzas",
  "Retail",
  "Manufactura",
  "Logística",
  "Salud",
  "Educación",
  "Gobierno",
  "E-commerce",
] as const;

const INDUSTRY_ID_MAP: Record<(typeof INDUSTRIES)[number], number> = {
  "Tecnología": 1,
  "Finanzas": 2,
  "Retail": 3,
  "Manufactura": 4,
  "Logística": 5,
  "Salud": 6,
  "Educación": 7,
  "Gobierno": 8,
  "E-commerce": 9,
};

function getIndustryId(label: string): number {
  return (INDUSTRY_ID_MAP as any)[label] ?? 1;
}

/* ===================== MOCK BUILDERS ===================== */

function buildRecommendationCardsUI(companyName: string): RecommendationCardUI[] {
  const priority: RecommendationCardUI = {
    id: 187,
    productId: 1,
    strategy: "alta",
    cardId: 1,
    title: "HPE GreenLake for Cloud Services",
    need: `${companyName} necesita ampliar su infraestructura tecnológica conforme crecen sus operaciones, evitando inversiones iniciales grandes.`,
    solution:
      "Permite consumir infraestructura bajo demanda, combinando la flexibilidad de la nube con el control de entornos locales.",
    howResolves:
      "Permite pagar únicamente por la capacidad utilizada. Cuando la operación crece, la infraestructura puede ampliarse; cuando disminuye, el costo también se ajusta. Esto ayuda a mantener control financiero y flexibilidad operativa.",
    sourceLabel: "Fuente Oficial:",
    sourceUrl: "https://www.hpe.com/us/en/greenlake.html",
    matchPercentage: 61.0,
    confidenceScore: 0.6112,
    isAccepted: false,
  };

  const secondary: RecommendationCardUI = {
    id: 188,
    productId: 203,
    strategy: "media",
    cardId: 2,
    title: "HPE Alletra Storage",
    need: "Gestión y almacenamiento de grandes volúmenes de datos generados por operaciones digitales.",
    solution:
      "Almacenamiento moderno y escalable que simplifica la gestión de datos en entornos híbridos.",
    howResolves:
      "Reduce complejidad operativa, mejora disponibilidad y acelera la modernización de almacenamiento con enfoque híbrido.",
    sourceLabel: "Fuente Oficial:",
    sourceUrl: "https://www.hpe.com/us/en/storage/alletra.html",
    matchPercentage: 76,
    confidenceScore: 0.71,
    isAccepted: false,
  };

  const third: RecommendationCardUI = {
    id: 189,
    productId: 318,
    strategy: "pequeña",
    cardId: 3,
    title: "HPE Ezmeral",
    need: "Unificación de datos distribuidos entre e‑commerce, logística y diferentes unidades del negocio.",
    solution:
      "Integra y gestiona datos desde múltiples sistemas, facilitando análisis y toma de decisiones en tiempo real.",
    howResolves:
      "Consolida fuentes de datos y habilita analítica para acelerar decisiones, reduciendo silos y tiempos de respuesta.",
    sourceLabel: "Fuente Oficial:",
    sourceUrl: "https://www.hpe.com/mx/es/hpe-ezmeral-unified-analytics.html",
    matchPercentage: 64,
    confidenceScore: 0.62,
    isAccepted: false,
  };

  return [priority, secondary, third];
}

function buildCommercialPack(args: {
  companyName: string;
  selectedSolutionTitle: string;
  strategicMatchPct: number;
}): CommercialPack {
  const speech = `Estimado [Nombre del Cliente], es un gusto saludarte. He seguido con interés la evolución de ${args.companyName} y su enfoque actual en eficiencia y rentabilidad operativa.

Entendemos que, tras una etapa de expansión, hoy la prioridad estratégica es optimizar costos, mejorar la previsibilidad financiera y mantener la agilidad tecnológica sin comprometer el flujo de caja.

Desde HPE, hemos identificado que el crecimiento sostenido de operaciones digitales e inventario intensivo en datos puede generar presión sobre infraestructura tradicional. ${args.selectedSolutionTitle} permite adoptar un esquema de pago por uso, ajustando la capacidad conforme crece o se estabiliza la demanda.

¿Te parecería explorar un piloto de 30-45 días para validar impacto y tiempo de valor?`;

  return {
    companyName: args.companyName,
    problem: "Escalabilidad tecnológica bajo presión operativa",
    solution: args.selectedSolutionTitle,
    strategicMatchPct: Math.round(args.strategicMatchPct),
    howToStart:
      `Reconoce el liderazgo de ${args.companyName} en su mercado y su evolución hacia eficiencia operativa y control financiero.`,
    tone:
      "Consultivo, estratégico y orientado a negocio. Evita un enfoque técnico inicial; prioriza impacto financiero, previsibilidad de costos y agilidad operativa.",
    emphasize:
      "Flexibilidad financiera del pago por uso, optimización de costos operativos y capacidad de escalar sin grandes inversiones iniciales.",
    avoid:
      "Evita profundizar en especificaciones técnicas a menos que el cliente lo solicite. No enfoques la conversación en compra de equipos, sino en resultados de negocio.",
    speechText: speech,
    speechWordCount: countWords(speech),
    versionLabel: "VERSIÓN 1.0 GENERADA CON 3 DATOS",
    strategicData: [
      {
        id: uid(),
        title: "Enfoque en eficiencia operativa",
        subtitle: "Prioridad estratégica actual orientada a control de costos y rentabilidad sostenible.",
      },
      {
        id: uid(),
        title: "Expansión digital e inventario creciente",
        subtitle: "Crecimiento sostenido en operaciones digitales, modelos de valuación y volumen de datos.",
      },
      {
        id: uid(),
        title: "Necesidad de flexibilidad financiera",
        subtitle: "Transición hacia modelos tecnológicos con menor inversión inicial y mayor previsibilidad de costos.",
      },
    ],
  };
}

/* ===================== MAIN ===================== */

export default function AccountProfile() {
  const navigate = useNavigate();

  // ✅ SOLO URL + INDUSTRIA (y desaparece después de enviar/análisis)
  const [urlInput, setUrlInput] = useState("");
  const [industryLabel, setIndustryLabel] = useState<string>("");

  const [urlError, setUrlError] = useState<string | null>(null);
  const [industryError, setIndustryError] = useState<string | null>(null);

  const [popupOpen, setPopupOpen] = useState(false);
  const [analysisType, setAnalysisType] = useState("Análisis Completo");

  // Sidebar collapse
  const SIDEBAR_KEY = "hpe_profile360_sidebar_collapsed_v3";
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {}
  }, [sidebarCollapsed]);

  // Chats persistence
  const CHATS_KEY = "hpe_profile360_chats_v3";
  const ACTIVE_KEY = "hpe_profile360_active_chat_v3";

  const [chats, setChats] = useState<ChatItem[]>(() => {
    try {
      const raw = localStorage.getItem(CHATS_KEY);
      return raw ? (JSON.parse(raw) as ChatItem[]) : [];
    } catch {
      return [];
    }
  });

  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  });

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  useEffect(() => {
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    } catch {}
  }, [chats]);

  useEffect(() => {
    try {
      if (activeChatId) localStorage.setItem(ACTIVE_KEY, activeChatId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  }, [activeChatId]);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement | null>(null);
  const urlRef = useRef<HTMLInputElement | null>(null);

  // close popup outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!popupOpen) return;
      const p = popupRef.current;
      const b = plusBtnRef.current;
      const target = e.target as Node;
      if (p && p.contains(target)) return;
      if (b && b.contains(target)) return;
      setPopupOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [popupOpen]);

  const canSend = useMemo(() => {
    const urlV = urlInput.trim() ? validateUrl(urlInput.trim()) : { ok: false };
    return urlV.ok && industryLabel.trim().length > 0;
  }, [urlInput, industryLabel]);

  function deleteChat(chatId: string) {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    setActiveChatId((prevActive) => {
      if (prevActive !== chatId) return prevActive;
      // pick next available
      const remaining = chats.filter((c) => c.id !== chatId);
      return remaining.length ? remaining[0].id : null;
    });
  }

  function clearActiveAnalysis() {
    if (!activeChatId) return;
    deleteChat(activeChatId);
  }

  const handleNewChat = () => {
    const chatId = uid();
    const nowISO = new Date().toISOString();

    const newChat: ChatItem = {
      id: chatId,
      companyName: "Nuevo chat",
      domain: "",
      whenISO: nowISO,
      initial: "N",
      color: "bg-black",
      analysisType,
      messages: [],
      analysisStatus: "idle",
      stage: "input",
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(chatId);

    requestAnimationFrame(() => urlRef.current?.focus());
  };

  async function runAnalysisProgress(chatId: string, companyName: string, domain: string) {
    const steps = [
      { p: 10, t: "Analizando señales públicas…" },
      { p: 35, t: "Detectando necesidades e intención…" },
      { p: 62, t: "Generando recomendaciones HPE…" },
      { p: 85, t: "Preparando estrategia comercial…" },
      { p: 100, t: "Análisis completado." },
    ];

    for (const s of steps) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                analysisStatus: s.p === 100 ? "completed" : "running",
                analysisProgress: s.p,
                analysisProgressLabel: s.t,
                stage: s.p === 100 ? "recommendations" : "analysis_progress",
                whenISO: new Date().toISOString(),
              }
            : c
        )
      );
      await sleep(s.p === 100 ? 450 : 700);
    }

    // set recommendation cards
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              recommendationCards: buildRecommendationCardsUI(companyName || domain || "Cuenta"),
            }
          : c
      )
    );
  }

  async function runCommercialProgress(chatId: string, pack: CommercialPack) {
    const steps = [
      { p: 12, t: "Preparando enfoque comercial…" },
      { p: 36, t: "Armando speech sugerido…" },
      { p: 64, t: "Consolidando datos estratégicos…" },
      { p: 88, t: "Finalizando output…" },
      { p: 100, t: "Enfoque comercial generado." },
    ];

    for (const s of steps) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                stage: s.p === 100 ? "commercial" : "commercial_progress",
                commercialProgress: s.p,
                commercialProgressLabel: s.t,
                whenISO: new Date().toISOString(),
              }
            : c
        )
      );
      await sleep(s.p === 100 ? 350 : 650);
    }

    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              stage: "commercial",
              commercialPack: pack,
            }
          : c
      )
    );
  }

  async function selectOneRecommendation(chatId: string, recommendationId: number) {
    const chat = chats.find((c) => c.id === chatId);
    const selected = chat?.recommendationCards?.find((r) => r.id === recommendationId);

    // ✅ optimistic UI: SOLO UNA seleccionada (preparado para is_accepted)
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const nextRecs = (c.recommendationCards ?? []).map((r) => ({
          ...r,
          isAccepted: r.id === recommendationId ? true : false,
        }));

        return {
          ...c,
          selectedRecommendationId: recommendationId,
          recommendationCards: nextRecs, // guardamos estado, pero luego limpiamos pantalla
          whenISO: new Date().toISOString(),
        };
      })
    );

    // limpiamos cards de recomendaciones del UI (tal como pediste)
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              recommendationCards: [],
              commercialPack: null,
              stage: "commercial_progress",
              commercialProgress: 0,
              commercialProgressLabel: "Preparando enfoque comercial…",
            }
          : c
      )
    );

    const pack = buildCommercialPack({
      companyName: chat?.companyName || chat?.domain || "Cuenta",
      selectedSolutionTitle: selected?.title ?? "Solución seleccionada",
      strategicMatchPct: Math.round(selected?.matchPercentage ?? 0) || 0,
    });

    // ✅ aquí después conectas endpoint:
    // await apiJson(`/recommendations/${recommendationId}`, { method:"PATCH", body: JSON.stringify({is_accepted:true}) })
    // y luego GET sales-strategy para setear pack real

    await runCommercialProgress(chatId, pack);
  }

  const handleSend = () => {
    const urlV = validateUrl(urlInput.trim());
    const ind = industryLabel.trim();

    setUrlError(urlV.ok ? null : urlV.error ?? "URL inválida.");
    setIndustryError(ind ? null : "Selecciona una industria.");

    if (!urlV.ok || !urlV.normalized || !ind) return;

    const normalized = urlV.normalized;
    const domain = extractDomain(normalized);
    const companyName = domain; // ✅ ya no pedimos nombre, usamos el dominio como nombre
    const indId = getIndustryId(industryLabel);

    const nowISO = new Date().toISOString();

    const chatId = activeChatId ?? uid();
    const isNew = !activeChatId;

    const baseChat: ChatItem = {
      id: chatId,
      companyName,
      domain,
      whenISO: nowISO,
      initial: (companyName[0] || "?").toUpperCase(),
      color: pickColorFromString(domain || companyName),
      analysisType,
      url: normalized,
      industryLabel,
      industryId: indId,
      messages: [],
      analysisStatus: "running",
      analysisProgress: 0,
      analysisProgressLabel: "Iniciando…",
      stage: "analysis_progress",
      selectedRecommendationId: null,
      commercialPack: null,
    };

    if (isNew) {
      setChats((prev) => [baseChat, ...prev]);
      setActiveChatId(chatId);
    } else {
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, ...baseChat, messages: c.messages } : c)));
    }

    // ✅ esconder composer después de enviar
    setUrlInput("");
    setIndustryLabel("");
    setUrlError(null);
    setIndustryError(null);
    setPopupOpen(false);

    runAnalysisProgress(chatId, companyName, domain).catch(() => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, analysisStatus: "error", analysisProgressLabel: "Error al analizar.", stage: "input" }
            : c
        )
      );
    });
  };

  const showComposer = !activeChat || activeChat.stage === "input";

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-140px)] gap-6">
        {/* Sidebar / Historial */}
        <section
          className={[
            "shrink-0 rounded-2xl border border-border bg-app shadow-sm h-full flex flex-col min-h-0 transition-all duration-300",
            sidebarCollapsed ? "w-[96px]" : "w-[360px]",
          ].join(" ")}
        >
          {/* Header */}
          <div className={[ "border-b border-border", sidebarCollapsed ? "px-2 py-3" : "px-5 py-4" ].join(" ")}>
            {!sidebarCollapsed ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">Historial de análisis</div>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-text-secondary hover:bg-hover"
                    aria-label="Minimizar"
                    title="Minimizar"
                  >
                    <PanelLeft size={18} />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm font-semibold text-text-primary hover:bg-hover"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-lg border border-border bg-app">
                      <Plus size={16} />
                    </span>
                    Nuevo chat
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
                  <span className="text-text-muted">
                    <Search size={16} />
                  </span>
                  <input
                    placeholder="Buscar cuenta..."
                    className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="icon-btn h-10 w-10 rounded-xl border border-border bg-card text-text-secondary hover:bg-hover"
                  aria-label="Expandir"
                  title="Expandir"
                >
                  <PanelRight className="h-[18px] w-[18px] shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleNewChat}
                  className="icon-btn h-10 w-10 rounded-xl border border-border bg-card text-text-secondary hover:bg-hover"
                  aria-label="Nuevo chat"
                  title="Nuevo chat"
                >
                  <Plus className="h-[18px] w-[18px] shrink-0" />
                </button>
              </div>
            )}
          </div>

          {/* Lista de chats */}
          <div className="min-h-0 flex-1 overflow-auto px-2 py-3">
            {chats.map((h) => {
              const selected = h.id === activeChatId;

              if (sidebarCollapsed) {
                return (
                  <button
                    key={h.id}
                    onClick={() => setActiveChatId(h.id)}
                    className={[
                      "flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all duration-200",
                      selected
                        ? "border-brand bg-white text-text-primary"
                        : "border-border bg-white text-text-primary hover:bg-hover",
                    ].join(" ")}
                    title={`${h.companyName} • ${h.analysisType}${h.domain ? ` • ${h.domain}` : ""}`}
                    style={{ width: 64, height: 64 }}
                  >
                    <span
                      className={[
                        "inline-flex aspect-square !h-11 !w-11 items-center justify-center rounded-full",
                        "text-base font-bold text-white leading-none",
                        h.color,
                      ].join(" ")}
                      style={{ width: 44, height: 44 }}
                    >
                      {h.initial}
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={h.id}
                  className={[
                    "relative flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left shadow-sm transition",
                    selected ? "border-brand bg-card" : "border-border bg-card hover:bg-hover",
                  ].join(" ")}
                >
                  <button
                    onClick={() => setActiveChatId(h.id)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left bg-card"
                    title={`${h.companyName} • ${h.analysisType}${h.domain ? ` • ${h.domain}` : ""}`}
                    type="button"
                  >
                    <div
                      className={[
                        "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white",
                        h.color,
                      ].join(" ")}
                    >
                      {h.initial}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-text-primary">{h.companyName}</div>
                      <div className="truncate text-xs text-text-secondary">
                        {h.analysisType}
                        {h.domain ? ` • ${h.domain}` : ""}
                      </div>
                    </div>

                    <div className="text-xs text-text-muted">{formatWhen(h.whenISO)}</div>
                  </button>

                  {/* delete chat */}
                  {h.analysisStatus === "completed" ? (
                    <button
                      type="button"
                      onClick={() => deleteChat(h.id)}
                      className="ml-2 grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-text-secondary hover:bg-hover"
                      aria-label="Eliminar chat"
                      title="Eliminar chat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Chat */}
        <section className="min-w-0 flex-1 rounded-2xl border border-border bg-app shadow-sm h-full flex flex-col min-h-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white">
                <Zap size={18} />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">HPE Insight AI</div>
                  <span className="h-2 w-2 rounded-full bg-success" />
                </div>
                <div className="text-xs text-text-secondary">Asistente estratégico de cuentas</div>
              </div>
            </div>

            <button className="icon-btn h-10 w-10 rounded-xl border border-border bg-card text-text-secondary hover:bg-hover">
              <MoreHorizontal className="h-[18px] w-[18px] shrink-0" />
            </button>
          </div>

          <div className="relative flex flex-1 min-h-0 flex-col">
            {/* Scroll area */}
            <div className="min-h-0 flex-1 overflow-auto px-4 sm:px-8 py-8 pb-44">
              {!activeChat ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <h2 className="text-3xl font-semibold tracking-tight">¿Con qué cuenta quieres comenzar?</h2>
                  <p className="mt-2 text-sm text-text-secondary">Ingresa URL e industria para iniciar el análisis.</p>
                </div>
              ) : (
                <>
                  {/* Progress */}
                  {activeChat.analysisStatus === "running" ? (
                    <ProgressCard
                      title="Generando análisis"
                      progress={activeChat.analysisProgress ?? 0}
                      label={activeChat.analysisProgressLabel ?? "Analizando…"}
                    />
                  ) : null}

                  {activeChat.analysisStatus === "completed" ? (
                    <div className="mt-2 text-sm font-semibold text-text-primary">✅ Análisis completado</div>
                  ) : null}

                  {/* Recommendations */}
                  {activeChat.stage === "recommendations" ? (
                    <RecommendationsSection
                      cards={activeChat.recommendationCards}
                      onSelect={(recId) => {
                        if (!activeChatId) return;
                        selectOneRecommendation(activeChatId, recId);
                      }}
                    />
                  ) : null}

                  {/* Commercial progress */}
                  {activeChat.stage === "commercial_progress" ? (
                    <ProgressCard
                      title="Generando enfoque comercial"
                      progress={activeChat.commercialProgress ?? 0}
                      label={activeChat.commercialProgressLabel ?? "Preparando…"}
                    />
                  ) : null}

                  {/* Commercial */}
                  {activeChat.stage === "commercial" && activeChat.commercialPack ? (
                    <CommercialSection
                      pack={activeChat.commercialPack}
                      onCopySpeech={() => navigator.clipboard?.writeText(activeChat.commercialPack?.speechText ?? "")}
                      onEdit={() => {}}
                      onRegenerate={() => {}}
                      onGoInsights={() => navigate("/insights")}
                    />
                  ) : null}

                  {/* Bottom actions: show after analysis. Avoid duplicating "Buscar más insights" in commercial stage */}
                  {activeChat.analysisStatus === "completed" ? (
                    <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-[920px]">
                      {activeChat.stage !== "commercial" ? (
                        <button
                          type="button"
                          onClick={() => navigate("/insights")}
                          className="w-full sm:w-auto flex-1 rounded-2xl border border-border bg-card hover:bg-hover p-4 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-page">
                              <Search className="h-6 w-6 text-brand" />
                            </span>
                            <div>
                              <div className="text-base font-semibold text-text-primary">Buscar más insights</div>
                              <div className="text-sm text-text-secondary">Explorar oportunidades</div>
                            </div>
                          </div>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={clearActiveAnalysis}
                        className="w-full sm:w-auto rounded-2xl border border-border bg-card hover:bg-hover px-5 py-4 text-sm font-semibold text-error inline-flex items-center justify-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Borrar Análisis
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {/* Composer: only in input stage */}
            {showComposer ? (
              <div className="z-20 w-full sticky bottom-0 border-t border-border bg-app px-4 sm:px-8 py-5">
                <Composer
                  urlValue={urlInput}
                  setUrlValue={setUrlInput}
                  industryLabel={industryLabel}
                  setIndustryLabel={setIndustryLabel}
                  urlError={urlError}
                  industryError={industryError}
                  setUrlError={setUrlError}
                  setIndustryError={setIndustryError}
                  popupOpen={popupOpen}
                  setPopupOpen={setPopupOpen}
                  analysisType={analysisType}
                  setAnalysisType={setAnalysisType}
                  popupRef={popupRef}
                  plusBtnRef={plusBtnRef}
                  onSend={handleSend}
                  canSend={canSend}
                  urlRef={urlRef}
                />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ===================== UI Components ===================== */

function ProgressCard({
  title,
  progress,
  label,
}: {
  title: string;
  progress: number;
  label: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="mt-6 max-w-[920px] rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">{title}</div>
          <div className="mt-1 text-xs text-text-secondary truncate">{label}</div>
        </div>
        <div className="text-sm font-semibold text-text-primary tabular-nums">{safe}%</div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-hover border border-border">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationsSection({
  cards,
  onSelect,
}: {
  cards: RecommendationCardUI[] | undefined;
  onSelect: (recommendationId: number) => void;
}) {
  if (!cards?.length) return null;

  const priority = cards.find((c) => c.cardId === 1) ?? cards[0];
  const others = cards.filter((c) => c.id !== priority.id);

  return (
    <div className="mt-6 space-y-6">
      <PriorityRecommendationCard card={priority} onSelect={() => onSelect(priority.id)} />

      {others.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[920px]">
          {others.map((c) => (
            <SecondaryRecommendationCard key={`${c.cardId}_${c.id}`} card={c} onSelect={() => onSelect(c.id)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScoreChip({ match, confidence }: { match?: number; confidence?: number }) {
  if (typeof match !== "number" && typeof confidence !== "number") return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {typeof match === "number" ? (
        <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          {Math.round(match)}% Match
        </span>
      ) : null}
      {typeof confidence === "number" ? (
        <span className="rounded-lg bg-page border border-border px-3 py-1 text-xs font-semibold text-text-secondary">
          Conf: {confidence.toFixed(4)}
        </span>
      ) : null}
    </div>
  );
}

function PriorityRecommendationCard({
  card,
  onSelect,
}: {
  card: RecommendationCardUI;
  onSelect: () => void;
}) {
  return (
    <div data-card-id={card.cardId} className="relative rounded-2xl border-2 border-brand bg-card shadow-sm overflow-hidden max-w-[920px]">
      {/* Badge */}
      <div className="absolute right-4 top-4 z-10 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm">
        RECOMENDACIÓN PRIORITARIA
      </div>

      <div className="p-6 pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Logo / Producto */}
          <div className="flex flex-col items-center justify-center text-center border rounded-xl p-6 border-border">
            <div className="h-16 w-16 rounded-full bg-page flex items-center justify-center border border-border">
              <Zap className="h-6 w-6 text-brand" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-text-primary">{card.title}</h3>
            <div className="mt-1 text-sm text-text-secondary">ID de card: {card.cardId}</div>
            <div className="mt-4">
              <ScoreChip match={card.matchPercentage} confidence={card.confidenceScore} />
            </div>
          </div>

          {/* Necesidad */}
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Necesidad detectada</h4>
            <p className="mt-2 text-text-primary leading-relaxed break-words [overflow-wrap:anywhere]">{card.need}</p>
          </div>

          {/* Solución */}
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-brand uppercase tracking-wide">Solución específica</h4>
            <p className="mt-2 text-text-primary leading-relaxed break-words [overflow-wrap:anywhere]">
              <span className="font-semibold">{card.title}: </span>
              {card.solution}
            </p>
          </div>
        </div>

        {/* Cómo resuelve */}
        <div className="mt-6 rounded-xl border border-border bg-app p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-8 w-8 rounded-full bg-page flex items-center justify-center border border-border">
              <Check className="h-4 w-4 text-brand" />
            </div>
            <div className="min-w-0">
              <h5 className="font-semibold text-text-primary">¿CÓMO RESUELVE EL PROBLEMA?</h5>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed break-words [overflow-wrap:anywhere]">
                {card.howResolves}
              </p>
            </div>
          </div>
        </div>

        {/* Footer responsive */}
        <div className="mt-6 border-t border-border pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div className="text-sm text-brand max-w-full break-all">
              <span className="font-semibold block">{card.sourceLabel ?? "Fuente Oficial:"}</span>
              <a
                href={card.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline break-all inline-flex items-center gap-2"
              >
                {card.sourceUrl}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <button
              type="button"
              onClick={onSelect}
              className="w-full md:w-auto max-w-full whitespace-normal break-words rounded-2xl bg-brand px-6 py-3 text-white font-semibold hover:bg-brand-dark transition flex items-center justify-center gap-3"
            >
              Seleccionar esta solución <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryRecommendationCard({
  card,
  onSelect,
}: {
  card: RecommendationCardUI;
  onSelect: () => void;
}) {
  return (
    <div data-card-id={card.cardId} className="rounded-2xl border border-border bg-card shadow-sm p-6 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-page border border-border flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-brand" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-text-primary truncate">{card.title}</h3>
            <div className="mt-1 text-sm text-text-secondary">ID de card: {card.cardId}</div>
          </div>
        </div>

        <ScoreChip match={card.matchPercentage} confidence={card.confidenceScore} />
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Necesidad detectada</div>
        <p className="mt-2 text-sm text-text-primary leading-relaxed break-words [overflow-wrap:anywhere]">
          {card.need}
        </p>
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold text-brand uppercase tracking-wide">Solución</div>
        <p className="mt-2 text-sm text-text-primary leading-relaxed break-words [overflow-wrap:anywhere]">
          {card.solution}
        </p>
      </div>

      <div className="mt-5 text-xs text-brand max-w-full break-all">
        <span className="font-semibold">{card.sourceLabel ?? "Fuente Oficial:"}</span>{" "}
        <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline break-all inline-flex items-center gap-2">
          {card.sourceUrl} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-5 border-t border-border pt-4 flex items-center justify-between gap-3">
        <button type="button" className="text-xs font-semibold text-brand bg-page hover:bg-hover inline-flex items-center gap-2 rounded-xl px-3 py-2">
          VER CÓMO ENCAJA <ChevronDown className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="text-sm font-semibold bg-page hover:bg-hover rounded-xl px-3 py-2"
        >
          SELECCIONAR
        </button>
      </div>
    </div>
  );
}

/* ===================== Commercial UI ===================== */

function CommercialSection({
  pack,
  onCopySpeech,
  onEdit,
  onRegenerate,
  onGoInsights,
}: {
  pack: CommercialPack;
  onCopySpeech: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onGoInsights: () => void;
}) {
  return (
    <div className="mt-6 space-y-6 w-full">
      {/* Intro */}
      <div className="w-full max-w-[920px] rounded-2xl border border-border bg-card p-5 text-sm text-text-primary">
        Ahora que hemos seleccionado la solución estratégica más adecuada, te ayudaré a preparar un enfoque
        comercial alineado al contexto actual de la cuenta.
      </div>

      {/* Summary row (responsive) */}
      <div className="w-full max-w-[920px] overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y divide-border sm:divide-y-0 sm:divide-x">
          <SummaryCell label="EMPRESA" value={pack.companyName} />
          <SummaryCell label="PROBLEMA" value={pack.problem} editable />
          <SummaryCell label="SOLUCIÓN" value={pack.solution} editable />

          <div className="p-5">
            <div className="text-xs font-semibold text-brand uppercase tracking-wide">MATCH ESTRATÉGICO</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="text-3xl font-bold text-brand tabular-nums">{pack.strategicMatchPct}%</div>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-hover border border-border">
                <Check className="h-4 w-4 text-brand" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Enfoque comercial */}
      <div className="w-full max-w-[920px] rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-page border border-border">
            <MessageSquare className="h-5 w-5 text-brand" />
          </span>
          <h3 className="text-lg font-semibold text-text-primary">RECOMENDACIÓN DE ENFOQUE COMERCIAL</h3>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <QuadCard icon={<Send className="h-5 w-5 text-brand" />} title="CÓMO INICIAR LA CONVERSACIÓN" body={pack.howToStart} />
          <QuadCard icon={<Zap className="h-5 w-5 text-brand" />} title="TONO A UTILIZAR" body={pack.tone} />
          <QuadCard icon={<Lightbulb className="h-5 w-5 text-brand" />} title="PUNTOS A ENFATIZAR" body={pack.emphasize} />
          <QuadCard icon={<Ban className="h-5 w-5 text-error" />} title="QUÉ EVITAR" body={pack.avoid} />
        </div>
      </div>

      {/* Speech */}
      <div className="w-full max-w-[920px] rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-page border border-border">
              <MessageSquare className="h-5 w-5 text-brand" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-text-primary">SPEECH DE VENTA SUGERIDO</div>
              <div className="mt-1 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-border bg-page px-3 py-1 text-xs text-text-secondary">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-hover border border-border">
                  ✨
                </span>
                <span className="break-words">{pack.versionLabel}</span>
              </div>
            </div>
          </div>

          <button type="button" className="icon-btn h-10 w-10 rounded-xl border border-border bg-card text-text-secondary hover:bg-hover self-start" aria-label="Opciones" title="Opciones">
            <MoreHorizontal className="h-[18px] w-[18px] shrink-0" />
          </button>
        </div>

        <div className="mt-5 whitespace-pre-wrap text-sm text-text-primary leading-relaxed break-words [overflow-wrap:anywhere]">
          {pack.speechText}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-xs text-text-secondary">Word Count: {pack.speechWordCount} words</div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-page px-4 py-2 text-sm font-semibold text-text-primary hover:bg-hover"
            >
              <Pencil className="h-4 w-4" />
              EDITAR
            </button>

            <button
              type="button"
              onClick={onCopySpeech}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <Copy className="h-4 w-4" />
              COPIAR SPEECH
            </button>
          </div>
        </div>
      </div>

      {/* Strategic data */}
      <div className="w-full max-w-[920px] rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-page border border-border">
              <span className="text-brand text-xl">⛁</span>
            </span>
            <h3 className="text-lg font-semibold text-text-primary">DATOS ESTRATÉGICOS QUE SUSTENTAN EL DISCURSO</h3>
          </div>

          <button
            type="button"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-page px-4 py-2 text-sm font-semibold text-brand hover:bg-hover"
          >
            <Plus className="h-4 w-4" />
            AGREGAR DATO ESTRATÉGICO
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {pack.strategicData.map((item, idx) => (
            <StrategicDataRow key={item.id} index={idx + 1} title={item.title} subtitle={item.subtitle} />
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-brand bg-card px-6 py-3 text-sm font-semibold text-brand hover:bg-hover"
          >
            <RefreshCw className="h-4 w-4" />
            REGENERAR SPEECH CON ESTOS DATOS
          </button>
        </div>
      </div>

      {/* Go to insights button */}
      <div className="w-full max-w-[920px]">
        <button
          type="button"
          onClick={onGoInsights}
          className="w-full rounded-2xl border border-border bg-card hover:bg-hover p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-page">
              <Search className="h-6 w-6 text-brand" />
            </span>
            <div>
              <div className="text-base font-semibold text-text-primary">Buscar más insights</div>
              <div className="text-sm text-text-secondary">Explorar oportunidades</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, editable }: { label: string; value: string; editable?: boolean }) {
  return (
    <div className="p-5 min-w-0">
      <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-base font-semibold text-text-primary break-words [overflow-wrap:anywhere]">{value}</div>
      {editable ? (
        <button type="button" className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary">
          <Pencil className="h-3.5 w-3.5" />
          MODIFICAR
        </button>
      ) : null}
    </div>
  );
}

function QuadCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-app p-5 min-w-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-card border border-border shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{title}</div>
          <div className="mt-2 text-sm text-text-primary leading-relaxed break-words [overflow-wrap:anywhere]">
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategicDataRow({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-border bg-app p-4 flex items-start gap-4">
      <div className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-text-primary font-semibold">
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold text-text-primary break-words [overflow-wrap:anywhere]">{title}</div>
        <div className="mt-1 text-sm text-text-secondary break-words [overflow-wrap:anywhere]">{subtitle}</div>
      </div>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-text-secondary hover:bg-hover" aria-label="Eliminar dato" title="Eliminar dato">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ===================== Composer ===================== */

function Composer({
  urlValue,
  setUrlValue,
  industryLabel,
  setIndustryLabel,
  urlError,
  industryError,
  setUrlError,
  setIndustryError,
  popupOpen,
  setPopupOpen,
  analysisType,
  setAnalysisType,
  popupRef,
  plusBtnRef,
  onSend,
  canSend,
  urlRef,
}: {
  urlValue: string;
  setUrlValue: Dispatch<SetStateAction<string>>;
  industryLabel: string;
  setIndustryLabel: Dispatch<SetStateAction<string>>;
  urlError: string | null;
  industryError: string | null;
  setUrlError: Dispatch<SetStateAction<string | null>>;
  setIndustryError: Dispatch<SetStateAction<string | null>>;
  popupOpen: boolean;
  setPopupOpen: Dispatch<SetStateAction<boolean>>;
  analysisType: string;
  setAnalysisType: Dispatch<SetStateAction<string>>;
  popupRef: RefObject<HTMLDivElement | null>;
  plusBtnRef: RefObject<HTMLButtonElement | null>;
  onSend: () => void;
  canSend: boolean;
  urlRef: RefObject<HTMLInputElement | null>;
}) {
  const options = [
    "Análisis Completo",
    "Detectar Oportunidades",
    "Mapear Stack Actual",
    "Analizar Madurez Digital",
  ];

  return (
    <div className="relative">
      <div className="flex flex-col gap-3">
        {/* Row 1 */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3">
          <div className="relative">
            <button
              ref={plusBtnRef}
              type="button"
              onClick={() => setPopupOpen((v) => !v)}
              className="icon-btn h-10 w-10 rounded-xl border border-border bg-app text-text-secondary hover:bg-hover"
              aria-label="Opciones"
            >
              <Plus className="h-[18px] w-[18px] shrink-0" />
            </button>

            {popupOpen && (
              <div
                ref={popupRef}
                className={[
                  "absolute left-0 z-50 bottom-12",
                  "w-[min(760px,calc(100vw-32px))] sm:w-[min(760px,calc(100vw-64px))]",
                ].join(" ")}
              >
                <div className="w-full rounded-2xl border border-border bg-app p-3 shadow-xl max-h-[320px] overflow-auto">
                  <div className="px-2 pb-2 text-xs font-semibold text-text-muted">Tipo de Análisis</div>
                  <div className="space-y-2">
                    {options.map((opt) => {
                      const selected = analysisType === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setAnalysisType(opt);
                            setPopupOpen(false);
                            requestAnimationFrame(() => urlRef.current?.focus());
                          }}
                          className={[
                            "w-full rounded-xl px-4 py-3 text-left text-sm font-medium",
                            "transition-colors border",
                            selected
                              ? "bg-brand-accent text-text-primary border-brand"
                              : "bg-card text-text-primary border-border hover:bg-hover",
                            "focus:outline-none focus:ring-2 focus:ring-border",
                            "flex items-center justify-between gap-3",
                          ].join(" ")}
                        >
                          <span>{opt}</span>
                          {selected ? (
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-white">
                              <Check size={16} />
                            </span>
                          ) : (
                            <span className="h-6 w-6" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <input
            ref={urlRef}
            value={urlValue}
            onChange={(e) => {
              const next = e.target.value;
              setUrlValue(next);
              const trimmed = next.trim();
              if (!trimmed) setUrlError(null);
              else {
                const v = validateUrl(trimmed);
                setUrlError(v.ok ? null : v.error ?? "URL inválida.");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!canSend) return;
                onSend();
              }
            }}
            placeholder="URL del sitio web (obligatorio) — ej: https://empresa.com"
            className={[
              "h-10 min-w-0 flex-1 bg-transparent text-sm outline-none",
              "text-text-primary placeholder:text-text-muted",
            ].join(" ")}
          />

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className={[
              "icon-btn h-10 w-10 rounded-full text-white",
              canSend ? "bg-brand hover:bg-brand-dark" : "bg-border cursor-not-allowed",
            ].join(" ")}
            aria-label="Enviar"
          >
            <ArrowUp className="h-[18px] w-[18px] shrink-0" />
          </button>
        </div>

        {/* Row 2: Industry only */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-muted">Industria (obligatoria)</label>
          <div className="relative">
            <select
              value={industryLabel}
              onChange={(e) => {
                setIndustryLabel(e.target.value);
                setIndustryError(e.target.value ? null : "Selecciona una industria.");
              }}
              className={[
                "h-11 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-10 text-sm outline-none",
                "text-text-primary",
                industryError ? "border-error" : "focus:border-brand",
              ].join(" ")}
            >
              <option value="">Selecciona la industria</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>

            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
              <ChevronDown size={18} />
            </span>
          </div>
        </div>

        {/* Errors */}
        {urlValue.trim().length > 0 && urlError && (
          <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">URL inválida:</span> {urlError}
          </div>
        )}

        {industryError && (
          <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Industria inválida:</span> {industryError}
          </div>
        )}

        <div className="flex items-center justify-between px-1 text-xs text-text-secondary">
          <span>
            Selección actual: <span className="font-semibold text-text-primary">{analysisType}</span>
          </span>

          <span className="inline-flex items-center gap-1">
            <Zap size={14} /> Insight AI
          </span>
        </div>
      </div>
    </div>
  );
}
