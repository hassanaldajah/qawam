import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { House, Plus, Dumbbell, TrendingUp, LayoutGrid } from "lucide-react";

export const TABS = [
  { to: "/", key: "today", Icon: House, end: true },
  { to: "/log", key: "log", Icon: Plus, end: false },
  { to: "/workouts", key: "workouts", Icon: Dumbbell, end: false },
  { to: "/progress", key: "progress", Icon: TrendingUp, end: false },
  { to: "/more", key: "more", Icon: LayoutGrid, end: false },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("nav.label")} className="tabbar">
      <ul>
        {TABS.map(({ to, key, Icon, end }) => (
          <li key={key}>
            <NavLink to={to} end={end} className={`tab ${key === "log" ? "tab-fab" : ""}`}>
              {({ isActive }) => (
                <>
                  <span aria-hidden="true" className="ico"><Icon size={key === "log" ? 24 : 22} strokeWidth={isActive ? 2.6 : 2} /></span>
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
