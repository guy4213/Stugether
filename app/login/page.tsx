"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { signIn } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/auth/next-path";

function nextPath(): string | null {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  // ?auth_error=1 comes from /auth/callback (expired link, Google sign-in
  // cancelled). Read on mount: window is not available during prerender.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("auth_error")) {
      toast.error("ההתחברות לא הושלמה. נסו שוב");
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await signIn(email, password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(nextPath() ?? "/dashboard");
    });
  }

  return (
    <AuthShell title="ברוכים השבים 👋" subtitle="התחברו כדי להמשיך ללמוד ביחד">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11"
          />
        </div>
        <Button
          type="submit"
          variant="gradient"
          className="h-12 w-full text-base"
          disabled={isPending}
        >
          {isPending ? "מתחבר..." : "התחברות"}
        </Button>
      </form>

      <AuthDivider />
      <GoogleButton />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        עדיין אין לך חשבון?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          הרשמה
        </Link>
      </p>
    </AuthShell>
  );
}
