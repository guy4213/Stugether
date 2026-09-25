"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell } from "@/components/auth/auth-shell";
import { signUpAndCheckSession } from "@/lib/auth/signup-actions";

const STEPS = ["חשבון", "פרטי לימודים", "סיום"];

// Step 1 (account) happens here; step 2 (institution/faculty/department/
// year) is the profile form, where new users land right after signing up.
function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex items-center" aria-label="שלבי הרשמה">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              aria-current={i === current ? "step" : undefined}
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-sm font-bold",
                i <= current
                  ? "bg-linear-to-l from-primary to-[oklch(0.55_0.11_180)] text-white"
                  : "border-2 border-border text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn("text-xs", i === current ? "font-semibold" : "text-muted-foreground")}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && <span className="mx-2 mb-5 h-0.5 flex-1 rounded bg-border" />}
        </li>
      ))}
    </ol>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
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
      const result = await signUpAndCheckSession(email, password, fullName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.hasSession) {
        toast.success("נרשמת בהצלחה! נשאר רק לבחור מוסד ומחלקה.");
        router.push("/profile");
      } else {
        toast.success("נרשמת בהצלחה! בדוק/י את המייל שלך כדי לאמת את החשבון.");
        router.push("/login");
      }
    });
  }

  return (
    <AuthShell title="בואו נכיר" subtitle="צרו חשבון והתחילו ללמוד ביחד">
      <Stepper current={0} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">שם מלא</Label>
          <Input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            maxLength={120}
            className="h-11"
          />
        </div>
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
          {isPending ? "נרשם/ת..." : "לשלב הבא"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          התחברות
        </Link>
      </p>
    </AuthShell>
  );
}
