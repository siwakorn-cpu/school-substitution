import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { getRolePermissionMap, MANAGED_ROLES, PERMISSIONS, roleLabel } from "@/lib/permissions";

export default async function SettingsPermissionsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;
  const rolePermissions = await Promise.all(
    MANAGED_ROLES.map(async (role) => ({
      role,
      permissions: await getRolePermissionMap(role)
    }))
  );

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ปรับสิทธิ์</h1>
          <p className="muted">กำหนดสิทธิ์การใช้งานของครู หัวหน้างานบุคคล หัวหน้ากลุ่มสาระ และตัวแทนกลุ่มสาระ</p>
        </div>
        <a className="btn" href="/settings">
          กลับตั้งค่าระบบ
        </a>
      </div>

      {params.saved ? <p className="badge success">บันทึกสิทธิ์เรียบร้อยแล้ว</p> : null}

      <section className="grid">
        <div className="card">
          <form className="form" action="/api/permissions" method="post">
            <div className="table-wrap">
              <table className="permissions-table">
                <thead>
                  <tr>
                    <th>สิทธิ์</th>
                    {rolePermissions.map((item) => (
                      <th key={item.role}>{roleLabel(item.role)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((permission) => (
                    <tr key={permission.key}>
                      <td>
                        <div className="permission-copy" data-bilingual-processed="true">
                          <strong>
                            <span>{permission.label}</span>
                            <span className="en-caption">{permission.labelEn}</span>
                          </strong>
                          <span className="muted">
                            <span>{permission.description}</span>
                            <span className="en-caption">{permission.descriptionEn}</span>
                          </span>
                        </div>
                      </td>
                      {rolePermissions.map((item) => (
                        <td key={`${item.role}-${permission.key}`}>
                          <label className="toggle-field">
                            <input
                              type="checkbox"
                              name={`${item.role}:${permission.key}`}
                              defaultChecked={item.permissions.get(permission.key) ?? false}
                            />
                            <span>เปิด</span>
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn primary" type="submit">
              บันทึกสิทธิ์
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
