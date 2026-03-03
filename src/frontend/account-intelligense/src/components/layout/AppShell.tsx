import React, { useEffect, useMemo, useState } from "react";
import {
    Menu,
    Search,
    Sun,
    Moon,
    Bell,
    Settings,
    LayoutGrid,
    Lightbulb,
    Rotate3d,
    Mail,
    User,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuth } from "../../services/api";

import logoDark from "../../assets/brand/HPE_logoWhite.png";
import logoLight from "../../assets/brand/logo_HPE.png";

type NavItem = {
    key: string;
    label: string;
    icon: React.ReactNode;
    to: string;
    active?: boolean;
};

const nav: NavItem[] = [
    { key: "daily", label: "Análisis Diario", icon: <GridIcon />, to: "/daily" },
    { key: "profile360", label: "Perfil de Cuenta 360°", icon: <Circle360Icon />, to: "/account-360" },
    { key: "insights", label: "Insights", icon: <BulbIcon />, to: "/insights" },
];

const settingsNav: NavItem[] = [
    { key: "config", label: "Configuración", icon: <GearIcon />, to: "/configuracion" },
    { key: "profile", label: "Mi Perfil", icon: <UserIcon />, to: "/perfil" },
];

type AppShellProps = {
    children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const root = document.documentElement;
        setIsDark(root.classList.contains("dark"));
    }, []);

    const toggleTheme = () => {
        const root = document.documentElement;
        root.classList.toggle("dark");
        setIsDark(root.classList.contains("dark"));
    };

    // highlight automático por URL
    const computedNav = useMemo(() => {
        return nav.map((i) => ({ ...i, active: location.pathname === i.to }));
    }, [location.pathname]);

    const computedSettings = useMemo(() => {
        return settingsNav.map((i) => ({ ...i, active: location.pathname === i.to }));
    }, [location.pathname]);

    return (
        <div className="min-h-dvh bg-page text-text-primary">
            {/* Overlay mobile */}
            {mobileOpen && (
                <button
                    aria-label="Cerrar menú"
                    className="fixed inset-0 z-40 bg-black/30 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <div className="flex min-h-dvh">
                {/* Sidebar Desktop */}
                <aside className="hidden lg:flex fixed left-0 top-0 z-50 h-dvh w-72 flex-col border-r border-border bg-app overflow-hidden">
                    <Sidebar navItems={computedNav} settingsItems={computedSettings} onClose={undefined} isDark={isDark} />
                </aside>

                {/* Sidebar Mobile */}
                <aside
                    className={[
                        "lg:hidden fixed left-0 top-0 z-50 h-dvh w-72 border-r border-border bg-app overflow-hidden",
                        "transition-all duration-300 ease-out",
                        mobileOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0",
                    ].join(" ")}
                >
                    <Sidebar
                        navItems={computedNav}
                        settingsItems={computedSettings}
                        onClose={() => setMobileOpen(false)}
                        isDark={isDark}
                    />
                </aside>

                {/* CONTENT */}
                <div className="flex-1 lg:pl-72">
                    <div className="h-dvh overflow-y-auto">
                        {/* Topbar */}
                        <div className="sticky top-0 z-30 bg-page/90 backdrop-blur">
                            <div className="flex w-full items-center gap-3 px-4 py-4 lg:px-8">
                                <button
                                    className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-app text-text-secondary lg:hidden"
                                    onClick={() => setMobileOpen(true)}
                                    aria-label="Abrir menú"
                                >
                                    <HamburgerIcon />
                                </button>

                                <div className="flex-1">
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                                            <SearchIcon />
                                        </span>
                                        <input
                                            className="h-11 w-full rounded-2xl border border-border bg-app pl-11 pr-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                                            placeholder="Buscar..."
                                        />
                                    </div>
                                </div>

                                <div className="hidden items-center gap-2 sm:flex">
                                    <IconButton title={isDark ? "Modo Light" : "Modo Dark"} onClick={toggleTheme}>
                                        <ThemeIcon isDark={isDark} />
                                    </IconButton>

                                    <IconButton title="Notificaciones">
                                        <BellIcon />
                                    </IconButton>
                                </div>
                            </div>
                        </div>

                        {/* Page content */}
                        <main className="w-full px-4 pb-10 pt-2 lg:px-8">
                            <div className="mx-auto w-full max-w-[1680px]">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={location.pathname}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.18, ease: "easeOut" }}
                                    >
                                        {children}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------------- Sidebar ---------------- */

function Sidebar({
    onClose,
    navItems,
    settingsItems,
    isDark,
}: {
    onClose?: () => void;
    navItems: NavItem[];
    settingsItems: NavItem[];
    isDark: boolean;
}) {
    const [profileOpen, setProfileOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="flex h-full flex-col">
            <div className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-4xl font-black tracking-tight">
                            <img
                                src={isDark ? logoDark : logoLight}
                                alt="HPE Logo"
                                className="h-10 w-auto transition-all duration-300"
                            />
                        </div>
                        <div className="mt-1 text-xs font-semibold text-text-secondary">Account Intelligence</div>
                    </div>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="mt-1 grid h-10 w-10 place-items-center rounded-xl border border-border bg-app text-text-secondary lg:hidden"
                            aria-label="Cerrar menú"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            <div className="px-4">
                <div className="text-[11px] font-semibold text-text-muted">DASHBOARD</div>
                <nav className="mt-3 space-y-1">
                    {navItems.map((i) => (
                        <SideItem key={i.key} label={i.label} icon={i.icon} active={i.active} to={i.to} />
                    ))}
                </nav>
            </div>

            <div className="mt-auto px-4 pb-6">
                <div className="mt-10 text-[11px] font-semibold text-text-muted">CONFIGURACIONES</div>

                <nav className="mt-3 space-y-1">
                    {settingsItems.map((i) => {
                        if (i.key === "profile") {
                            return (
                                <div key={i.key} className="relative">
                                    <button
                                        onClick={() => setProfileOpen((v) => !v)}
                                        type="button"
                                        className={[
                                            "group relative w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium",
                                            "transition-all duration-300 ease-out",
                                            i.active
                                                ? "bg-secondaryBtn text-text-primary border border-border"
                                                : "bg-app text-text-secondary hover:bg-hover hover:text-text-primary",
                                        ].join(" ")}
                                    >
                                        <span
                                            className={[
                                                "grid h-10 w-10 place-items-center rounded-2xl border transition-all duration-300",
                                                i.active
                                                    ? "border-border bg-card text-text-primary"
                                                    : "border-border bg-card text-text-secondary group-hover:text-text-primary",
                                            ].join(" ")}
                                        >
                                            {i.icon}
                                        </span>

                                        <span className="truncate">{i.label}</span>

                                        <span
                                            className={[
                                                "ml-auto transition-transform duration-300 text-text-muted",
                                                profileOpen ? "rotate-90" : "rotate-0",
                                            ].join(" ")}
                                        >
                                            ▸
                                        </span>
                                    </button>

                                    {/* Dropdown */}
                                    <div
                                        className={[
                                            "overflow-hidden transition-all duration-300 ease-out",
                                            profileOpen ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0",
                                        ].join(" ")}
                                    >
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await fetchWithAuth("/auth/logout", { method: "POST" });
                                                } catch (err) {
                                                    // ignore or log
                                                } finally {
                                                    localStorage.removeItem("access_token");
                                                    localStorage.removeItem("refresh_token");
                                                    navigate("/login", { replace: true });
                                                }
                                            }}
                                            className="ml-14 mt-1 w-[calc(100%-3.5rem)] rounded-xl px-3 py-2 text-left text-sm font-medium border border-border bg-card text-error hover:bg-hover transition-all duration-200"
                                        >
                                            Cerrar sesión
                                        </button>
                                    </div>
                                </div>
                            );
                        }

                        return <SideItem key={i.key} label={i.label} icon={i.icon} active={i.active} to={i.to} />;
                    })}
                </nav>
            </div>
        </div>
    );
}

function SideItem({
    icon,
    label,
    active,
    to,
}: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    to: string;
}) {
    return (
        <Link
            to={to}
            className={[
                "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium",
                "no-underline outline-none focus:outline-none select-none",
                "transition-all duration-300 ease-out active:scale-[0.99]",
                active
                    ? "bg-brand/10 text-text-primary ring-1 ring-brand/30 shadow-sm"
                    : "text-text-secondary hover:bg-hover hover:text-text-primary",
            ].join(" ")}
        >
            {/* Active indicator bar */}
            <span
                aria-hidden="true"
                className={[
                    "absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full",
                    "transition-all duration-300 ease-out",
                    active ? "bg-brand opacity-100 translate-x-0" : "bg-brand opacity-0 -translate-x-1",
                ].join(" ")}
            />

            {/* subtle glow on active */}
            <span
                aria-hidden="true"
                className={[
                    "pointer-events-none absolute inset-0 rounded-2xl",
                    "transition-opacity duration-300 ease-out",
                    active ? "opacity-100" : "opacity-0",
                ].join(" ")}
                style={{
                    boxShadow: active ? "0 10px 30px rgba(0,0,0,0.06)" : undefined,
                }}
            />

            {/* Icon container */}
            <span
                className={[
                    "relative grid h-10 w-10 place-items-center rounded-2xl border",
                    "transition-all duration-300 ease-out group-hover:scale-[1.02]",
                    active
                        ? "border-brand/40 bg-brand/10 text-brand"
                        : "border-border bg-card text-text-secondary group-hover:text-text-primary",
                ].join(" ")}
            >
                {icon}
            </span>

            {/* Label */}
            <span className="relative truncate">{label}</span>

            {/* subtle arrow on hover */}
            <span
                aria-hidden="true"
                className={[
                    "ml-auto hidden lg:inline text-text-muted",
                    "transition-all duration-300 ease-out",
                    active ? "opacity-0" : "opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-1",
                ].join(" ")}
            >
                →
            </span>
        </Link>
    );
}

/* ---------------- UI components ---------------- */

function IconButton({
    children,
    title,
    onClick,
}: {
    children: React.ReactNode;
    title: string;
    onClick?: () => void;
}) {
    return (
        <button
            title={title}
            onClick={onClick}
            className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-app text-text-secondary hover:bg-hover active:translate-y-px"
        >
            {children}
        </button>
    );
}

/* ---------------- Icons (lucide-react) ---------------- */

function HamburgerIcon() {
    return <Menu size={20} />;
}

function SearchIcon() {
    return <Search size={18} />;
}

function ThemeIcon({ isDark }: { isDark: boolean }) {
    return isDark ? <Sun size={18} /> : <Moon size={18} />;
}

function BellIcon() {
    return <Bell size={18} />;
}

function GearIcon() {
    return <Settings size={18} />;
}

function GridIcon() {
    return <LayoutGrid size={18} className="text-text-secondary" />;
}

function BulbIcon() {
    return <Lightbulb size={18} className="text-text-secondary" />;
}

function Circle360Icon() {
    return <Rotate3d size={18} className="text-text-secondary" />;
}

function UserIcon() {
    return <User size={18} className="text-text-secondary" />;
}
