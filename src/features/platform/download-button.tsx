"use client";

import "./download-button.css";

export function DownloadButton({
  imageBase64,
  fileName,
}: {
  imageBase64: string;
  fileName: string;
}) {
  const handleDownload = () => {
    // Trigger download
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${imageBase64}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button className="dl-Btn" onClick={handleDownload} aria-label="Download" title="Download Rendering">
      <svg
        className="dl-svgIcon"
        viewBox="0 0 384 512"
        height="1em"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"></path>
      </svg>
      <span className="dl-icon2"></span>
      <span className="dl-tooltip">Download</span>
    </button>
  );
}
