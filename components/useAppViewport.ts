"use client";
import { useEffect, useState, type RefObject } from "react";

/**
 * On phones the editors fill the screen like an app. The visual viewport shrinks when the on-screen keyboard opens
 * (iOS keeps the layout viewport and slides the page), so the editor follows it through --vvh / --vvt and the field
 * being typed in stays above the keyboard. Desktop CSS ignores both variables.
 */
export function useAppViewport(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    const sync = () => {
      el.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
      el.style.setProperty("--vvt", `${Math.round(vv.offsetTop)}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [ref]);
}

/**
 * Drawing units per screen pixel for an SVG, so handles and hit areas can stay about a finger wide (44px) however
 * small the page is drawn.
 */
export function useUnitsPerPx(ref: RefObject<SVGSVGElement | null>, viewWidth: number, ready: unknown) {
  const [upp, setUpp] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setUpp(viewWidth / w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, viewWidth, ready]);
  return upp;
}

/** True when the primary pointer is a finger. */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const on = () => setCoarse(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return coarse;
}

/**
 * Canvases already set touch-action: none, but Chrome still runs its scroll gesture on a quick drag and treats the
 * lift as a fling, which can swallow the next tap on a button. Cancelling touchmove stops the gesture at the source.
 */
export function useCanvasTouch(ref: RefObject<Element | null>, ready: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, [ref, ready]);
}
