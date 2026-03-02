import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import AppShell from "../../components/layout/AppShell";
import { fetchWithAuth } from "../../services/api";
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
} from "lucide-react";

/* ===================== TYPES ===================== */

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tsISO: string;
};

type ChatItem = {
  id: string;
  companyName: string;
  domain: string;
  whenISO: string; // última actividad
  initial: string;
  color: string;
  analysisType: string;
  source: "main" | "additional";
  url?: string;
  companyNameExtra?: string;
  industry?: string;
  messages: Message[];
};

type InputSource = "main" | "additional" | null;

/* ===================== HELPERS ===================== */

function uid() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`) as string;
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

function extractCompanyFromUrl(normalizedUrl: string) {
  const u = new URL(normalizedUrl);
  const host = u.hostname.replace(/^www\./i, "");
  const first = host.split(".")[0] || host;

  const pretty = first.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  return { companyName: pretty, domain: host };
}

function truncateIfUrl(text: string, max = 90) {
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

/* ===================== MAIN ===================== */

export default function AccountProfile() {
  const [query, setQuery] = useState("");
  const [popupOpen, setPopupOpen] = useState(false);
  const [analysisType, setAnalysisType] = useState("Análisis Completo");

  // ✅ Info adicional
  const [extraCompanyName, setExtraCompanyName] = useState("");
  const [extraIndustry, setExtraIndustry] = useState("");

  // ✅ Exclusividad (pero con switch)
  const [inputSource, setInputSource] = useState<InputSource>(null);

  // ✅ Error del campo principal (URL)
  const [urlError, setUrlError] = useState<string | null>(null);

  // ✅ Minimizar sidebar
  const SIDEBAR_KEY = "hpe_profile360_sidebar_collapsed_v2";
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
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  useEffect(() => {
    async function loadChats() {
      try {
        const res = await fetchWithAuth("/analysis/");
        if (res.ok) {
          const data = await res.json();
          // Transform backend AnalysisListItem to frontend ChatItem
          const transformed: ChatItem[] = data.map((a: any) => ({
            id: a.analysis_id.toString(),
            companyName: a.company_name,
            domain: "",
            whenISO: new Date().toISOString(), // The backend doesn't return created_at in ListItem yet, but we can assume fresh
            initial: (a.company_name[0] || "?").toUpperCase(),
            color: pickColorFromString(a.company_name),
            analysisType: "Análisis Completo",
            source: "main",
            messages: [
              {
                id: "welcome",
                role: "assistant",
                text: `Análisis de ${a.company_name} - Estado: ${a.status}.${a.strategic_score ? ` Score Estratégico: ${a.strategic_score}%` : ""}`,
                tsISO: new Date().toISOString()
              }
            ]
          }));
          setChats(transformed);
        }
      } catch (err) {
        console.error("Error loading chats:", err);
      } finally {
        setLoadingChats(false);
      }
    }
    loadChats();
  }, []);

  // No-op for persistence since we use backend
  useEffect(() => { }, [chats]);
  useEffect(() => { }, [activeChatId]);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const companyRef = useRef<HTMLInputElement | null>(null);

  const composerDocked = !!activeChatId;

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

  useEffect(() => {
    if (composerDocked) requestAnimationFrame(() => inputRef.current?.focus());
  }, [composerDocked]);

  function pushMessage(chatId: string, msg: Message) {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
            ...c,
            whenISO: new Date().toISOString(),
            messages: [...c.messages, msg],
          }
          : c
      )
    );
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
      source: "main",
      messages: [],
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(chatId);

    setQuery("");
    setExtraCompanyName("");
    setExtraIndustry("");
    setInputSource(null);
    setUrlError(null);
    setPopupOpen(false);

    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSend = async () => {
    const source: "main" | "additional" | null =
      inputSource ?? (mainValue ? "main" : additionalHasValue ? "additional" : null);

    if (!source) return;

    const industryMap: Record<string, number> = {
      "retail": 1,
      "finanzas": 2,
      "financial": 2,
      "manufactura": 3,
      "manufacturing": 3,
      "salud": 4,
      "healthcare": 4,
      "telecomunicaciones": 5,
      "telecom": 5,
      "energia": 6,
      "energy": 6
    };

    let companyName = "";
    let industryName = "";
    let url = "";

    if (source === "main") {
      const v = validateUrl(mainValue);
      if (!v.ok) {
        setUrlError(v.error ?? "URL inválida.");
        return;
      }
      const normalized = v.normalized!;
      const info = extractCompanyFromUrl(normalized);
      companyName = info.companyName;
      url = normalized;
    } else {
      companyName = extraCompanyName.trim() || "Sin nombre";
      industryName = extraIndustry.trim().toLowerCase();
    }

    const industryId = industryMap[industryName] || 1;

    try {
      const res = await fetchWithAuth("/analysis/", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          industry_id: industryId,
          website_url: url || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        const newId = data.analysis_id.toString();

        const newChat: ChatItem = {
          id: newId,
          companyName,
          domain: url || "",
          whenISO: new Date().toISOString(),
          initial: (companyName[0] || "?").toUpperCase(),
          color: pickColorFromString(companyName),
          analysisType,
          source,
          messages: [
            {
              id: uid(),
              role: "user",
              text: url || companyName,
              tsISO: new Date().toISOString()
            },
            {
              id: uid(),
              role: "assistant",
              text: `Análisis iniciado para ${companyName}. Procesando señales estratégicas...`,
              tsISO: new Date().toISOString()
            }
          ]
        };

        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newId);
        setQuery("");
        setExtraCompanyName("");
        setExtraIndustry("");
        setInputSource(null);
        setPopupOpen(false);
        setUrlError(null);
      } else {
        const errData = await res.json();
        setUrlError(errData.detail || "Error al iniciar el análisis.");
      }
    } catch (err) {
      console.error("Error creating analysis:", err);
      setUrlError("Error de conexión.");
    }
  };

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
          <div
            className={[
              "border-b border-border",
              sidebarCollapsed ? "px-2 py-3" : "px-5 py-4",
            ].join(" ")}
          >
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
                      "mx-auto mb-3 inline-flex aspect-square",
                      "!h-16 !w-16 items-center justify-center rounded-full border transition overflow-hidden",
                      selected
                        ? "border-brand bg-brand-accent"
                        : "border-border bg-card hover:bg-hover",
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
                <button
                  key={h.id}
                  onClick={() => setActiveChatId(h.id)}
                  className={[
                    "flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left shadow-sm transition",
                    selected
                      ? "border-brand bg-brand-accent"
                      : "border-border bg-card hover:bg-hover",
                  ].join(" ")}
                  title={`${h.companyName} • ${h.analysisType}${h.domain ? ` • ${h.domain}` : ""}`}
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
            <div className="min-h-0 flex-1 overflow-auto px-8 py-8 pb-44">
              {!activeChat ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <h2 className="text-3xl font-semibold tracking-tight">¿Con qué cuenta quieres comenzar?</h2>
                </div>
              ) : activeChat.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <h2 className="text-2xl font-semibold tracking-tight">Nuevo chat</h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    Ingresa una URL válida o usa “Información adicional” para iniciar el análisis.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeChat.messages.map((m) =>
                    m.role === "assistant" ? (
                      <AssistantBubble key={m.id} text={m.text} />
                    ) : (
                      <UserBubble key={m.id} text={m.text} />
                    )
                  )}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="z-20 w-full sticky bottom-0 border-t border-border bg-app px-8 py-5">
              <div className="w-full">
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
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ---------- UI helpers ---------- */

function AssistantBubble({ text }: { text: string }) {
  return (
    <div
      className={[
        "max-w-[760px] rounded-2xl bg-card px-4 py-3 text-sm text-text-primary border border-border",
        "whitespace-pre-wrap break-words overflow-hidden",
        "[overflow-wrap:anywhere] [word-break:break-word]",
      ].join(" ")}
    >
      {text}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  const shown = truncateIfUrl(text, 110);

  return (
    <div className="flex w-full justify-end">
      <div
        className={[
          "max-w-[760px] rounded-2xl bg-brand-accent px-4 py-3 text-sm text-text-primary border border-border",
          "whitespace-pre-wrap break-words overflow-hidden",
          "[overflow-wrap:anywhere] [word-break:break-word]",
        ].join(" ")}
        title={text} // ✅ hover para ver completa
      >
        {shown}
      </div>
    </div>
  );
}

function Composer({
  mode,
  query,
  setQuery,
  popupOpen,
  setPopupOpen,
  analysisType,
  setAnalysisType,
  popupRef,
  plusBtnRef,
  onSend,
  inputRef,
  companyRef,
  extraCompanyName,
  setExtraCompanyName,
  extraIndustry,
  setExtraIndustry,
  inputSource,
  setInputSource,
  mainLocked,
  additionalLocked,
  canSend,
  switchToMain,
  switchToAdditional,
  resetSource,
  urlError,
  setUrlError,
}: {
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
}) {
  const options = [
    "Análisis Completo",
    "Detectar Oportunidades",
    "Mapear Stack Actual",
    "Analizar Madurez Digital",
  ];

  const industries = [
    "Tecnología",
    "Finanzas",
    "Retail",
    "Manufactura",
    "Logística",
    "Salud",
    "Educación",
    "Gobierno",
    "E-commerce",
  ];

  const openUp = mode === "bottom";
  const isQueryEmpty = query.trim().length === 0;

  return (
    <div className="relative">
      <div
        className={[
          "flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3",
          mode === "center" ? "shadow-sm" : "",
        ].join(" ")}
      >
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
                "absolute left-0 z-50",
                "w-[min(760px,calc(100vw-32px))] sm:w-[min(760px,calc(100vw-64px))]",
                "grid grid-cols-1 sm:grid-cols-[260px_minmax(0,1fr)] gap-3 sm:gap-4",
                openUp ? "bottom-12" : "top-12",
              ].join(" ")}
            >
              {/* Popup 1: Tipo de análisis */}
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
                          requestAnimationFrame(() => inputRef.current?.focus());
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

              {/* Popup 2: Información adicional */}
              {isQueryEmpty && (
                <div className="w-full rounded-2xl border border-border bg-app p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text-primary">Información Adicional:</div>

                    {additionalLocked && (
                      <button
                        type="button"
                        onClick={switchToAdditional}
                        className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-primary hover:bg-hover"
                      >
                        Cambiar aquí
                      </button>
                    )}
                  </div>

                  {additionalLocked && (
                    <div className="mb-3 rounded-xl border border-border bg-card p-3 text-xs text-text-secondary">
                      Estás usando el <span className="font-semibold text-text-primary">campo principal</span>. Haz clic en{" "}
                      <span className="font-semibold text-text-primary">“Cambiar aquí”</span>.
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-text-muted">Empresa (opcional)</label>
                      <input
                        ref={companyRef}
                        value={extraCompanyName}
                        disabled={additionalLocked}
                        onChange={(e) => {
                          if (additionalLocked) return;
                          setInputSource("additional");
                          setExtraCompanyName(e.target.value);
                          setQuery("");
                        }}
                        placeholder={
                          additionalLocked
                            ? "Bloqueado: estás usando el campo principal"
                            : "Ingresa el nombre de la empresa a analizar..."
                        }
                        className={[
                          "h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm outline-none",
                          "text-text-primary placeholder:text-text-muted",
                          additionalLocked ? "opacity-60 cursor-not-allowed" : "focus:border-brand",
                        ].join(" ")}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-text-muted">Industria (opcional)</label>
                      <div className="relative">
                        <select
                          value={extraIndustry}
                          disabled={additionalLocked}
                          onChange={(e) => {
                            if (additionalLocked) return;
                            setInputSource("additional");
                            setExtraIndustry(e.target.value);
                            setQuery("");
                          }}
                          className={[
                            "h-11 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-10 text-sm outline-none",
                            "text-text-primary",
                            additionalLocked ? "opacity-60 cursor-not-allowed" : "focus:border-brand",
                          ].join(" ")}
                        >
                          <option value="">Selecciona la Industria</option>
                          {industries.map((i) => (
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

                    <div className="text-xs text-text-muted">
                      * Este panel solo aparece si aún no has escrito una URL en el campo principal.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {mainLocked && (
          <button
            type="button"
            onClick={switchToMain}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-text-primary hover:bg-hover"
          >
            Cambiar a campo principal
          </button>
        )}

        <input
          ref={inputRef}
          value={query}
          disabled={mainLocked}
          onChange={(e) => {
            if (mainLocked) return;

            const next = e.target.value;
            setInputSource("main");
            setQuery(next);
            setExtraCompanyName("");
            setExtraIndustry("");

            const trimmed = next.trim();
            if (!trimmed) {
              setUrlError(null);
            } else {
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
          placeholder={
            mainLocked
              ? "Bloqueado: estás usando Información Adicional"
              : "Ingresa la URL o nombre de la empresa a analizar..."
          }
          className={[
            "h-10 min-w-0 flex-1 bg-transparent text-sm outline-none",
            "text-text-primary placeholder:text-text-muted",
            mainLocked ? "opacity-60 cursor-not-allowed" : "",
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

      {!mainLocked && query.trim().length > 0 && urlError && (
        <div className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">URL inválida:</span> {urlError}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between px-1 text-xs text-text-secondary">
        <span>
          Selección actual: <span className="font-semibold text-text-primary">{analysisType}</span>
        </span>

        <span className="inline-flex items-center gap-2 text-text-secondary">
          {inputSource ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-[11px]">
              <span>Usando: {inputSource === "main" ? "Campo principal" : "Info adicional"}</span>
              <button
                type="button"
                onClick={resetSource}
                className="rounded-full border border-border bg-app px-2 py-0.5 font-semibold hover:bg-hover"
                title="Desbloquear ambos"
              >
                Reset
              </button>
            </span>
          ) : (
            <span className="rounded-full border border-border bg-card px-2 py-1 text-[11px]">
              Usando: Auto
            </span>
          )}

          <span className="inline-flex items-center gap-1">
            <Zap size={14} /> Insight AI
          </span>
        </span>
      </div>
    </div>
  );
}

