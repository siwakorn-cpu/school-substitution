"use client";

import { useState } from "react";

export function BackupDownload() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function downloadBackup() {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/backup/export");
      if (!response.ok) throw new Error(await response.text());

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "school-substitution-backup.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setMessage(`ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว: ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดาวน์โหลดไฟล์สำรองข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="term-flow">
      {message ? <p className="badge success no-glossary">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <p className="muted">
        ดาวน์โหลดข้อมูลทั้งระบบเป็นไฟล์ JSON ไฟล์เดียว (ครู ผู้ใช้ ตารางสอน การลา การจัดสอนแทน การแลกคาบ และสิทธิ์)
        เก็บไว้กู้คืนภายหลังได้
      </p>

      <button className="btn primary" type="button" onClick={downloadBackup} disabled={loading}>
        {loading ? "กำลังสำรองข้อมูล..." : "ดาวน์โหลดไฟล์สำรองข้อมูล"}
      </button>
    </div>
  );
}
