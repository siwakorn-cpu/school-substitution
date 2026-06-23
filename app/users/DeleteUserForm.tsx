"use client";

export function DeleteUserForm({ userId, username, disabled }: { userId: string; username: string; disabled: boolean }) {
  return (
    <form
      action="/api/users"
      method="post"
      onSubmit={(event) => {
        if (disabled || !confirm(`ยืนยันลบผู้ใช้ ${username} หรือไม่?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={userId} />
      <button className="btn danger user-delete-button" type="submit" disabled={disabled} title={disabled ? "ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่" : undefined}>
        ลบผู้ใช้
      </button>
    </form>
  );
}
