"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function shouldRetry(failureCount: number, error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  // Do not retry auth/permission/validation/not-found errors.
  if (status && status >= 400 && status < 500 && status !== 429) return false;
  return failureCount < 2;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: shouldRetry },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
