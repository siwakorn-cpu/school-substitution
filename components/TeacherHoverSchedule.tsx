export const hoverWeekDays = [
  { dayOfWeek: 1, label: "จันทร์" },
  { dayOfWeek: 2, label: "อังคาร" },
  { dayOfWeek: 3, label: "พุธ" },
  { dayOfWeek: 4, label: "พฤหัส" },
  { dayOfWeek: 5, label: "ศุกร์" }
];
export const hoverPeriods = Array.from({ length: 10 }, (_, index) => index + 1);

export type HoverScheduleEntry = {
  classRoom: { name: string };
  subject: { name: string };
  specialRoom: { name: string } | null;
};

export function TeacherHoverSchedule({
  name,
  scheduleMap,
  teacherId
}: {
  name: string;
  scheduleMap: Map<string, HoverScheduleEntry>;
  teacherId: string;
}) {
  return (
    <span className="teacher-name-hover no-glossary" tabIndex={0}>
      <strong>{name}</strong>
      <div className="teacher-hover-schedule" role="tooltip">
        <strong>ตารางสอน จันทร์-ศุกร์</strong>
        <table className="teacher-hover-table">
          <thead>
            <tr>
              <th>วัน</th>
              {hoverPeriods.map((period) => (
                <th key={period}>{period}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hoverWeekDays.map((day) => (
              <tr key={day.dayOfWeek}>
                <th>{day.label}</th>
                {hoverPeriods.map((period) => {
                  const schedule = scheduleMap.get(`${teacherId}:${day.dayOfWeek}:${period}`);
                  return (
                    <td key={`${day.dayOfWeek}-${period}`}>
                      {schedule ? (
                        <>
                          <span>{schedule.classRoom.name}</span>
                          <small>{schedule.subject.name}</small>
                          {schedule.specialRoom ? <small>{schedule.specialRoom.name}</small> : null}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </span>
  );
}
