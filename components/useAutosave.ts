"use client";
import { useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "dirty" | "saving" | "error";

/** Debounced save of `value` whenever it changes after the first load. Flushes on page hide. */
export function useAutosave<T>(value: T | null, save: (v: T) => Promise<void>, delay = 900) {
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);
  const pending = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const v = pending.current;
    if (v === null) return;
    pending.current = null;
    setState("saving");
    try {
      await saveRef.current(v);
      setError(null);
      setState(pending.current ? "dirty" : "saved");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
      pending.current ??= v;
    }
  };

  useEffect(() => {
    if (value === null) return;
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = value;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onHide = () => {
      if (pending.current !== null) void flush();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (pending.current !== null) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = state === "saved" ? "SAVED" : state === "saving" ? "SAVING…" : state === "dirty" ? "EDITING…" : `NOT SAVED: ${error}`;
  return { state, label, flush };
}
