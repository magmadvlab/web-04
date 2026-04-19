"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors (client errors)
              if (error?.response?.status >= 400 && error?.response?.status < 500) {
                return false;
              }
              // Retry up to 2 times for other errors
              return failureCount < 2;
            },
            // Error handling is done by API interceptor, so we don't need onError here
            // to avoid duplicate error messages
          },
          mutations: {
            // Error handling for mutations is done by API interceptor
            // Individual mutations can override with onError if needed
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

