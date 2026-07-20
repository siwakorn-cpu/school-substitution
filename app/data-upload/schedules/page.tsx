import { AppShell } from "@/components/AppShell";
import { SaveToast } from "@/components/SaveToast";
import { requireUser } from "@/lib/auth";
import { thaiDays } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { canImportSchedule } from "@/lib/rbac";
import { getTermOptions } from "@/lib/terms";

export default async function ScheduleDataPage({
  searchParams
}: {
  searchParams: Promise<{
    imported?: string;
    error?: string;
    scheduleTeacherId?: string;
    scheduleTerm?: string;
    scheduleMessage?: string;
    scheduleError?: string;
    editScheduleId?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const canImport = await canImportSchedule(user);

  if (!canImport) {
    return (
      <AppShell user={user}>
        <p className="error">บัญชีนี้ไม่มีสิทธิ์จัดการตารางสอน</p>
      </AppShell>
    );
  }

  const [teachers, classRooms, specialRooms, subjects, termData] = await Promise.all([
    prisma.teacher.findMany({
      include: { department: true },
      orderBy: [{ status: "asc" }, { code: "asc" }]
    }),
    prisma.room.findMany({ where: { type: "CLASSROOM", isActive: true }, orderBy: { name: "asc" } }),
    prisma.room.findMany({ where: { type: "SPECIAL", isActive: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: [{ code: "asc" }, { name: "asc" }] }),
    getTermOptions()
  ]);
  const selectedScheduleTeacherId = params.scheduleTeacherId ?? teachers[0]?.id ?? "";
  const selectedScheduleTerm = params.scheduleTerm ?? termData.currentTerm;
  const selectedScheduleQuery = new URLSearchParams({
    scheduleTeacherId: selectedScheduleTeacherId,
    scheduleTerm: selectedScheduleTerm
  });
  const selectedScheduleTeacher = teachers.find((teacher) => teacher.id === selectedScheduleTeacherId);
  const teacherSchedules = selectedScheduleTeacherId
    ? await prisma.teachingSchedule.findMany({
        where: { teacherId: selectedScheduleTeacherId, term: selectedScheduleTerm },
        include: { classRoom: true, specialRoom: true, subject: true },
        orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }]
      })
    : [];
  const termOptions = Array.from(new Set([selectedScheduleTerm, ...termData.terms])).filter(Boolean);
  const weekdayIndexes = [1, 2, 3, 4, 5];
  const periods = Array.from({ length: 10 }, (_, index) => index + 1);
  const scheduleByDayPeriod = new Map(
    teacherSchedules.map((schedule) => [`${schedule.dayOfWeek}-${schedule.period}`, schedule])
  );
  const activityPeriods = await prisma.activityPeriod.findMany();
  const activityByDayPeriod = new Map(
    activityPeriods.map((activity) => [`${activity.dayOfWeek}-${activity.period}`, activity])
  );

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>ตารางสอน</h1>
          <p className="muted">นำเข้า ดาวน์โหลดแบบฟอร์ม และแก้ไขตารางสอนรายคาบ</p>
        </div>
        <a className="btn" href="/data-upload">
          กลับอัพโหลดข้อมูล
        </a>
      </div>

      <section className="grid">
        <div className="card span-4">
          <h2>นำเข้าตารางสอน</h2>
          {params.imported ? <p className="badge success">นำเข้าสำเร็จ {params.imported} รายการ</p> : null}
          {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}
          <form className="form" action="/api/import" method="post" encType="multipart/form-data">
            <label>
              ภาคเรียน
              <input name="term" defaultValue={selectedScheduleTerm} required />
            </label>
            <label>
              ไฟล์ CSV/XLSX
              <input name="file" type="file" accept=".csv,.xlsx" required />
            </label>
            <button className="btn primary" type="submit">
              นำเข้า
            </button>
          </form>
        </div>

        <div className="card span-4">
          <h2>ดาวน์โหลดแบบฟอร์ม</h2>
          <p className="muted">เพิ่มรหัสวิชาในคอลัมน์ subject_code ห้อง/อาคารในคอลัมน์ room_building และคาบคู่ใส่ได้ เช่น 2-3</p>
          <div className="actions">
            <a className="btn primary" href="/api/import/template?format=xlsx">
              ดาวน์โหลด Excel
            </a>
            <a className="btn" href="/api/import/template?format=csv">
              ดาวน์โหลด CSV
            </a>
          </div>
        </div>

        <div className="card span-4">
          <h2>รูปแบบไฟล์</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>teacher_code</th>
                  <th>day</th>
                  <th>period</th>
                  <th>class_room</th>
                  <th>subject_code</th>
                  <th>subject</th>
                  <th>room_building</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>T001</td>
                  <td>จันทร์</td>
                  <td>1</td>
                  <td>ม.1/1</td>
                  <td>ค21101</td>
                  <td>คณิตศาสตร์</td>
                  <td></td>
                </tr>
                <tr>
                  <td>T003</td>
                  <td>อังคาร</td>
                  <td>2-3</td>
                  <td>ม.2/1</td>
                  <td>ว21101</td>
                  <td>วิทยาศาสตร์</td>
                  <td>ห้องวิทย์ 1</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card span-12 schedule-editor-section">
          <h2>แก้ไขตารางสอนของครู</h2>
          <p className="muted">เลือกครูและภาคเรียนเพื่อแสดงเฉพาะคาบสอนของครูคนนั้น เพิ่ม แก้ไข หรือลบคาบสอนรายคาบ</p>
          {params.scheduleMessage ? (
            <SaveToast message={decodeURIComponent(params.scheduleMessage)} paramName="scheduleMessage" />
          ) : null}
          {params.scheduleError ? <p className="error">{decodeURIComponent(params.scheduleError)}</p> : null}

          <form className="form compact-form" action="/data-upload/schedules" method="get">
            <div className="form-row">
              <label>
                ครู
                <select name="scheduleTeacherId" defaultValue={selectedScheduleTeacherId} required>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.code} - {teacher.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ภาคเรียน
                <input name="scheduleTerm" defaultValue={selectedScheduleTerm} required />
              </label>
              <div className="actions">
                <button className="btn primary" type="submit">
                  แสดงตาราง
                </button>
              </div>
            </div>
          </form>

          <div className="weekly-schedule-panel">
            <h3>ตารางสอนรายสัปดาห์</h3>
            <div className="table-wrap">
              <table className="weekly-schedule-table">
                <thead>
                  <tr>
                    <th>วัน</th>
                    {periods.map((period) => (
                      <th key={period}>{period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekdayIndexes.map((dayIndex) => (
                    <tr key={dayIndex}>
                      <th>{thaiDays[dayIndex]}</th>
                      {periods.map((period) => {
                        const schedule = scheduleByDayPeriod.get(`${dayIndex}-${period}`);
                        const activity = activityByDayPeriod.get(`${dayIndex}-${period}`);
                        const isClub = activity?.type === "CLUB";
                        const showScoutLabel = activity?.type === "SCOUT" && !schedule;

                        return (
                          <td key={period}>
                            {isClub ? (
                              <div className="schedule-cell-activity">
                                <strong>ชุมนุม</strong>
                                <span>แลกคาบไม่ได้</span>
                              </div>
                            ) : showScoutLabel ? (
                              <div className="schedule-cell-activity">
                                <strong>ลูกเสือ</strong>
                                <span>เนตรนารี ยุวกาชาด</span>
                              </div>
                            ) : schedule ? (
                              <a
                                className="schedule-cell-link"
                                href={`/data-upload/schedules?${new URLSearchParams({
                                  ...Object.fromEntries(selectedScheduleQuery),
                                  editScheduleId: schedule.id
                                }).toString()}#schedule-${schedule.id}`}
                              >
                                <strong>
                                  {schedule.subject.code ? `${schedule.subject.code} ` : ""}
                                  {schedule.subject.name}
                                </strong>
                                <span>{schedule.classRoom.name}</span>
                                {schedule.specialRoom ? <span>{schedule.specialRoom.name}</span> : null}
                              </a>
                            ) : (
                              <details className="empty-schedule-add">
                                <summary>+</summary>
                                <form className="weekly-add-form" action="/api/schedules" method="post">
                                  <input type="hidden" name="intent" value="create" />
                                  <input type="hidden" name="teacherId" value={selectedScheduleTeacherId} />
                                  <input type="hidden" name="scheduleTeacherId" value={selectedScheduleTeacherId} />
                                  <input type="hidden" name="scheduleTerm" value={selectedScheduleTerm} />
                                  <input type="hidden" name="dayOfWeek" value={dayIndex} />
                                  <input type="hidden" name="period" value={period} />
                                  <label>
                                    ห้องเรียน
                                    <select name="classRoomId" required>
                                      {classRooms.map((room) => (
                                        <option key={room.id} value={room.id}>
                                          {room.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    วิชา
                                    <select name="subjectId" required>
                                      {subjects.map((subject) => (
                                        <option key={subject.id} value={subject.id}>
                                          {subject.code ? `${subject.code} - ` : ""}
                                          {subject.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    ห้อง/อาคาร
                                    <select name="specialRoomId" defaultValue="">
                                      <option value="">ไม่ใช้</option>
                                      {specialRooms.map((room) => (
                                        <option key={room.id} value={room.id}>
                                          {room.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    ภาคเรียน
                                    <input name="term" defaultValue={selectedScheduleTerm} required />
                                  </label>
                                  <button className="btn primary" type="submit" disabled={!selectedScheduleTeacherId}>
                                    เพิ่มคาบ
                                  </button>
                                </form>
                              </details>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form className="form compact-form" action="/api/schedules" method="post">
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="teacherId" value={selectedScheduleTeacherId} />
            <input type="hidden" name="scheduleTeacherId" value={selectedScheduleTeacherId} />
            <input type="hidden" name="scheduleTerm" value={selectedScheduleTerm} />
            <div className="form-row">
              <label>
                วัน
                <select name="dayOfWeek" required>
                  {thaiDays.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                คาบ
                <select name="period" required>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ห้องเรียน
                <select name="classRoomId" required>
                  {classRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                วิชา
                <select name="subjectId" required>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code ? `${subject.code} - ` : ""}
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ห้อง/อาคาร
                <select name="specialRoomId" defaultValue="">
                  <option value="">ไม่ใช้</option>
                  {specialRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ภาคเรียน
                <input name="term" defaultValue={selectedScheduleTerm} required />
              </label>
              <div className="actions">
                <button className="btn primary" type="submit" disabled={!selectedScheduleTeacherId}>
                  เพิ่มคาบ
                </button>
              </div>
            </div>
          </form>

          <div className="table-wrap">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>ครู</th>
                  <th>วัน</th>
                  <th>คาบ</th>
                  <th>ห้องเรียน</th>
                  <th>วิชา</th>
                  <th>ห้อง/อาคาร</th>
                  <th>ภาคเรียน</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {teacherSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      ยังไม่มีตารางสอนของ{" "}
                      <span className="no-glossary">{selectedScheduleTeacher?.name ?? "ครูที่เลือก"}</span> ในภาคเรียนนี้
                    </td>
                  </tr>
                ) : null}
                {teacherSchedules.map((schedule) => (
                  <tr id={`schedule-${schedule.id}`} key={schedule.id}>
                    <td className="no-glossary">{selectedScheduleTeacher?.name}</td>
                    <td>{thaiDays[schedule.dayOfWeek]}</td>
                    <td>{schedule.period}</td>
                    <td>{schedule.classRoom.name}</td>
                    <td>
                      {schedule.subject.code ? `${schedule.subject.code} - ` : ""}
                      {schedule.subject.name}
                    </td>
                    <td>{schedule.specialRoom?.name ?? "-"}</td>
                    <td>{schedule.term}</td>
                    <td>
                      <div className="schedule-row-actions">
                        <details className="schedule-edit-toggle" open={params.editScheduleId === schedule.id}>
                          <summary>แก้ไข</summary>
                          <form className="schedule-edit-form" action="/api/schedules" method="post">
                            <input type="hidden" name="intent" value="update" />
                            <input type="hidden" name="id" value={schedule.id} />
                            <input type="hidden" name="teacherId" value={schedule.teacherId} />
                            <input type="hidden" name="scheduleTeacherId" value={selectedScheduleTeacherId} />
                            <input type="hidden" name="scheduleTerm" value={selectedScheduleTerm} />
                            <select name="dayOfWeek" defaultValue={schedule.dayOfWeek} aria-label="วัน">
                              {thaiDays.map((day, index) => (
                                <option key={day} value={index}>
                                  {day}
                                </option>
                              ))}
                            </select>
                            <select name="period" defaultValue={schedule.period} aria-label="คาบ">
                              {Array.from({ length: 10 }, (_, index) => index + 1).map((period) => (
                                <option key={period} value={period}>
                                  {period}
                                </option>
                              ))}
                            </select>
                            <select name="classRoomId" defaultValue={schedule.classRoomId} aria-label="ห้องเรียน">
                              {classRooms.map((room) => (
                                <option key={room.id} value={room.id}>
                                  {room.name}
                                </option>
                              ))}
                            </select>
                            <select name="subjectId" defaultValue={schedule.subjectId} aria-label="วิชา">
                              {subjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>
                                  {subject.code ? `${subject.code} - ` : ""}
                                  {subject.name}
                                </option>
                              ))}
                            </select>
                            <select
                              name="specialRoomId"
                              defaultValue={schedule.specialRoomId ?? ""}
                              aria-label="ห้อง/อาคาร"
                            >
                              <option value="">ไม่ใช้</option>
                              {specialRooms.map((room) => (
                                <option key={room.id} value={room.id}>
                                  {room.name}
                                </option>
                              ))}
                            </select>
                            <input name="term" defaultValue={schedule.term} aria-label="ภาคเรียน" />
                            <button className="btn" type="submit">
                              บันทึก
                            </button>
                          </form>
                        </details>
                        <form action="/api/schedules" method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={schedule.id} />
                          <input type="hidden" name="scheduleTeacherId" value={selectedScheduleTeacherId} />
                          <input type="hidden" name="scheduleTerm" value={selectedScheduleTerm} />
                          <button className="btn danger" type="submit">
                            ลบ
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">ภาคเรียนที่มีในระบบ: {termOptions.join(", ")}</p>
        </div>
      </section>
    </AppShell>
  );
}
