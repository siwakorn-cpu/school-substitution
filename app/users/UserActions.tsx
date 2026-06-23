"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { DeleteUserForm } from "./DeleteUserForm";

type TeacherOption = {
  id: string;
  code: string;
  name: string;
  linkedUserId: string | null;
};

type UserActionsProps = {
  userId: string;
  username: string;
  role: string;
  teacherId: string | null;
  isActive: boolean;
  currentUserId: string;
  teachers: TeacherOption[];
};

export function UserActions({
  userId,
  username,
  role,
  teacherId,
  isActive,
  currentUserId,
  teachers
}: UserActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const linkedTeachers = teachers.filter((teacher) => !teacher.linkedUserId || teacher.id === teacherId);

  return (
    <div className="user-row-actions">
      <button className="btn" type="button" onClick={() => setIsEditing(true)}>
        แก้ไข
      </button>
      <DeleteUserForm userId={userId} username={username} disabled={userId === currentUserId} />

      {isEditing
        ? createPortal(
            <div className="user-edit-modal-layer" role="presentation">
              <button className="user-edit-backdrop" type="button" aria-label="ปิดหน้าต่างแก้ไข" onClick={() => setIsEditing(false)} />
              <form className="user-edit-modal" action="/api/users" method="post">
                <div className="user-edit-modal-head">
                  <div>
                    <h3>แก้ไขบัญชีผู้ใช้</h3>
                    <span className="en-caption">Edit user account</span>
                    <strong className="user-edit-username no-glossary">{username}</strong>
                  </div>
                  <button className="btn" type="button" onClick={() => setIsEditing(false)}>
                    ปิด
                  </button>
                </div>
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={userId} />
                <label>
                  สิทธิ์
                  <select name="role" defaultValue={role} aria-label="สิทธิ์">
                    <option value="ADMIN">Admin</option>
                    <option value="PERSONNEL">หัวหน้างานบุคคล</option>
                    <option value="HEAD">หัวหน้ากลุ่มสาระ</option>
                    <option value="DEPT_REP">ตัวแทนกลุ่มสาระ</option>
                    <option value="TEACHER">ครู</option>
                  </select>
                </label>
                <label>
                  ครูที่ผูก
                  <select name="teacherId" defaultValue={teacherId ?? ""} aria-label="ครูที่ผูก">
                    <option value="">ไม่ผูกกับครู</option>
                    {linkedTeachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.code} - {teacher.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  สถานะ
                  <select name="isActive" defaultValue={isActive ? "true" : "false"} aria-label="สถานะ">
                    <option value="true">อนุมัติ/ใช้งาน</option>
                    <option value="false">รออนุมัติ/ปิดใช้งาน</option>
                  </select>
                </label>
                <label>
                  รหัสผ่านใหม่
                  <input name="password" type="password" placeholder="เว้นว่างถ้าไม่เปลี่ยน" aria-label="รหัสผ่านใหม่" />
                </label>
                <button className="btn primary" type="submit">
                  บันทึก
                </button>
              </form>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
