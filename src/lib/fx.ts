// Micro-interactions without libraries: reveal on scroll (IntersectionObserver + element.animate),
// pointer/finger tilt, dot cursor (fine pointers only). All respect prefers-reduced-motion.
// CSSOM only (el.style.setProperty / element.animate): allowed by our CSP (no style attributes in HTML).
import { useEffect, type RefObject } from "react";

import { dbg } from "./debug";
export const reducedMotion = () => dbg("static") || typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Reveal every [data-reveal] inside root once, staggered. Above-the-fold items are never hidden
 *  (they only play an entrance), so content is visible even if animations never run. */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === "undefined" || !("animate" in el)) return;
    const frames: Keyframe[] = [{ opacity: 0, transform: "translateY(24px) scale(.98)" }, { opacity: 1, transform: "none" }];
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    const fold = window.innerHeight;
    const later: HTMLElement[] = [];
    nodes.forEach((n) => {
      const delay = Number(n.dataset.reveal || 0) * 90;
      if (n.getBoundingClientRect().top < fold) n.animate(frames, { duration: 700, delay, easing: "cubic-bezier(.2,0,0,1)", fill: "backwards" });
      else { n.style.opacity = "0"; later.push(n); }
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const t = e.target as HTMLElement;
        io.unobserve(t);
        const a = t.animate(frames, { duration: 650, delay: Number(t.dataset.reveal || 0) * 80, easing: "cubic-bezier(.2,0,0,1)", fill: "backwards" });
        t.style.opacity = "";
        void a;
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    later.forEach((n) => io.observe(n));
    return () => { io.disconnect(); later.forEach((n) => { n.style.opacity = ""; }); };
  }, [root]);
}

/** Tilt elements with class .tilt inside root on mouse hover and on finger drag. */
export function useTilt(root: RefObject<HTMLElement | null>, max = 10) {
  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(".tilt"));
    const offs = items.map((n) => {
      let down = false;
      const move = (e: PointerEvent) => {
        if (e.pointerType !== "mouse" && !down) return;
        const r = n.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        n.classList.add("tilting");
        n.style.setProperty("--ry", `${(x * max).toFixed(2)}deg`);
        n.style.setProperty("--rx", `${(-y * max).toFixed(2)}deg`);
      };
      const reset = () => { down = false; n.classList.remove("tilting"); n.style.setProperty("--rx", "0deg"); n.style.setProperty("--ry", "0deg"); };
      const start = (e: PointerEvent) => { if (e.pointerType !== "mouse") { down = true; move(e); } };
      n.addEventListener("pointermove", move);
      n.addEventListener("pointerdown", start);
      n.addEventListener("pointerleave", reset);
      n.addEventListener("pointerup", reset);
      n.addEventListener("pointercancel", reset);
      return () => { n.removeEventListener("pointermove", move); n.removeEventListener("pointerdown", start); n.removeEventListener("pointerleave", reset); n.removeEventListener("pointerup", reset); n.removeEventListener("pointercancel", reset); };
    });
    return () => offs.forEach((f) => f());
  }, [root, max]);
}

