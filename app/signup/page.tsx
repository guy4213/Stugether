"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { signUpAndCheckSession } from "@/lib/auth/signup-actions";

// Signup is just an account (SPEC §4.1, CR 27.10.2026): email + password, or
// Google. Everything else is asked by the onboarding wizard right after.
export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedToTerms) {
      toast.error("יש לאשר את תנאי השימוש ומדיניות הפרטיות");
      return;
    }

    startTransition(async () => {
      const result = await signUpAndCheckSession(email, password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.hasSession) {
        router.push("/onboarding");
      } else {
        toast.success("נרשמת בהצלחה! בדוק/י את המייל שלך כדי לאמת את החשבון.");
        router.push("/login");
      }
    });
  }

  return (
    <AuthShell title="בואו נכיר 👋" subtitle="פותחים חשבון בחצי דקה, וממשיכים ללמוד ביחד">
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-11"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            לפחות 8 תווים
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
            className="mt-0.5"
          />
          <span className="text-muted-foreground">
            אני מאשר/ת את תנאי השימוש ואת מדיניות הפרטיות
          </span>
        </label>
        <Button
          type="submit"
          variant="gradient"
          className="h-12 w-full text-base"
          disabled={isPending}
        >
          {isPending ? "יוצר חשבון..." : "יצירת חשבון"}
        </Button>
      </form>

      <AuthDivider />
      <GoogleButton />
      <p className="mt-3 text-center text-xs text-muted-foreground">
        בהמשך עם Google את/ה מאשר/ת את תנאי השימוש ואת מדיניות הפרטיות
      </p>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          התחברות
        </Link>
      </p>
    </AuthShell>
  );
}
