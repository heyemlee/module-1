"use client";

import { DownloadIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

export function DownloadButton({
  href,
  fileName
}: {
  href: string;
  fileName: string;
}) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      aria-label="Download rendering"
      title="Download rendering"
      className="size-8 px-0"
    >
      <DownloadIcon aria-hidden />
    </Button>
  );
}
