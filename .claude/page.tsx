"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("AuthCallback");

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/reset-password";
      const redirectTo = next.startsWith("/") && !next.startsWith("//") ? next : "/reset-password";

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            logger.error("Code exchange error:", error.message);
            setError(error.message);
            setTimeout(() => {
              router.push("/forgot-password?error=exchange_failed");
            }, 2000);
            return;
          }

          router.push(redirectTo);
        } catch (err) {
          logger.error("Exception during code exchange:", err);
          setError("Error inesperado");
          setTimeout(() => {
            router.push("/forgot-password?error=exception");
          }, 2000);
        }
      } else {
        const hash = window.location.hash;

        if (hash) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session) {
            router.push(redirectTo);
            return;
          }
        }

        setError("Enlace invalido");
        setTimeout(() => {
          router.push("/forgot-password?error=no_code");
        }, 2000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-destructive mb-2">Error: {error}</p>
            <p className="text-muted-foreground">Redirigiendo...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Verificando enlace...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
