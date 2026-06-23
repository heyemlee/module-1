"use client";

import { Lock, UserRound } from "lucide-react";
import { type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function SignInForm({
  account,
  password,
  remember,
  busy,
  error,
  onAccountChange,
  onPasswordChange,
  onRememberChange,
  onSubmit
}: {
  account: string;
  password: string;
  remember: boolean;
  busy: boolean;
  error: ReactNode;
  onAccountChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <Card className="w-full max-w-md rounded-2xl border bg-background shadow-md">
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="account">Account</Label>
            <div className="flex h-12 items-center gap-2 rounded-lg border px-3 focus-within:ring-2 focus-within:ring-ring">
              <UserRound className="h-5 w-5 text-muted-foreground" />
              <Input
                id="account"
                type="text"
                placeholder="Enter your account"
                className="border-0 shadow-none focus-visible:ring-0"
                value={account}
                onChange={(event) => onAccountChange(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex h-12 items-center gap-2 rounded-lg border px-3 focus-within:ring-2 focus-within:ring-ring">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                className="border-0 shadow-none focus-visible:ring-0"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="custom-checkbox text-sm font-normal">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => onRememberChange(event.target.checked)}
              />
              <span className="checkmark" />
              <span>Remember me</span>
            </label>
          </div>

          {error}

          <button
            type="submit"
            disabled={busy}
            className="uiverse-fill-button h-12 w-full"
          >
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </CardContent>
      </Card>
    </form>
  );
}
