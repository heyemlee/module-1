"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { StudioSection } from "./studio-page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const STYLES = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

// Inline uploads are stored as data URLs in the existing text columns, so cap
// the file size to keep rows (and the colors API payload) reasonable.
export const MAX_CABINET_IMAGE_BYTES = 4 * 1024 * 1024;

const selectClass = "flex h-10 w-full rounded-studio-small border border-studio-line-strong bg-studio-surface px-3 py-2 text-sm text-studio-ink ring-offset-studio-void file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-studio-quiet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-action/80 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type CabinetColorPayloadFields = {
  cabinetStyle: CabinetStyle;
  name: string;
  promptDescription: string;
  // `undefined` means "leave unchanged" (edit with no new file); `null` clears.
  swatchImageUrl?: string | null;
  hoverExampleImageUrl?: string | null;
  active: boolean;
  sortOrder: number;
};

export function buildCabinetColorPayload(fields: CabinetColorPayloadFields) {
  const payload: Record<string, unknown> = {
    cabinetStyle: fields.cabinetStyle,
    name: fields.name.trim(),
    promptDescription: fields.promptDescription.trim() || fields.name.trim(),
    active: fields.active,
    sortOrder: fields.sortOrder
  };

  if (fields.swatchImageUrl !== undefined) {
    payload.swatchImageUrl = fields.swatchImageUrl;
  }
  if (fields.hoverExampleImageUrl !== undefined) {
    payload.hoverExampleImageUrl = fields.hoverExampleImageUrl;
  }

  return payload;
}

export function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const max = 512;

        if (width > height && width > max) {
          height = Math.round((height * max) / width);
          width = max;
        } else if (height > max) {
          width = Math.round((width * max) / height);
          height = max;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Unable to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export function CabinetColorForm({ color }: { color?: CabinetColor }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [cabinetStyle, setCabinetStyle] = useState<CabinetStyle>(
    color?.cabinetStyle ?? "EUROPEAN_FRAMELESS"
  );
  const [name, setName] = useState(color?.name ?? "");
  const [promptDescription, setPromptDescription] = useState(
    color?.promptDescription ?? ""
  );
  const [active, setActive] = useState(color?.active ?? true);

  const [swatchData, setSwatchData] = useState<string | null | undefined>(undefined);
  const [hoverData, setHoverData] = useState<string | null | undefined>(undefined);

  const [swatchPreview, setSwatchPreview] = useState<string | null>(
    color?.swatchImageUrl ?? null
  );
  const [hoverPreview, setHoverPreview] = useState<string | null>(
    color?.hoverExampleImageUrl ?? null
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(
    file: File | undefined,
    setData: (data: string) => void,
    setPreview: (value: string) => void
  ) {
    if (!file) return;
    if (file.size > MAX_CABINET_IMAGE_BYTES) {
      setError("Image is too large. Please choose an image under 4MB.");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setData(dataUrl);
      setPreview(dataUrl);
      setError(null);
    } catch {
      setError("Unable to read that image. Please try another file.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Color name is required.");
      return;
    }
    if (!color && !swatchData) {
      setError("A swatch image is required for new finishes.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload = buildCabinetColorPayload({
        cabinetStyle,
        name,
        promptDescription,
        swatchImageUrl: swatchData,
        hoverExampleImageUrl: hoverData,
        active,
        sortOrder: color?.sortOrder ?? 0
      });

      const url = color
        ? `/api/admin/cabinet-colors/${encodeURIComponent(color.id)}`
        : `/api/admin/cabinet-colors`;

      const res = await fetch(url, {
        method: color ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("API rejected the save request");
      }

      router.refresh();

      if (!color) {
        setName("");
        setPromptDescription("");
        setSwatchData(undefined);
        setHoverData(undefined);
        setSwatchPreview(null);
        setHoverPreview(null);
        setError(null);
        formRef.current?.reset();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudioSection aria-label={color ? "Edit color" : "Add finish"}>
      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-6" aria-busy={busy}>
        <h2 className="text-xl font-bold text-studio-ink">
          {color ? "Edit color" : "Add finish"}
        </h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cabinetStyle" className="text-xs text-studio-secondary">Cabinet style</Label>
            <select
              id="cabinetStyle"
              value={cabinetStyle}
              onChange={(e) => setCabinetStyle(e.target.value as CabinetStyle)}
              disabled={busy}
              className={selectClass}
            >
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs text-studio-secondary">Color name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="e.g. Natural Oak"
            />
          </div>

          {color && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={active}
                onCheckedChange={(c) => setActive(c === true)}
                disabled={busy}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="swatchImage" className="text-xs text-studio-secondary">Swatch image</Label>
            <div className="flex items-center gap-4">
              {swatchPreview ? (
                <img
                  src={swatchPreview}
                  alt={color ? `${name || color.name} swatch` : "Preview"}
                  className="size-16 shrink-0 rounded-md border border-studio-line object-cover"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-studio-line bg-studio-line/20 text-xs text-studio-secondary">
                  No swatch
                </div>
              )}
              <Input
                id="swatchImage"
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0], setSwatchData, setSwatchPreview)}
                disabled={busy}
                aria-describedby="swatch-upload-hint"
                className="h-10 text-xs text-studio-secondary file:text-studio-ink"
              />
            </div>
            <p id="swatch-upload-hint" className="text-xs text-studio-secondary">
              Images are resized before upload. Maximum source size: 4MB.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hoverImage" className="text-xs text-studio-secondary">Hover example image (optional)</Label>
            <div className="flex items-center gap-4">
              {hoverPreview ? (
                <img
                  src={hoverPreview}
                  alt={color ? `${name || color.name} kitchen example` : "Preview"}
                  className="size-16 shrink-0 rounded-md border border-studio-line object-cover"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-studio-line bg-studio-line/20 text-xs text-studio-secondary">
                  No example
                </div>
              )}
              <Input
                id="hoverImage"
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0], setHoverData, setHoverPreview)}
                disabled={busy}
                aria-describedby="swatch-upload-hint"
                className="h-10 text-xs text-studio-secondary file:text-studio-ink"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promptDescription" className="text-xs text-studio-secondary">
              AI description
            </Label>
            <textarea
              id="promptDescription"
              rows={3}
              value={promptDescription}
              onChange={(e) => setPromptDescription(e.target.value)}
              disabled={busy}
              className={`${selectClass} resize-none h-auto`}
              placeholder="Visual description for the AI"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-studio-danger/10 px-4 py-3 text-sm font-medium text-studio-danger">
            {error}
          </div>
        )}

        <Button type="submit" disabled={busy || (!color && !swatchPreview)} className="w-full">
          {busy ? "Saving..." : "Save finish"}
        </Button>
      </form>
    </StudioSection>
  );
}
