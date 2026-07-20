"use client";

import { useEffect, useState } from "react";

/**
 * Pop-up แจ้งผลหลังบันทึก — ลอยมุมขวาบน จางหายเองใน 4 วินาที
 * ใช้กับ query param เช่น ?savedMessage=... แล้วล้างพารามิเตอร์ออกจาก URL ให้
 * เพื่อไม่ให้เด้งซ้ำตอนรีเฟรชหน้า
 */
export function SaveToast({ message, paramName = "savedMessage" }: { message: string; paramName?: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(paramName)) {
      url.searchParams.delete(paramName);
      window.history.replaceState(null, "", url.toString());
    }
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [paramName]);

  if (!visible || !message) return null;

  return (
    <div className="save-toast" role="status" aria-live="polite">
      <span className="save-toast-icon" aria-hidden>✓</span>
      <span>{message}</span>
      <button className="save-toast-close" type="button" aria-label="ปิด" onClick={() => setVisible(false)}>
        ×
      </button>
    </div>
  );
}
