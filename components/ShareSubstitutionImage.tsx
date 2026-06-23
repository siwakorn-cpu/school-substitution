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

export function ShareSubstitutionImage(data: ShareSubstitutionData) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    link.download = `จัดสอนแทน-${data.date}-คาบ${data.period}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await buildBlob();
      if (!blob) throw new Error("no-blob");
      const file = new File([blob], `จัดสอนแทน-คาบ${data.period}.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "การจัดสอนแทน" });
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
      <div className="share-card no-glossary" ref={cardRef}>
        <div className="share-card-head">
          <span className="share-card-tag">การจัดสอนแทน</span>
          <strong className="share-card-date">{data.date}</strong>
        </div>
        <dl className="share-card-rows">
          <div>
            <dt>คาบ</dt>
            <dd>
              คาบ {data.period} · {data.classRoom}
            </dd>
          </div>
          <div>
            <dt>วิชา</dt>
            <dd>{data.subject}</dd>
          </div>
          {data.specialRoom ? (
            <div>
              <dt>ห้อง/อาคาร</dt>
              <dd>{data.specialRoom}</dd>
            </div>
          ) : null}
          <div>
            <dt>ครูเดิม</dt>
            <dd>{data.originalTeacher}</dd>
          </div>
          <div className="share-card-highlight">
            <dt>ครูสอนแทน</dt>
            <dd>{data.substituteTeacher}</dd>
          </div>
          {data.note ? (
            <div>
              <dt>หมายเหตุ</dt>
              <dd>{data.note}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="actions">
        <button className="btn primary" type="button" onClick={handleShare} disabled={busy}>
          {busy ? "กำลังสร้างรูป…" : "แชร์เป็นรูป"}
        </button>
        <button className="btn" type="button" onClick={handleDownload} disabled={busy}>
          ดาวน์โหลดรูป
        </button>
      </div>
      {message ? <p className="muted share-note">{message}</p> : null}
    </div>
  );
}
