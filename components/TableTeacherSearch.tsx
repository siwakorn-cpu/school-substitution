"use client";

import { useState } from "react";

export function TableTeacherSearch({ targetId, placeholder }: { targetId: string; placeholder?: string }) {
  const [value, setValue] = useState("");

  function handleChange(next: string) {
    setValue(next);
    const container = document.getElementById(targetId);
    if (!container) return;
    const keyword = next.trim().toLowerCase();
    const rows = container.querySelectorAll<HTMLElement>("tbody > tr[data-teacher-name]");
    rows.forEach((row) => {
      const name = (row.dataset.teacherName ?? "").toLowerCase();
      row.style.display = !keyword || name.includes(keyword) ? "" : "none";
    });
  }

  return (
    <input
      type="search"
      className="table-search-input"
      placeholder={placeholder ?? "ค้นหาชื่อครู"}
      value={value}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}
