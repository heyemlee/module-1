"use client";

import { type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const fieldClass =
  "h-11 rounded-xl border-[#d8d2c7] bg-white text-[14px] text-[#060606] transition-all placeholder:text-[#a8a399] focus-visible:-translate-y-0.5 focus-visible:border-[#060606] focus-visible:shadow-md focus-visible:ring-[#060606]/15";
const labelClass = "text-[12px] font-semibold text-[#68645d]";

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
      <Card className="rounded-[18px] border-[#d8d2c7] bg-white shadow-[0_16px_45px_rgba(0,0,0,0.06)]">
        <CardContent className="flex flex-col gap-5 p-8">
          <span className="inline-flex w-fit items-center rounded-full bg-[#060606] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Secure
          </span>

          <h2
            className="text-[44px] leading-[1.05] text-[#060606]"
            style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}
          >
            Sign in
          </h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account" className={labelClass}>
              Account
            </Label>
            <Input
              id="account"
              type="text"
              placeholder="Enter your account"
              className={fieldClass}
              value={account}
              onChange={(event) => onAccountChange(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className={labelClass}>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              className={fieldClass}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>

          <label className="inline-flex w-fit cursor-pointer select-none items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={remember}
              onChange={(event) => onRememberChange(event.target.checked)}
            />
            <span className="rounded-full border border-[#d8d2c7] bg-white px-3 py-1 text-[11px] font-bold text-[#060606] transition-colors peer-checked:border-[#060606] peer-checked:bg-[#060606] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#060606]/30">
              Remember me
            </span>
          </label>

          {error}

          <Button
            type="submit"
            disabled={busy}
            className="h-[42px] w-full rounded-full bg-[#060606] text-[13px] font-semibold text-white hover:bg-[#1f1f1f]"
          >
            {busy ? "Signing in..." : "Sign In"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
