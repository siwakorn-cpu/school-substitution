"use client";

import { useMemo, useState } from "react";

type ResetMode = "usage_only" | "schedules_too" | "master_data_too";
type Step = "closed" | "warning" | "confirm";

const modeLabels: Record<ResetMode, string> = {
  usage_only: "ล้างเฉพาะข้อมูลการใช้งาน",
  schedules_too: "ล้างข้อมูลการใช้งานและตารางสอน",
  master_data_too: "เริ่มใหม่ทั้งหมดแต่เก็บบัญชีผู้ดูแลระบบ"
};

export function ResetSystemFlow() {
  const [mode, setMode] = useState<ResetMode>("usage_only");
  const [step, setStep] = useState<Step>("closed");
  const [backupReady, setBackupReady] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canReset = useMemo(() => {
    return backupReady && confirmed && confirmationText.trim() === "RESET" && !resetting;
  }, [backupReady, confirmationText, confirmed, resetting]);

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
      setMessage("ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว กรุณาติ๊กยืนยันและพิมพ์ RESET ก่อนเริ่มต้นระบบใหม่");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดาวน์โหลดไฟล์สำรองข้อมูลไม่สำเร็จ");
    } finally {
      setBackupLoading(false);
    }
  }

  async function resetSystem() {
    setError("");
    setMessage("");
    setResetting(true);

    try {
      const response = await fetch("/api/system/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          backupConfirmed: confirmed && backupReady,
          confirmationText: confirmationText.trim()
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "เริ่มต้นระบบใหม่ไม่สำเร็จ");
        return;
      }

      setStep("closed");
      setConfirmed(false);
      setConfirmationText("");
      setBackupReady(false);
      setMessage(payload.message ?? "เริ่มต้นระบบใหม่เรียบร้อยแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เริ่มต้นระบบใหม่ไม่สำเร็จ");
    } finally {
      setResetting(false);
    }
  }

  function openWarning() {
    setStep("warning");
    setConfirmed(false);
    setConfirmationText("");
    setError("");
    setMessage("");
  }

  return (
    <>
      <div className="term-flow">
        {message ? <p className="badge success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <fieldset className="mode-grid">
          <legend>รูปแบบการเริ่มต้นระบบใหม่</legend>
          <label>
            <input type="radio" name="resetMode" checked={mode === "usage_only"} onChange={() => setMode("usage_only")} />
            ล้างเฉพาะข้อมูลการใช้งาน
            <span className="en-caption">Clear absences, substitutions, swaps, and temporary schedules</span>
          </label>
          <label>
            <input type="radio" name="resetMode" checked={mode === "schedules_too"} onChange={() => setMode("schedules_too")} />
            ล้างข้อมูลการใช้งานและตารางสอน
            <span className="en-caption">Also clear teaching schedules and saved terms</span>
          </label>
          <label>
            <input
              type="radio"
              name="resetMode"
              checked={mode === "master_data_too"}
              onChange={() => setMode("master_data_too")}
            />
            เริ่มใหม่ทั้งหมดแต่เก็บบัญชีผู้ดูแลระบบ
            <span className="en-caption">Also clear teachers, rooms, subjects, departments, and non-admin users</span>
          </label>
        </fieldset>

        <button className="btn danger" type="button" onClick={openWarning}>
          เริ่มต้นระบบใหม่
        </button>
      </div>

      {step !== "closed" ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
            <h2 id="reset-dialog-title">ก่อนเริ่มต้นระบบใหม่ ต้องสำรองข้อมูลปัจจุบันก่อน</h2>
            {message ? <p className="badge success">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}

            {step === "warning" ? (
              <>
                <p className="error">
                  การเริ่มต้นระบบใหม่จะล้างข้อมูลตามรูปแบบที่เลือก และไม่สามารถย้อนกลับจากหน้าระบบได้
                </p>
                <div className="term-summary">
                  <span>รูปแบบ: {modeLabels[mode]}</span>
                </div>
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
                  <span>รูปแบบ: {modeLabels[mode]}</span>
                  <span>คำยืนยัน: RESET</span>
                </div>
                <label className="confirm-check">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  ข้าพเจ้ายืนยันว่าได้สำรองข้อมูลแล้ว และเข้าใจว่าข้อมูลการใช้งานเดิมจะถูกล้าง
                </label>
                <label>
                  พิมพ์ RESET เพื่อยืนยัน
                  <input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} autoComplete="off" />
                </label>
                <div className="actions">
                  <button className="btn danger" type="button" onClick={resetSystem} disabled={!canReset}>
                    {resetting ? "กำลังเริ่มต้นระบบใหม่..." : "ยืนยันเริ่มต้นระบบใหม่"}
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
