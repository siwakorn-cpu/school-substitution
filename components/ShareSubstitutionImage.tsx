"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";

export type ShareSubstitutionData = {
  date: string;
  period: number;
  classRoom: string;
  subject: string;
  originalTeacher: string;
  substituteTeacher: string;
  specialRoom?: string | null;
  note?: string | null;
};

export function ShareSubstitutionImage({
  title = "การจัดสอนแทน",
  subtitle,
  filename = "จัดสอนแทน",
  items,
  disabledReason
}: {
  title?: string;
  subtitle?: string;
  filename?: string;
  items: ShareSubstitutionData[];
  disabledReason?: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const firstItem = items[0];
  const disabled = busy || items.length === 0 || Boolean(disabledReason);

  async function buildBlob(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  function downloadBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    if (disabled) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await buildBlob();
      if (!blob) throw new Error("no-blob");
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title });
      } else {
        downloadBlob(blob);
        setMessage("อุปกรณ์นี้แชร์ตรงไม่ได้ ระบบดาวน์โหลดรูปให้แล้ว ส่งเข้า LINE ได้เอง");
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        setMessage("แชร์ไม่สำเร็จ ลองกดดาวน์โหลดรูปแทน");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (disabled) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await buildBlob();
      if (blob) downloadBlob(blob);
    } catch {
      setMessage("สร้างรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-block">
      <div className="share-card share-card-export-source no-glossary" ref={cardRef}>
        <div className="share-card-head">
          <span className="share-card-tag">{title}</span>
          <strong className="share-card-date">{firstItem?.date ?? ""}</strong>
        </div>
        {subtitle ? <p className="share-card-subtitle">{subtitle}</p> : null}
        <table className="share-card-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>คาบ</th>
              <th>ม.</th>
              <th>วิชา</th>
              <th>ครูเดิม</th>
              <th>ห้อง/อาคาร</th>
              <th>ครูสอนแทน</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.date}-${item.period}-${item.classRoom}-${item.substituteTeacher}`}>
                <td>{item.date}</td>
                <td>คาบ {item.period}</td>
                <td>{item.classRoom}</td>
                <td>{item.subject}</td>
                <td>{item.originalTeacher}</td>
                <td>{item.specialRoom || "-"}</td>
                <td>{item.substituteTeacher}</td>
                <td>{item.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="share-export-actions">
        <strong>{title}</strong>
        <button className="btn primary" type="button" onClick={handleShare} disabled={disabled}>
          {busy ? "กำลังสร้าง..." : "แชร์"}
        </button>
        <button className="btn" type="button" onClick={handleDownload} disabled={disabled}>
          ดาวน์โหลด
        </button>
      </div>
      {disabledReason ? <p className="muted share-note">{disabledReason}</p> : null}
      {message ? <p className="muted share-note">{message}</p> : null}
    </div>
  );
}
