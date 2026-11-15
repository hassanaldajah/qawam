import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, Plus, Dumbbell, TrendingUp, Menu } from "lucide-react";

export const TABS = [
  { to: "/", key: "today", Icon: Home, end: true },
  { to: "/log", key: "log", Icon: Plus, end: false },
  { to: "/workouts", key: "workouts", Icon: Dumbbell, end: false },
  { to: "/progress", key: "progress", Icon: TrendingUp, end: false },
  { to: "/more", key: "more", Icon: Menu, end: false },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("nav.label")} className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto m-0 flex h-14 max-w-md list-none p-0">
        {TABS.map(({ to, key, Icon, end }) => (
          <li key={key} className="flex-1">
            <NavLink to={to} end={end} aria-label={t(`nav.${key}`)}
              className={({ isActive }) =>
                `relative flex h-full min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 text-xs font-bold no-underline text-fg`}>
              {({ isActive }) => (
                <>
                  {key === "log" ? (
                    <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full cta">
                      <Icon size={20} strokeWidth={isActive ? 3 : 2} />
                    </span>
                  ) : (
                    <span aria-hidden="true" className={`flex h-8 w-14 items-center justify-center rounded-full ${isActive ? "pill-active" : ""}`}><Icon size={24} strokeWidth={isActive ? 3 : 2} /></span>
                  )}
                  <span>{t(`nav.${key}`)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
