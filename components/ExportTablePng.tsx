"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";

export function ExportTablePng({
  title,
  dateLabel,
  columns,
  rows,
  filename
}: {
  title: string;
  dateLabel: string;
  columns: string[];
  rows: string[][];
  filename: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const disabled = busy || rows.length === 0;

  async function handleExport() {
    if (disabled || !cardRef.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true
      });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-png-wrap">
      <div className="export-a4-card export-a4-offscreen no-glossary" ref={cardRef}>
        <div className="export-a4-head">
          <strong>ระบบจัดครูสอนแทน</strong>
          <span>{title}</span>
          <span>{dateLabel}</span>
        </div>
        <table className="export-a4-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn" type="button" onClick={handleExport} disabled={disabled}>
        {busy ? "กำลังสร้างรูป..." : "Export รูปภาพ"}
      </button>
    </div>
  );
}
