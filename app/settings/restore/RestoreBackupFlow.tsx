"use client";

import { useMemo, useRef, useState } from "react";

type Mode = "merge" | "replace";

const modeLabels: Record<Mode, string> = {
  merge: "เติมเฉพาะข้อมูลที่ขาด",
  replace: "แทนที่ข้อมูลทั้งหมด"
};

export function RestoreBackupFlow() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("merge");
  const [fileName, setFileName] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canRestore = useMemo(() => {
    if (restoring || !fileName) return false;
    if (mode === "replace") return confirmationText.trim() === "RESTORE";
    return true;
  }, [confirmationText, fileName, mode, restoring]);

  async function restore() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("กรุณาเลือกไฟล์สำรองข้อมูล (.json)");
      return;
    }
    setError("");
    setMessage("");
    setRestoring(true);

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("mode", mode);
      body.set("confirmationText", confirmationText.trim());

      const response = await fetch("/api/backup/import", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "กู้คืนข้อมูลไม่สำเร็จ");
        return;
      }

      setMessage(payload.message ?? "กู้คืนข้อมูลเรียบร้อยแล้ว");
      setConfirmationText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "กู้คืนข้อมูลไม่สำเร็จ");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="term-flow">
      {message ? <p className="badge success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <label>
        ไฟล์สำรองข้อมูล (.json)
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name ?? "");
            setMessage("");
            setError("");
          }}
        />
      </label>

      <fieldset className="mode-grid">
        <legend>รูปแบบการกู้คืน</legend>
        <label>
          <input type="radio" name="restoreMode" checked={mode === "merge"} onChange={() => setMode("merge")} />
          เติมเฉพาะข้อมูลที่ขาด
          <span className="en-caption">Add only records missing from the current database; never overwrite</span>
        </label>
        <label>
          <input type="radio" name="restoreMode" checked={mode === "replace"} onChange={() => setMode("replace")} />
          แทนที่ข้อมูลทั้งหมด
          <span className="en-caption">Wipe all current data, then load everything from the backup file</span>
        </label>
      </fieldset>

      {mode === "replace" ? (
        <>
          <p className="error">
            โหมดแทนที่จะล้างข้อมูลปัจจุบันทั้งหมดก่อนโหลดจากไฟล์ และไม่สามารถย้อนกลับได้ หากบัญชีผู้ดูแลระบบในไฟล์ต่างจากบัญชีที่ใช้อยู่ อาจต้องเข้าสู่ระบบใหม่
          </p>
          <label>
            พิมพ์ RESTORE เพื่อยืนยัน
            <input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} autoComplete="off" />
          </label>
        </>
      ) : null}

      <div className="term-summary">
        <span>รูปแบบ: {modeLabels[mode]}</span>
        {fileName ? <span className="no-glossary">ไฟล์: {fileName}</span> : <span>ยังไม่ได้เลือกไฟล์</span>}
      </div>

      <button className={mode === "replace" ? "btn danger" : "btn primary"} type="button" onClick={restore} disabled={!canRestore}>
        {restoring ? "กำลังกู้คืนข้อมูล..." : "กู้คืนข้อมูล"}
      </button>
    </div>
  );
}
