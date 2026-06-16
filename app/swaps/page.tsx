import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { canManageSwap } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/date";
import { getSwapCandidates } from "@/lib/swapCandidates";

export default async function SwapsPage({
  searchParams
}: {
  searchParams: Promise<{ absencePeriodId?: string }>;
}) {
  const user = await requireUser();
  if (!canManageSwap(user)) {
    return (
      <AppShell user={user}>
        <p className="error">บัญชีนี้ไม่มีสิทธิ์จัดการแลกคาบ</p>
      </AppShell>
    );
  }
  const params = await searchParams;
  const absencePeriodId = params.absencePeriodId ?? "";
  const isTeacherScoped = user.role === "TEACHER";

  const [periods, requests] = await Promise.all([
    prisma.absencePeriod.findMany({
      where: {
        absence: {
          type: { in: ["OFFICIAL", "PERSONAL"] },
          ...(isTeacherScoped ? { teacherId: user.teacherId ?? "" } : {})
        }
      },
      include: {
        absence: { include: { teacher: true } },
        schedule: { include: { classRoom: true, subject: true } }
      },
      orderBy: [{ absence: { date: "desc" } }, { period: "asc" }],
      take: 50
    }),
    prisma.swapRequest.findMany({
      where: isTeacherScoped
        ? {
            OR: [{ requesterTeacherId: user.teacherId ?? "" }, { targetTeacherId: user.teacherId ?? "" }]
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        requesterTeacher: true,
        targetTeacher: true
      }
    })
  ]);

  const selected = absencePeriodId
    ? await prisma.absencePeriod.findUnique({
        where: { id: absencePeriodId },
        include: {
          absence: { include: { teacher: true } },
          schedule: { include: { classRoom: true, subject: true, specialRoom: true } }
        }
      })
    : null;
  const candidates = selected ? await getSwapCandidates(selected.id) : [];

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>แลกคาบ</h1>
          <p className="muted">สร้างคำขอแลกคาบสำหรับกรณีไปราชการ/ลากิจ และอนุมัติตารางชั่วคราว</p>
        </div>
      </div>

      <section className="grid">
        <div className="card span-4">
          <h2>คาบไปราชการ/ลากิจ</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ครู</th>
                  <th>คาบ</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td>
                      <a href={`/swaps?absencePeriodId=${period.id}`}>{formatThaiDate(period.absence.date)}</a>
                    </td>
                    <td>{period.absence.teacher.name}</td>
                    <td>{period.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card span-8">
          {!selected ? (
            <p className="muted">เลือกคาบไปราชการ/ลากิจเพื่อดูคาบที่สามารถแลกได้</p>
          ) : (
            <>
              <h2>คาบต้นทาง</h2>
              <p>
                {selected.absence.teacher.name} · {formatThaiDate(selected.absence.date)} · คาบ {selected.period} ·{" "}
                {selected.schedule.classRoom.name} · {selected.schedule.subject.name}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>คาบปลายทาง</th>
                      <th>ครู</th>
                      <th>ห้อง/วิชา</th>
                      <th>สร้างคำขอ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((item) => (
                      <tr key={item.id}>
                        <td>คาบ {item.period}</td>
                        <td>{item.teacher.name}</td>
                        <td>
                          {item.classRoom.name} · {item.subject.name}
                          {item.specialRoom ? ` · ${item.specialRoom.name}` : ""}
                        </td>
                        <td>
                          <form action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="create" />
                            <input type="hidden" name="absencePeriodId" value={selected.id} />
                            <input type="hidden" name="toScheduleId" value={item.id} />
                            <button className="btn primary" type="submit">
                              ขอแลก
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>รายการแลกคาบ</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ครูต้นทาง</th>
                  <th>ครูปลายทาง</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{formatThaiDate(request.date)}</td>
                    <td>{request.requesterTeacher.name}</td>
                    <td>{request.targetTeacher.name}</td>
                    <td>
                      <span className={`badge ${request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}`}>
                        {request.status === "APPROVED" ? "อนุมัติ" : request.status === "REJECTED" ? "ไม่อนุมัติ" : "รออนุมัติ"}
                      </span>
                    </td>
                    <td>
                      {request.status === "PENDING" && user.teacherId === request.targetTeacherId ? (
                        <div className="actions">
                          <form action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="approve" />
                            <input type="hidden" name="id" value={request.id} />
                            <button className="btn primary" type="submit">
                              อนุมัติ
                            </button>
                          </form>
                          <form action="/api/swaps" method="post">
                            <input type="hidden" name="intent" value="reject" />
                            <input type="hidden" name="id" value={request.id} />
                            <button className="btn danger" type="submit">
                              ไม่อนุมัติ
                            </button>
                          </form>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
