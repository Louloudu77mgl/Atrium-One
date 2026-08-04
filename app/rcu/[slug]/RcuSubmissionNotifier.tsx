"use client";

import { useEffect } from "react";

export function RcuSubmissionNotifier({ slug }: { slug: string }) {
  useEffect(() => {
    window.localStorage.setItem("atriumone:rcu-submitted", JSON.stringify({ slug, submittedAt: Date.now() }));
  }, [slug]);

  return null;
}
