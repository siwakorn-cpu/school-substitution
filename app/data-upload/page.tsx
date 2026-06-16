import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { thaiDays } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { canImportSchedule, canManageTeacher } from "@/lib/rbac";

export default async function DataUploadPage({
  searchParams
}: {
  searchParams: Promise<{
    imported?: string;
    error?: string;
    teacherImported?: string;
    teacherError?: string;
    scheduleTeacherId?: string;
    scheduleTerm?: string;
    scheduleMessage?: string;
    scheduleError?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const canManage = canManageTeacher(user);
  const canImport = canImportSchedule(user);

  const [teachers, departments, classRooms, specialRooms, subjects, terms] = await Promise.all([
    prisma.teacher.findMany({
      include: { department: true },
      orderBy: [{ status: "asc" }, { code: "asc" }]
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.room.findMany({ where: { type: "CLASSROOM", isActive: true }, orderBy: { name: "asc" } }),
    prisma.room.findMany({ where: { type: "SPECIAL", isActive: true }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: [{ code: "asc" }, { name: "asc" }] }),
    prisma.teachingSchedule.findMany({
      distinct: ["term"],
      orderBy: { term: "asc" },
      select: { term: true }
    })
  ]);
  const selectedScheduleTeacherId = params.scheduleTeacherId ?? teachers[0]?.id ?? "";
  const selectedScheduleTerm = params.scheduleTerm ?? terms[0]?.term ?? "1/2569";
  const selectedScheduleTeacher = teachers.find((teacher) => teacher.id === selectedScheduleTeacherId);
  const teacherSchedules = selectedScheduleTeacherId
    ? await prisma.teachingSchedule.findMany({
        where: { teacherId: selectedScheduleTeacherId, term: selectedScheduleTerm },
        include: { classRoom: true, specialRoom: true, subject: true },
        orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }]
      })
    : [];
  const termOptions = Array.from(new Set([selectedScheduleTerm, ...terms.map((item) => item.term), "1/2569"])).filter(
    Boolean
  );

  return (
    <AppShell user={user}>
      <div className="page-head">
        <div>
          <h1>อัพโหลดข้อมูล</h1>
          <p className="muted">จัดการรายชื่อครูและนำเข้าตารางสอนในหน้าเดียว</p>
        </div>
      </div>

      <section className="grid">
        {canManage ? (
          <>
            <div className="card span-4">
              <h2>นำเข้ารายชื่อครู</h2>
              {params.teacherImported ? (
                <p className="badge success">นำเข้าครูสำเร็จ {params.teacherImported} รายการ</p>
              ) : null}
              {params.teacherError ? <p className="error">{decodeURIComponent(params.teacherError)}</p> : null}
              <form className="form" action="/api/teachers/import" method="post" encType="multipart/form-data">
                <label>
                  ไฟล์รายชื่อครู Excel/CSV
                  <input name="file" type="file" accept=".xlsx,.csv" required />
                </label>
                <button className="btn primary" type="submit">
                  นำเข้าครู
                </button>
              </form>
            </div>

            <div className="card span-4">
              <h2>แบบฟอร์มรายชื่อครู</h2>
              <p className="muted">ใช้คอลัมน์ teacher_code, teacher_name, department และ status</p>
              <div className="actions">
                <a className="btn primary" href="/api/teachers/template?format=xlsx">
                  ดาวน์โหลด Excel
                </a>
                <a className="btn" href="/api/teachers/template?format=csv">
                  ดาวน์โหลด CSV
                </a>
              </div>
            </div>
          </>
        ) : null}

        {canImport ? (
          <>
            <div className="card span-4">
              <h2>นำเข้าตารางสอน</h2>
              {params.imported ? <p className="badge success">นำเข้าสำเร็จ {params.imported} รายการ</p> : null}
              {params.error ? <p className="error">{decodeURIComponent(params.error)}</p> : null}
              <form className="form" action="/api/import" method="post" encType="multipart/form-data">
                <label>
                  ภาคเรียน
                  <input name="term" defaultValue="1/2569" required />
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
              <p className="muted">เพิ่มรหัสวิชาในคอลัมน์ subject_code และคาบคู่ใส่ได้ เช่น 2-3</p>
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
                      <th>special_room</th>
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

            <div className="card span-12">
              <h2>แก้ไขตารางสอนของครู</h2>
              <p className="muted">เลือกครูและภาคเรียนเพื่อเพิ่ม แก้ไข หรือลบคาบสอนรายคาบ</p>
              {params.scheduleMessage ? (
                <p className="badge success">{decodeURIComponent(params.scheduleMessage)}</p>
              ) : null}
              {params.scheduleError ? <p className="error">{decodeURIComponent(params.scheduleError)}</p> : null}

              <form className="form compact-form" action="/data-upload" method="get">
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
                    ห้องพิเศษ
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
                <table>
                  <thead>
                    <tr>
                      <th>ครู</th>
                      <th>วัน</th>
                      <th>คาบ</th>
                      <th>ห้องเรียน</th>
                      <th>วิชา</th>
                      <th>ห้องพิเศษ</th>
                      <th>ภาคเรียน</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherSchedules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="muted">
                          ยังไม่มีตารางสอนของ {selectedScheduleTeacher?.name ?? "ครูที่เลือก"} ในภาคเรียนนี้
                        </td>
                      </tr>
                    ) : null}
                    {teacherSchedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <td>{selectedScheduleTeacher?.name}</td>
                        <td colSpan={7}>
                          <form className="actions schedule-edit-form" action="/api/schedules" method="post">
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
                              aria-label="ห้องพิเศษ"
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
                          <form className="actions" action="/api/schedules" method="post">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="id" value={schedule.id} />
                            <input type="hidden" name="scheduleTeacherId" value={selectedScheduleTeacherId} />
                            <input type="hidden" name="scheduleTerm" value={selectedScheduleTerm} />
                            <button className="btn danger" type="submit">
                              ลบ
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                ภาคเรียนที่มีในระบบ: {termOptions.join(", ")}
              </p>
            </div>
          </>
        ) : null}

        {canManage ? (
          <div className="card span-4">
            <h2>เพิ่มครู</h2>
            <form className="form" action="/api/teachers" method="post">
              <input type="hidden" name="intent" value="create" />
              <label>
                รหัสครู
                <input name="code" required />
              </label>
              <label>
                ชื่อครู
                <input name="name" required />
              </label>
              <label>
                กลุ่มสาระ
                <select name="departmentId" required>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn primary" type="submit">
                เพิ่มครู
              </button>
            </form>
          </div>
        ) : null}

        {canManage ? (
          <div className="card span-8">
            <h2>ตั้งค่ากลุ่มสาระ</h2>
            <form className="form" action="/api/departments" method="post">
              <input type="hidden" name="intent" value="create" />
              <div className="form-row">
                <label>
                  ชื่อกลุ่มสาระใหม่
                  <input name="name" placeholder="เช่น สุขศึกษาและพลศึกษา" required />
                </label>
                <div className="actions">
                  <button className="btn primary" type="submit">
                    เพิ่มกลุ่มสาระ
                  </button>
                </div>
              </div>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ชื่อกลุ่มสาระ</th>
                    <th>จำนวนครู</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id}>
                      <td>{department.name}</td>
                      <td>{teachers.filter((teacher) => teacher.departmentId === department.id).length}</td>
                      <td>
                        <form className="actions" action="/api/departments" method="post">
                          <input type="hidden" name="intent" value="update" />
                          <input type="hidden" name="id" value={department.id} />
                          <input name="name" defaultValue={department.name} aria-label="ชื่อกลุ่มสาระ" required />
                          <button className="btn" type="submit">
                            บันทึกชื่อ
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className={`card ${canManage ? "span-8" : ""}`}>
          <h2>รายชื่อครู</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>กลุ่มสาระ</th>
                  <th>สถานะ</th>
                  {canManage ? <th>จัดการ</th> : null}
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.code}</td>
                    <td>{teacher.name}</td>
                    <td>{teacher.department.name}</td>
                    <td>
                      <span className={`badge ${teacher.status === "ACTIVE" ? "success" : "danger"}`}>
                        {teacher.status === "ACTIVE" ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    {canManage ? (
                      <td>
                        <form className="actions" action="/api/teachers" method="post">
                          <input type="hidden" name="intent" value="update" />
                          <input type="hidden" name="id" value={teacher.id} />
                          <input name="name" defaultValue={teacher.name} aria-label="ชื่อครู" />
                          <select name="departmentId" defaultValue={teacher.departmentId} aria-label="กลุ่มสาระ">
                            {departments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                          </select>
                          <select name="status" defaultValue={teacher.status} aria-label="สถานะ">
                            <option value="ACTIVE">ใช้งาน</option>
                            <option value="INACTIVE">ปิดใช้งาน</option>
                          </select>
                          <button className="btn" type="submit">
                            บันทึก
                          </button>
                        </form>
                      </td>
                    ) : null}
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
