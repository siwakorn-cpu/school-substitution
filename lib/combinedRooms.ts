/**
 * การคุมควบข้ามห้อง (ครูที่สอนห้องย่อยหนึ่งของกลุ่มควบ เข้าแทนห้องย่อยอื่นในกลุ่มเดียวกัน)
 * เปิดใช้เฉพาะกลุ่มสาระภาษาต่างประเทศ ตามนโยบายของโรงเรียน
 */
export const COMBINED_COVER_DEPARTMENT = "ภาษาต่างประเทศ";

export function departmentAllowsCombinedCover(departmentName: string) {
  return departmentName.includes(COMBINED_COVER_DEPARTMENT);
}

export type ParsedClassRoom = {
  level: number;
  sections: number[];
  /** ชื่อห้องครอบคลุมมากกว่า 1 ห้องย่อย เช่น "6/1,2" หรือ "6/1-8" */
  isCombined: boolean;
  /** ห้องควบทั้งปี (รูปแบบจุลภาค เช่น "6/1,2" "5/5,6,7") — เรียนด้วยกันเป็นหลัก บางวิชาแยกเรียน */
  isYearLongCombined: boolean;
};

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function toArabicDigits(value: string) {
  return value.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)));
}

export function parseClassRoomName(name: string): ParsedClassRoom | null {
  const normalized = toArabicDigits(name)
    .replace(/ม\.?/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
    .trim();
  const match = normalized.match(/^(\d+)\/(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)$/);

  if (!match) return null;

  const level = Number(match[1]);
  const sections: number[] = [];
  let hasRange = false;

  for (const token of match[2].split(",")) {
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start <= 0 || end < start) return null;
      hasRange = true;
      for (let section = start; section <= end; section += 1) sections.push(section);
    } else {
      const section = Number(token);
      if (!Number.isInteger(section) || section <= 0) return null;
      sections.push(section);
    }
  }

  if (!Number.isInteger(level) || level <= 0 || sections.length === 0) return null;

  const uniqueSections = [...new Set(sections)].sort((a, b) => a - b);

  return {
    level,
    sections: uniqueSections,
    isCombined: uniqueSections.length > 1,
    isYearLongCombined: uniqueSections.length > 1 && !hasRange
  };
}

/**
 * สองชื่อห้องมีห้องย่อยซ้อนทับกันหรือไม่ เช่น "6/1,2" กับ "6/1" หรือ "1/5-8" กับ "1/6"
 * ใช้เช็คคาบชน: นักเรียนกลุ่มเดียวกันไม่ควรมีตารางสอนซ้อนกันในคาบเดียวกัน
 * ถ้าชื่อฝั่งใดฝั่งหนึ่งอ่านไม่ออก จะถอยไปเทียบชื่อตรงกันแทน
 */
export function classRoomsOverlap(nameA: string, nameB: string) {
  const a = parseClassRoomName(nameA);
  const b = parseClassRoomName(nameB);
  if (!a || !b) return nameA.trim() === nameB.trim();
  if (a.level !== b.level) return false;
  return a.sections.some((section) => b.sections.includes(section));
}

/** สองชื่อห้องคือนักเรียนกลุ่มเดียวกันเป๊ะ ๆ (ระดับและห้องย่อยตรงกันทั้งหมด) */
export function sameStudentGroup(nameA: string, nameB: string) {
  const a = parseClassRoomName(nameA);
  const b = parseClassRoomName(nameB);
  if (!a || !b) return nameA.trim() === nameB.trim();
  return (
    a.level === b.level &&
    a.sections.length === b.sections.length &&
    a.sections.every((section, index) => section === b.sections[index])
  );
}

export type CombinedRoomGroup = {
  level: number;
  sections: number[];
};

/**
 * รวบรวมกลุ่มห้องควบทั้งปีจากชื่อห้องที่มีอยู่ในระบบ
 * เฉพาะรูปแบบจุลภาค ("6/1,2") เท่านั้น — รูปแบบขีด ("6/1-8") คือเรียนร่วมบางคาบ ไม่ใช่กลุ่มควบถาวร
 */
export function buildYearLongCombinedGroups(roomNames: string[]): CombinedRoomGroup[] {
  const groups: CombinedRoomGroup[] = [];
  const seen = new Set<string>();

  for (const name of roomNames) {
    const parsed = parseClassRoomName(name);
    if (!parsed?.isYearLongCombined) continue;
    const key = `${parsed.level}/${parsed.sections.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({ level: parsed.level, sections: parsed.sections });
  }

  return groups;
}

/**
 * ครูที่ติดสอนห้อง currentRoomName อยู่ สามารถคุมห้อง targetRoomName ควบไปด้วยได้หรือไม่
 * ได้เมื่อ (1) ห้องซ้อนทับกันอยู่แล้ว เช่น สอน "6/1,2" และห้องเป้าหมายคือ "6/1"
 * หรือ (2) ทั้งสองห้องอยู่ในกลุ่มห้องควบทั้งปีเดียวกัน เช่น สอน "6/1" คุม "6/2" ได้เพราะมีกลุ่ม "6/1,2"
 */
export function canCoverCombinedClassRoom(
  currentRoomName: string,
  targetRoomName: string,
  yearLongGroups: CombinedRoomGroup[]
) {
  const current = parseClassRoomName(currentRoomName);
  const target = parseClassRoomName(targetRoomName);

  if (!current || !target) return false;
  if (current.level !== target.level) return false;

  if (target.sections.some((section) => current.sections.includes(section))) return true;

  return yearLongGroups.some(
    (group) =>
      group.level === current.level &&
      current.sections.every((section) => group.sections.includes(section)) &&
      target.sections.every((section) => group.sections.includes(section))
  );
}
