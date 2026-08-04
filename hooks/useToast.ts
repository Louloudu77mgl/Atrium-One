"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastState } from "@/components/Toast";
import { mapUserFacingError } from "@/lib/user-feedback";

export function useToast(duration = 3200) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<number | null>(null);
  const lastToastKeyRef = useRef("");

  const clearToast = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    lastToastKeyRef.current = "";
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, tone: NonNullable<ToastState>["tone"]) => {
    const safeMessage = mapUserFacingError(message);
    const nextKey = `${tone}:${safeMessage}`;

    if (lastToastKeyRef.current === nextKey && timerRef.current) {
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    lastToastKeyRef.current = nextKey;
    setToast({ message: safeMessage, tone });
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      lastToastKeyRef.current = "";
      setToast(null);
    }, duration);
  }, [duration]);

  useEffect(() => clearToast, [clearToast]);

  return {
    toast,
    showToast,
    clearToast
  };
}
