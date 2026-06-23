"use client";

import { useMemo, useState } from "react";
import { thaiDays } from "@/lib/date";

type TeacherOption = {
  id: string;
  code: string;
  name: string;
  departmentName: string;
};

type LevelMeetingFormProps = {
  level: number;
  dayOfWeek: number;
  period: number;
  teacherIds: string[];
  teachers: TeacherOption[];
  isConfigured: boolean;
};

const ACTIVITY_DAYS = [1, 2, 3, 4, 5];
const ACTIVITY_PERIODS = Array.from({ length: 10 }, (_, index) => index + 1);

export function LevelMeetingForm({
  level,
  dayOfWeek,
  period,
  teacherIds,
  teachers,
  isConfigured
}: LevelMeetingFormProps) {
  const [query, setQuery] = useState("");
  const [checkedTeacherIds, setCheckedTeacherIds] = useState(() => new Set(teacherIds));
  const normalizedQuery = query.trim().toLowerCase();
  const matchedTeachers = useMemo(() => {
    if (!normalizedQuery) return teachers;
    return teachers.filter((teacher) =>
      [teacher.code, teacher.name, teacher.departmentName].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery, teachers]);
  const checkedTeacherIdList = Array.from(checkedTeacherIds);

  function toggleTeacher(teacherId: string, checked: boolean) {
    setCheckedTeacherIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(teacherId);
      } else {
        next.delete(teacherId);
      }
      return next;
    });
  }

  return (
    <form className="level-meeting-form" action="/api/level-meetings" method="post">
      <input type="hidden" name="level" value={level} />
      {checkedTeacherIdList.map((teacherId) => (
        <input key={teacherId} type="hidden" name="teacherIds" value={teacherId} />
      ))}
      <div className="level-meeting-head">
        <div>
          <h3>ประชุมระดับ ม.{level}</h3>
          <span className="en-caption">Mathayom {level} level meeting</span>
        </div>
        {isConfigured ? (
          <span className="badge">
            {thaiDays[dayOfWeek]} คาบ {period}
          </span>
        ) : (
          <span className="badge warning">ยังไม่ตั้งค่า</span>
        )}
      </div>

      <div className="level-meeting-controls">
        <label>
          วัน
          <select name="dayOfWeek" defaultValue={dayOfWeek}>
            {ACTIVITY_DAYS.map((day) => (
              <option key={day} value={day}>
                {thaiDays[day]}
              </option>
            ))}
          </select>
        </label>
        <label>
          คาบ
          <select name="period" defaultValue={period}>
            {ACTIVITY_PERIODS.map((periodOption) => (
              <option key={periodOption} value={periodOption}>
                คาบ {periodOption}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="small-label">ครูที่เข้าสอนคาบประชุมระดับ</p>
        <span className="en-caption">Assigned teachers</span>
        <label className="level-teacher-search no-glossary">
          ค้นหาครู
          <span className="en-caption">Search teachers</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ชื่อครูหรือรหัสครู"
            autoComplete="off"
          />
        </label>
        <p className="muted level-search-count">
          แสดง {matchedTeachers.length} จาก {teachers.length} คน
        </p>
        <div className="checkbox-grid level-teacher-grid">
          {matchedTeachers.map((teacher) => (
            <label key={teacher.id} className="compact-check">
              <input
                type="checkbox"
                checked={checkedTeacherIds.has(teacher.id)}
                onChange={(event) => toggleTeacher(teacher.id, event.target.checked)}
              />
              <span>
                {teacher.code} - {teacher.name}
                <small>{teacher.departmentName}</small>
              </span>
            </label>
          ))}
          {teachers.length === 0 ? <p className="muted">ยังไม่มีข้อมูลครู</p> : null}
          {teachers.length > 0 && matchedTeachers.length === 0 ? <p className="muted">ไม่พบครูที่ตรงกับคำค้นหา</p> : null}
        </div>
      </div>

      <button className="btn primary no-glossary" type="submit">
        <span>บันทึก ม.{level}</span>
        <span className="en-caption">Save M.{level}</span>
      </button>
    </form>
  );
}
