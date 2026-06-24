"use client";

import { type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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
      <div className="rounded-studio-panel border border-studio-line bg-studio-shell p-6 shadow-[var(--studio-shadow-raised)] sm:p-8">
        <h2 className="text-[26px] font-semibold tracking-[-0.035em]">
          Sign in
        </h2>
        <p className="mt-2 text-[13px] text-studio-muted">
          Use your ABCabinet account.
        </p>
        <div className="mt-6 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="account" className="text-[12px] font-medium text-studio-muted">
              Account
            </Label>
            <Input
              id="account"
              type="text"
              autoComplete="username"
              placeholder="Enter your account"
              value={account}
              onChange={(event) => onAccountChange(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password" className="text-[12px] font-medium text-studio-muted">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>
        </div>
        
        {error && <div className="mt-5">{error}</div>}

        <div className="mt-5">
          <label className="flex items-center gap-3">
            <Checkbox
              checked={remember}
              onCheckedChange={onRememberChange}
            />
            <span className="text-[13px] font-medium text-studio-ink">
              Remember me
            </span>
          </label>
        </div>

        <Button
          type="submit"
          disabled={busy}
          size="lg"
          className="mt-6 w-full"
        >
          {busy ? "Signing in..." : "Sign In"}
        </Button>
      </div>
    </form>
  );
}
