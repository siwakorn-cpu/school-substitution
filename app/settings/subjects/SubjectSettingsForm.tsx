"use client";

import { useMemo, useState } from "react";

type SubjectRow = {
  id: string;
  code: string | null;
  name: string;
  requiresSubstitution: boolean;
};

export function SubjectSettingsForm({ subjects }: { subjects: SubjectRow[] }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const matchedIds = useMemo(() => {
    if (!normalizedQuery) return null;
    return new Set(
      subjects
        .filter(
          (subject) =>
            subject.name.toLowerCase().includes(normalizedQuery) ||
            (subject.code ?? "").toLowerCase().includes(normalizedQuery)
        )
        .map((subject) => subject.id)
    );
  }, [normalizedQuery, subjects]);

  const matchCount = matchedIds ? matchedIds.size : subjects.length;

  return (
    <form className="form" action="/api/subjects" method="post">
      <div className="subject-search">
        <label>
          ค้นหารายวิชา
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="พิมพ์ชื่อหรือรหัสวิชา"
            autoComplete="off"
          />
        </label>
        {normalizedQuery ? (
          <p className="muted">พบ {matchCount} รายวิชา จากทั้งหมด {subjects.length} รายวิชา</p>
        ) : null}
      </div>

      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <th>รหัสวิชา</th>
              <th>รายวิชา</th>
              <th>ต้องจัดสอนแทน</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => {
              const hidden = matchedIds ? !matchedIds.has(subject.id) : false;
              return (
                <tr key={subject.id} hidden={hidden}>
                  <td className="no-glossary">{subject.code || "-"}</td>
                  <td className="no-glossary">{subject.name}</td>
                  <td>
                    <input type="hidden" name="subjectIds" value={subject.id} />
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        name="requiresSubstitution"
                        value={subject.id}
                        defaultChecked={subject.requiresSubstitution}
                      />
                      <span>{subject.requiresSubstitution ? "จัดสอนแทน" : "ไม่ต้องจัดสอนแทน"}</span>
                    </label>
                  </td>
                </tr>
              );
            })}
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={3}>ยังไม่มีข้อมูลรายวิชา</td>
              </tr>
            ) : null}
            {subjects.length > 0 && matchCount === 0 ? (
              <tr>
                <td colSpan={3}>ไม่พบรายวิชาที่ตรงกับคำค้นหา</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <button className="btn primary" type="submit">
        บันทึกการตั้งค่า
      </button>
    </form>
  );
}
