import { useId } from "react";
import { MARK_W, MARK_H, BASE_D, FRONT_D, BACK_D } from "./markPaths";

/** The Qawam logo, rebuilt from the owner's artwork (scripts/build-mark.py).
 *  Only the runner's two legs move, in place: the rest of the mark never changes.
 *  motion: "run" = always, "hover" = while the parent link/button is hovered or focused, "none" = still. */
export function QawamMark({ width = 120, motion = "run", className = "", label }:
  { width?: number | string; motion?: "run" | "hover" | "none"; className?: string; label?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const art = "/brand/qawam-mark.webp";
  const img = (clip: string) => <image href={art} width={MARK_W} height={MARK_H} clipPath={`url(#${clip})`} />;
  return (
    <svg className={`qm qm-${motion} ${className}`} viewBox={`0 0 ${MARK_W} ${MARK_H}`} width={width}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <defs>
        <clipPath id={`${id}b`}><path d={BASE_D} clipRule="evenodd" /></clipPath>
        <clipPath id={`${id}f`}><path d={FRONT_D} /></clipPath>
        <clipPath id={`${id}k`}><path d={BACK_D} /></clipPath>
      </defs>
      <g className="qm-leg qm-back">{img(`${id}k`)}</g>
      {img(`${id}b`)}
      <g className="qm-leg qm-front">{img(`${id}f`)}</g>
    </svg>
  );
}
