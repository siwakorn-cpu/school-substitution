type ParsedClassRoom = {
  level: number;
  sections: number[];
};

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function toArabicDigits(value: string) {
  return value.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)));
}

export function parseClassRoomName(name: string): ParsedClassRoom | null {
  const normalized = toArabicDigits(name)
    .replace(/ม\.?/g, "")
    .replace(/\s+/g, "")
    .trim();
  const match = normalized.match(/^(\d+)\/(\d+(?:,\d+)*)$/);

  if (!match) return null;

  const level = Number(match[1]);
  const sections = match[2]
    .split(",")
    .map(Number)
    .filter((section) => Number.isInteger(section) && section > 0);

  if (!Number.isInteger(level) || level <= 0 || sections.length === 0) return null;

  return { level, sections };
}

export function canCoverPairedClassRoom(currentRoomName: string, targetRoomName: string) {
  const current = parseClassRoomName(currentRoomName);
  const target = parseClassRoomName(targetRoomName);

  if (!current || !target) return false;
  if (current.level !== target.level) return false;
  if (current.sections.length !== 1 || target.sections.length !== 1) return false;

  const currentSection = current.sections[0];
  const targetSection = target.sections[0];
  const samePair = Math.ceil(currentSection / 2) === Math.ceil(targetSection / 2);

  return samePair && Math.abs(currentSection - targetSection) === 1;
}
