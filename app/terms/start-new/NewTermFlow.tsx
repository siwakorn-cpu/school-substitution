"use client";

import { useMemo, useState } from "react";

type Mode = "copy_schedule" | "blank_schedule";
type Step = "closed" | "warning" | "confirm";

export function NewTermFlow({ terms, currentTerm }: { terms: string[]; currentTerm: string }) {
  const [newTerm, setNewTerm] = useState("");
  const [sourceTerm, setSourceTerm] = useState(currentTerm);
  const [mode, setMode] = useState<Mode>("copy_schedule");
  const [step, setStep] = useState<Step>("closed");
  const [backupReady, setBackupReady] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canStart = useMemo(() => {
    return newTerm.trim().length > 0 && confirmed && backupReady && (mode === "blank_schedule" || sourceTerm.trim().length > 0);
  }, [backupReady, confirmed, mode, newTerm, sourceTerm]);

  async function downloadBackup() {
    setError("");
    setMessage("");
    setBackupLoading(true);

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

      setBackupReady(true);
      setStep("confirm");
      setMessage("ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว กรุณาติ๊กยืนยันก่อนเริ่มภาคเรียนใหม่");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดาวน์โหลดไฟล์สำรองข้อมูลไม่สำเร็จ");
    } finally {
      setBackupLoading(false);
    }
  }

  async function startNewTerm() {
    setError("");
    setMessage("");

    const response = await fetch("/api/terms/start-new", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        newTerm: newTerm.trim(),
        sourceTerm: sourceTerm.trim(),
        mode,
        backupConfirmed: confirmed && backupReady
      })
    });
    const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "เริ่มภาคเรียนใหม่ไม่สำเร็จ");
      return;
    }

    setStep("closed");
    setConfirmed(false);
    setMessage(payload.message ?? "เริ่มภาคเรียนใหม่เรียบร้อยแล้ว");
  }

  function openWarning() {
    setStep("warning");
    setConfirmed(false);
    setError("");
    setMessage("");
  }

  return (
    <>
      <div className="term-flow">
        {message ? <p className="badge success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="form-row">
          <label>
            ภาคเรียนใหม่
            <input value={newTerm} onChange={(event) => setNewTerm(event.target.value)} placeholder="เช่น 2/2569" required />
          </label>
          <label>
            ภาคเรียนต้นทาง
            <select value={sourceTerm} onChange={(event) => setSourceTerm(event.target.value)} disabled={mode === "blank_schedule"}>
              {terms.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="mode-grid">
          <legend>รูปแบบการเริ่มภาคเรียน</legend>
          <label>
            <input
              type="radio"
              name="mode"
              value="copy_schedule"
              checked={mode === "copy_schedule"}
              onChange={() => setMode("copy_schedule")}
            />
            คัดลอกตารางสอนจากภาคเรียนต้นทาง
            <span className="en-caption">Copy teaching schedules from the source term</span>
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="blank_schedule"
              checked={mode === "blank_schedule"}
              onChange={() => setMode("blank_schedule")}
            />
            เริ่มแบบตารางว่าง
            <span className="en-caption">Start with a blank schedule</span>
          </label>
        </fieldset>

        <button className="btn primary" type="button" onClick={openWarning} disabled={!newTerm.trim()}>
          เริ่มภาคเรียนใหม่
        </button>
      </div>

      {step !== "closed" ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-term-dialog-title">
            <h2 id="new-term-dialog-title">ก่อนเริ่มภาคเรียนใหม่ ควรสำรองข้อมูลปัจจุบันก่อน</h2>
            {message ? <p className="badge success">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}

            {step === "warning" ? (
              <>
                <p className="muted">
                  การเริ่มภาคเรียนใหม่จะกำหนดภาคเรียนใหม่เป็นค่าเริ่มต้นของระบบ และอาจคัดลอกตารางสอนตามตัวเลือก
                </p>
                <div className="actions">
                  <button className="btn primary" type="button" onClick={downloadBackup} disabled={backupLoading}>
                    {backupLoading ? "กำลังสำรองข้อมูล..." : "สำรองข้อมูลทันที"}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setBackupReady(true);
                      setStep("confirm");
                    }}
                  >
                    ฉันสำรองข้อมูลแล้ว
                  </button>
                  <button className="btn" type="button" onClick={() => setStep("closed")}>
                    ยกเลิก
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="term-summary">
                  <span>ภาคเรียนใหม่: {newTerm.trim()}</span>
                  <span>รูปแบบ: {mode === "copy_schedule" ? `คัดลอกจาก ${sourceTerm}` : "ตารางว่าง"}</span>
                </div>
                <label className="confirm-check">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  ข้าพเจ้ายืนยันว่าได้สำรองข้อมูลแล้ว และเข้าใจว่าการเริ่มภาคเรียนใหม่จะเปลี่ยนค่าเริ่มต้นของระบบ
                </label>
                <div className="actions">
                  <button className="btn primary" type="button" onClick={startNewTerm} disabled={!canStart}>
                    ยืนยันเริ่มภาคเรียนใหม่
                  </button>
                  <button className="btn" type="button" onClick={() => setStep("warning")}>
                    กลับ
                  </button>
                  <button className="btn" type="button" onClick={() => setStep("closed")}>
                    ยกเลิก
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
