"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveResult } from "../schema";

export const AUTOSAVE_MS = 20_000;

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

/**
 * Autosave + manual save for Studio editors. The server compares `updated_at` (optimistic lock),
 * so a stale tab can never silently overwrite a newer version: on conflict autosave stops and
 * the user must reload. Edits made while a save is in flight keep the form dirty.
 */
export function useAutosave({
  formRef,
  initialUpdatedAt,
  save,
  enabled,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  initialUpdatedAt: string;
  save: (expectedUpdatedAt: string, formData: FormData, makeRevision: boolean) => Promise<SaveResult>;
  enabled: boolean;
}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const updatedAt = useRef(initialUpdatedAt);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const inFlight = useRef(false);
  const conflict = useRef(false);

  const markDirty = useCallback(() => {
    version.current += 1;
    if (!conflict.current) setStatus((s) => (s === "saving" ? s : "dirty"));
  }, []);

  const saveNow = useCallback(
    async (makeRevision: boolean): Promise<boolean> => {
      const form = formRef.current;
      if (!form || inFlight.current || conflict.current) return false;
      inFlight.current = true;
      const v = version.current;
      setStatus("saving");
      try {
        const res = await save(updatedAt.current, new FormData(form), makeRevision);
        if (res.ok) {
          updatedAt.current = res.updatedAt;
          savedVersion.current = v;
          setSavedAt(new Date());
          setMessage(null);
          setField(null);
          setStatus(version.current === v ? "saved" : "dirty");
          return true;
        }
        if (res.conflict) conflict.current = true;
        setStatus(res.conflict ? "conflict" : "error");
        setMessage(res.error);
        setField(res.field ?? null);
        return false;
      } catch {
        setStatus("error");
        setMessage("Can't reach the server. Will retry.");
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [formRef, save],
  );

  const isDirty = () => version.current !== savedVersion.current;

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      if (version.current !== savedVersion.current && !conflict.current) void saveNow(false);
    }, AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [enabled, saveNow]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (version.current !== savedVersion.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return { status, message, field, savedAt, markDirty, saveNow, isDirty };
}

export function SaveIndicator({ status, message, savedAt }: { status: SaveStatus; message: string | null; savedAt: Date | null }) {
  const label = {
    saved: savedAt ? `Saved · ${savedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}` : "Saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    error: "Not saved",
    conflict: "Conflict",
  }[status];
  const tone = status === "saved" ? "text-emerald-700" : status === "saving" ? "text-muted" : status === "dirty" ? "text-amber-800" : "text-accent-700";
  return (
    <div role="status" aria-live="polite" className={`text-sm font-semibold ${tone}`}>
      {label}
      {message && <span className="ml-2 font-normal">{message}</span>}
    </div>
  );
}
