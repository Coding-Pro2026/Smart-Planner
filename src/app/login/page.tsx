"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button, Card, ErrorNote, Field } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => api(`/auth/${mode}`, { body: { email, password } }),
    onSuccess: () => router.replace("/"),
  });
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <Sparkles className="mx-auto h-9 w-9 text-brand" />
        <h1 className="mt-2 text-3xl font-bold">PlanGenie</h1>
        <p className="text-sm text-muted">AI-assisted planning for weddings, birthdays &amp; community events.</p>
      </div>
      <Card>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Field label="Email"><input className="w-full" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password" hint={mode === "register" ? "At least 10 characters." : undefined}>
            <input className="w-full" type="password" required minLength={mode === "register" ? 10 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <ErrorNote error={m.error} />
          <Button className="w-full" loading={m.isPending}>{mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
        <button className="mt-4 w-full text-center text-sm text-brand hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); m.reset(); }}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </Card>
    </main>
  );
}
