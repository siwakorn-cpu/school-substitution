"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const GLOSSARY: [string, string][] = [
  ["จัดการการเปลี่ยนแปลงคาบสอน", "Manage schedule changes"],
  ["ระบบจัดครูสอนแทนและแลกคาบ", "Substitution and period swap system"],
  ["ระบบจัดครูสอนแทน", "Teacher substitution system"],
  ["บันทึกการลา/ไปราชการ", "Absence / official duty"],
  ["บันทึกครูลา/ไปราชการ", "Record teacher absence / official duty"],
  ["เลือกครูและวันที่เพื่อดูคาบที่ต้องจัดการ", "Select a teacher and date to view periods that need action"],
  ["กรุณาเลือกครูก่อน", "Please select a teacher first"],
  ["คาบไปราชการ/ลากิจ", "Official duty / personal leave periods"],
  ["จัดสอนแทน", "Assign substitute"],
  ["แลกคาบ", "Swap periods"],
  ["สลับคาบ", "Swap periods"],
  ["เข้าแทน", "Substitute"],
  ["ภาพรวม", "Dashboard"],
  ["สถิติ", "Reports"],
  ["อัพโหลดข้อมูล", "Data upload"],
  ["เลือกหมวดข้อมูลที่ต้องการจัดการ", "Choose a data category to manage"],
  ["ข้อมูลครู", "Teacher data"],
  ["เปิดหน้าข้อมูลครู", "Open teacher data"],
  ["เปิดหน้าตารางสอน", "Open teaching schedule"],
  ["กลับอัพโหลดข้อมูล", "Back to data upload"],
  ["นำเข้า เพิ่ม แก้ไขรายชื่อครู และตั้งค่ากลุ่มสาระ", "Import, add, edit teachers, and configure departments"],
  ["นำเข้า ดาวน์โหลดแบบฟอร์ม และแก้ไขตารางสอนรายคาบ", "Import, download templates, and edit schedule periods"],
  ["เลือกครูและภาคเรียนเพื่อแสดงเฉพาะคาบสอนของครูคนนั้น เพิ่ม แก้ไข หรือลบคาบสอนรายคาบ", "Select a teacher and term to show only that teacher's periods, then add, edit, or delete periods"],
  ["ตารางสอนรายสัปดาห์", "Weekly teaching schedule"],
  ["จัดการผู้ใช้", "Manage users"],
  ["ตั้งค่าระบบ", "System settings"],
  ["กลับตั้งค่าระบบ", "Back to system settings"],
  ["รวมเมนูดูแลระบบที่มีผลกับสิทธิ์ ภาคเรียน และการเริ่มต้นใช้งานใหม่", "Administrative settings for permissions, terms, and restarting system use"],
  ["ปรับสิทธิ์", "Permissions"],
  ["กำหนดสิทธิ์ของครู หัวหน้างานบุคคล หัวหน้ากลุ่มสาระ และตัวแทนกลุ่มสาระ", "Configure permissions for teachers, personnel heads, department heads, and department representatives"],
  ["เริ่มภาคเรียนใหม่", "Start new term"],
  ["สำรองข้อมูลก่อนสร้างภาคเรียนใหม่ และเลือกว่าจะคัดลอกตารางสอนหรือเริ่มจากตารางว่าง", "Back up data before creating a new term, then choose whether to copy schedules or start blank"],
  ["ตั้งค่าภาคเรียนใหม่", "New term settings"],
  ["ภาคเรียนปัจจุบัน", "Current term"],
  ["ระบบจะเปลี่ยนค่าเริ่มต้นเป็นภาคเรียนใหม่หลังยืนยันเท่านั้น", "The system default changes to the new term only after confirmation"],
  ["ภาคเรียนใหม่", "New term"],
  ["ภาคเรียนต้นทาง", "Source term"],
  ["รูปแบบการเริ่มภาคเรียน", "Start mode"],
  ["คัดลอกตารางสอนจากภาคเรียนต้นทาง", "Copy schedules from source term"],
  ["เริ่มแบบตารางว่าง", "Start with blank schedule"],
  ["ก่อนเริ่มภาคเรียนใหม่ ควรสำรองข้อมูลปัจจุบันก่อน", "Back up current data before starting a new term"],
  ["การเริ่มภาคเรียนใหม่จะกำหนดภาคเรียนใหม่เป็นค่าเริ่มต้นของระบบ และอาจคัดลอกตารางสอนตามตัวเลือก", "Starting a new term will set it as the system default and may copy schedules according to your selection"],
  ["สำรองข้อมูลทันที", "Back up now"],
  ["ฉันสำรองข้อมูลแล้ว", "I already backed up"],
  ["ยืนยันเริ่มภาคเรียนใหม่", "Confirm start new term"],
  ["ข้าพเจ้ายืนยันว่าได้สำรองข้อมูลแล้ว และเข้าใจว่าการเริ่มภาคเรียนใหม่จะเปลี่ยนค่าเริ่มต้นของระบบ", "I confirm that I backed up the data and understand the system default will change"],
  ["ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว กรุณาติ๊กยืนยันก่อนเริ่มภาคเรียนใหม่", "Backup file downloaded; tick the confirmation before starting"],
  ["เริ่มต้นระบบใหม่", "Restart system use"],
  ["รีเซ็ตข้อมูลการใช้งานหลังสำรองข้อมูลและยืนยันด้วย RESET", "Reset system data after backup and RESET confirmation"],
  ["สำรองข้อมูลก่อนรีเซ็ต และเลือกขอบเขตข้อมูลที่ต้องการล้าง", "Back up before reset and choose the data scope to clear"],
  ["รีเซ็ตข้อมูลระบบ", "Reset system data"],
  ["ข้อควรระวัง", "Caution"],
  ["ควรดาวน์โหลด backup ทุกครั้งก่อนเริ่มต้นระบบใหม่ หากเลือกเริ่มใหม่ทั้งหมด ระบบจะเก็บเฉพาะบัญชีผู้ดูแลระบบไว้", "Always download a backup before resetting; full reset keeps administrator accounts only"],
  ["รูปแบบการเริ่มต้นระบบใหม่", "Reset mode"],
  ["ล้างเฉพาะข้อมูลการใช้งาน", "Clear usage data only"],
  ["ล้างข้อมูลการใช้งานและตารางสอน", "Clear usage data and schedules"],
  ["เริ่มใหม่ทั้งหมดแต่เก็บบัญชีผู้ดูแลระบบ", "Full reset while keeping administrators"],
  ["ก่อนเริ่มต้นระบบใหม่ ต้องสำรองข้อมูลปัจจุบันก่อน", "Back up current data before restarting system use"],
  ["การเริ่มต้นระบบใหม่จะล้างข้อมูลตามรูปแบบที่เลือก และไม่สามารถย้อนกลับจากหน้าระบบได้", "Resetting clears data according to the selected mode and cannot be undone from the app"],
  ["ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว กรุณาติ๊กยืนยันและพิมพ์ RESET ก่อนเริ่มต้นระบบใหม่", "Backup file downloaded; tick confirmation and type RESET before resetting"],
  ["ข้าพเจ้ายืนยันว่าได้สำรองข้อมูลแล้ว และเข้าใจว่าข้อมูลการใช้งานเดิมจะถูกล้าง", "I confirm that I backed up the data and understand old usage data will be cleared"],
  ["พิมพ์ RESET เพื่อยืนยัน", "Type RESET to confirm"],
  ["ยืนยันเริ่มต้นระบบใหม่", "Confirm system reset"],
  ["กำลังเริ่มต้นระบบใหม่", "Resetting system"],
  ["กำหนดสิทธิ์การใช้งานของครู หัวหน้างานบุคคล หัวหน้ากลุ่มสาระ และตัวแทนกลุ่มสาระ", "Configure permissions for teachers, personnel heads, department heads, and department representatives"],
  ["บันทึกสิทธิ์เรียบร้อยแล้ว", "Permissions saved"],
  ["บันทึกสิทธิ์", "Save permissions"],
  ["สิทธิ์", "Permission"],
  ["บันทึกลา/ไปราชการของตนเอง", "Record own absence / official duty"],
  ["บันทึกลา/ไปราชการให้ทุกคน", "Record absence / official duty for everyone"],
  ["จัดครูสอนแทน", "Manage substitutions"],
  ["จัดการแลกคาบ", "Manage swaps"],
  ["อนุมัติการเปลี่ยนแปลงคาบ", "Approve schedule changes"],
  ["ดู Dashboard สถิติ", "View statistics dashboard"],
  ["Export รูปสรุปสอนแทนรายครู", "Export teacher substitution image"],
  ["Export รูปสรุปสอนแทนรายกลุ่มสาระ", "Export department substitution image"],
  ["Export รูปสรุปสอนแทนรายวัน", "Export daily substitution image"],
  ["จัดการข้อมูลครู", "Manage teacher data"],
  ["จัดการตารางสอน", "Manage teaching schedules"],
  ["เปิด", "On"],
  ["เข้าสู่ระบบ", "Log in"],
  ["ลงทะเบียน", "Register"],
  ["ชื่อผู้ใช้", "Username"],
  ["รหัสผ่าน", "Password"],
  ["ยืนยันรหัสผ่าน", "Confirm password"],
  ["ยังไม่มีบัญชี", "No account yet"],
  ["ส่งคำขอลงทะเบียน", "Submit registration request"],
  ["รอผู้ดูแลระบบอนุมัติ", "Awaiting administrator approval"],
  ["บัญชีครูไม่มีสิทธิ์ดูรายงานรวม", "Teacher accounts cannot view combined reports"],
  ["Dashboard สถิติ", "Statistics dashboard"],
  ["ข้อมูลประจำวันที่", "Information for"],
  ["ครูที่ใช้งานอยู่", "Active teachers"],
  ["คาบรอจัดการ", "Pending periods"],
  ["แลกคาบรออนุมัติ", "Pending swap approvals"],
  ["สอนแทนเดือนนี้", "Substitutions this month"],
  ["รายการของฉัน", "My records"],
  ["ยังไม่มีรายการสอนแทนล่าสุด", "No recent substitution records"],
  ["เปรียบเทียบภาระการเข้าแทนครูแต่ละคน", "Compare substitute load by teacher"],
  ["เลือกช่วงรายงาน", "Select report range"],
  ["ประเภทรายงาน", "Report type"],
  ["รายวัน", "Daily"],
  ["รายเดือน", "Monthly"],
  ["รายภาคเรียน", "By term"],
  ["แสดงรายงาน", "Show report"],
  ["คาบเข้าแทนรวม", "Total substitute periods"],
  ["เข้าแทนมากที่สุด", "Most substitutions"],
  ["ครูในรายงาน", "Teachers in report"],
  ["ภาระการเข้าแทน", "Substitute load"],
  ["รายละเอียดการสอนแทน", "Substitution details"],
  ["วันที่ลา", "Absence date"],
  ["ชื่อครูที่ลา", "Absent teacher name"],
  ["ชื่อครูที่สอนแทน", "Substitute teacher name"],
  ["รหัสวิชา", "Subject code"],
  ["ห้อง ม.", "Class group"],
  ["ไม่พบข้อมูลการสอนแทนในช่วงนี้", "No substitution records in this range"],
  ["จำนวนคาบ", "Number of periods"],
  ["กราฟ", "Chart"],
  ["ค้นหาคาบสอน", "Search teaching periods"],
  ["คาบสอน", "Teaching periods"],
  ["คาบต้นทาง", "Source period"],
  ["คาบปลายทาง", "Target period"],
  ["รายวิชา", "Subject"],
  ["กิจกรรม", "Activity"],
  ["ห้องเรียน", "Classroom"],
  ["ห้อง/อาคาร", "Room / building"],
  ["กลุ่มสาระ", "Department"],
  ["ครูเข้าแทน", "Substitute teacher"],
  ["ครูต้นทาง", "Source teacher"],
  ["ครูปลายทาง", "Target teacher"],
  ["ครูที่ผูก", "Linked teacher"],
  ["ผูกกับครู", "Link to teacher"],
  ["เชื่อมโยงกับครู", "Link to teacher"],
  ["หัวหน้างานบุคคล", "Personnel head"],
  ["หัวหน้ากลุ่มสาระ", "Department head"],
  ["ตัวแทนกลุ่มสาระ", "Department representative"],
  ["ผู้ดูแลระบบ", "Administrator"],
  ["อนุมัติ/ใช้งาน", "Approve / active"],
  ["รออนุมัติ/ปิดใช้งาน", "Pending / inactive"],
  ["รออนุมัติ", "Pending approval"],
  ["ไม่อนุมัติ", "Rejected"],
  ["อนุมัติ", "Approved"],
  ["ใช้งาน", "Active"],
  ["ปิดใช้งาน", "Inactive"],
  ["ไม่มาปฏิบัติงาน", "Absent from duty"],
  ["ลาป่วย(ล่วงหน้า)", "Advance sick leave"],
  ["แจ้งลาป่วย", "Reported sick leave"],
  ["ลาป่วย", "Sick leave"],
  ["ลากิจ", "Personal leave"],
  ["ไปราชการ", "Official duty"],
  ["เลือกครู", "Select teacher"],
  ["เลือกคาบ", "Select period"],
  ["แสดงคาบสอน", "Show periods"],
  ["แสดงรายการ", "Show list"],
  ["ช่วงวันที่", "Date range"],
  ["ทั้งหมด", "All"],
  ["วันนี้", "Today"],
  ["ทุกกลุ่มสาระ", "All departments"],
  ["ประเภท", "Type"],
  ["ถ้ามี", "Optional"],
  ["บันทึกและสร้างรายการจัดการ", "Save and create task"],
  ["ยืนยันเข้าแทน", "Confirm substitution"],
  ["ยืนยันส่งคำขอสลับ", "Confirm swap request"],
  ["แก้ไขการจัดสอนแทน", "Edit substitute assignment"],
  ["ย้อนหลังแก้ไขได้เฉพาะผู้ดูแลระบบ", "Past records can be edited by administrators only"],
  ["บันทึกครูคนนี้", "Save this teacher"],
  ["เลือกครูคนนี้", "Select this teacher"],
  ["กำลังแก้ไขการจัดสอนแทน", "Editing substitute assignment"],
  ["ยกเลิก", "Cancel"],
  ["เสร็จแล้ว", "Done"],
  ["รอจัด", "Pending assignment"],
  ["ล่าสุดก่อน", "Newest first"],
  ["เก่าก่อน", "Oldest first"],
  ["เรียงตามวันที่", "Sort by date"],
  ["เรียงลำดับ", "Sort"],
  ["รายการคาบ", "Period list"],
  ["คาบที่ต้องจัดแทน", "Period needing substitute"],
  ["ครูเดิม", "Original teacher"],
  ["ครูสอนแทนปัจจุบัน", "Current substitute teacher"],
  ["ไม่พบข้อมูลครู", "Teacher data not found"],
  ["ยังไม่พบครูที่ผ่านเงื่อนไขในคาบนี้", "No eligible teacher found for this period"],
  ["ครูที่เลือกไว้", "Selected teacher"],
  ["สร้างคำขอ", "Create request"],
  ["รายการล่าสุด", "Latest records"],
  ["รายการแลกคาบ", "Swap requests"],
  ["หมายเหตุ", "Note"],
  ["เหตุผล", "Reason"],
  ["คำเตือน", "Warning"],
  ["คะแนน", "Score"],
  ["สถานะ", "Status"],
  ["จัดการ", "Manage"],
  ["วันที่", "Date"],
  ["วัน", "Day"],
  ["คาบ", "Period"],
  ["ห้อง", "Room"],
  ["วิชา", "Subject"],
  ["เลือก", "Select"],
  ["บันทึก", "Save"],
  ["ลบครู", "Delete"],
  ["ลบ", "Delete"],
  ["แก้ไข", "Edit"],
  ["เพิ่มผู้ใช้", "Add user"],
  ["นำเข้าผู้ใช้", "Import users"],
  ["นำเข้าผู้ใช้หลายคน", "Bulk import users"],
  ["สร้างบัญชีเข้าสู่ระบบ ตั้งสิทธิ์ตามหน้าที่ และเปิดปิดการใช้งาน", "Create user accounts, set role permissions, and enable or disable access"],
  ["นำเข้าครู", "Import teachers"],
  ["นำเข้ารายชื่อครู", "Import teacher list"],
  ["รายชื่อครู", "Teacher list"],
  ["แบบฟอร์มรายชื่อครู", "Teacher template"],
  ["นำเข้าตารางสอน", "Import teaching schedule"],
  ["ดาวน์โหลดแบบฟอร์ม", "Download template"],
  ["รูปแบบไฟล์", "File format"],
  ["แก้ไขตารางสอนของครู", "Edit teacher schedule"],
  ["แสดงตาราง", "Show schedule"],
  ["เพิ่มคาบ", "Add period"],
  ["เพิ่มครู", "Add teacher"],
  ["ตั้งค่ากลุ่มสาระ", "Department settings"],
  ["ชื่อกลุ่มสาระใหม่", "New department name"],
  ["เพิ่มกลุ่มสาระ", "Add department"],
  ["ชื่อกลุ่มสาระ", "Department name"],
  ["จำนวนครู", "Teacher count"],
  ["บันทึกชื่อ", "Save name"],
  ["รหัสครู", "Teacher code"],
  ["ชื่อครู", "Teacher name"],
  ["ไม่ใช้", "Not used"],
  ["ภาคเรียนที่มีในระบบ", "Terms in system"],
  ["แบบฟอร์มผู้ใช้", "User template"],
  ["บัญชีผู้ใช้", "User accounts"],
  ["รหัสผ่านเริ่มต้น", "Initial password"],
  ["ไม่ผูกกับครู", "No linked teacher"],
  ["ดาวน์โหลด", "Download"],
  ["นำเข้า", "Import"],
  ["ไฟล์ผู้ใช้", "User file"],
  ["ไฟล์รายชื่อครู", "Teacher list file"],
  ["ไฟล์ CSV/XLSX", "CSV/XLSX file"],
  ["ไฟล์", "File"],
  ["สิทธิ์", "Role"],
  ["สถานะ", "Status"],
  ["รหัสใหม่", "New password"],
  ["ผลลัพธ์", "Result"],
  ["ต้นทาง", "Source"],
  ["ปลายทาง", "Target"],
  ["ผ่านเงื่อนไข", "Valid"],
  ["แตกคาบคู่", "Split double period"],
  ["วันเดิม", "Same day"],
  ["คาบเดิม", "Same period"],
  ["ห้องเดิม", "Same room"],
  ["รายวิชาเดิม", "Same subject"],
  ["เปลี่ยนเฉพาะ", "Change only"],
  ["ตรวจ", "Check"],
  ["ไม่สอนซ้อน", "No teaching conflict"],
  ["ไม่พบ", "Not found"],
  ["กรุณา", "Please"],
  ["ออก", "Log out"],
  ["จันทร์", "Monday"],
  ["อังคาร", "Tuesday"],
  ["พุธ", "Wednesday"],
  ["พฤหัสบดี", "Thursday"],
  ["ศุกร์", "Friday"],
  ["เสาร์", "Saturday"],
  ["อาทิตย์", "Sunday"],
  ["ประวัติการใช้งาน", "Activity log"],
  ["ดูว่ามีการเพิ่ม/แก้ไข/ลบข้อมูลอะไรบ้าง โดยใคร และเมื่อไหร่", "See what data was added, changed, or deleted, by whom, and when"],
  ["บันทึกการเพิ่ม/แก้ไข/ลบข้อมูลสำคัญในระบบ โดยใคร และเมื่อไหร่ (แสดงล่าสุด 300 รายการ)", "Logs additions, edits, and deletions of key data, by whom and when (latest 300 shown)"],
  ["ค้นหาชื่อผู้ใช้", "Search username"],
  ["กรอง", "Filter"],
  ["ล้างตัวกรอง", "Clear filter"],
  ["ไม่พบรายการ", "No records found"],
  ["เวลา", "Time"],
  ["ผู้ใช้", "User"],
  ["บทบาท", "Role"],
  ["การกระทำ", "Action"],
  ["ประเภทข้อมูล", "Data type"],
  ["รายละเอียด", "Details"],
  ["เพิ่ม", "Add"],
  ["ปิดการใช้งาน", "Deactivate"],
  ["นำเข้า", "Import"],
  ["จัดครูสอนแทน", "Assign substitute"],
  ["ขอเข้าสอนแทน", "Request substitute"],
  ["อนุมัติเข้าสอนแทน", "Approve substitute"],
  ["ปฏิเสธเข้าสอนแทน", "Reject substitute"],
  ["ยกเลิกเข้าสอนแทน", "Cancel substitute"],
  ["สร้างคำขอสลับคาบ", "Create swap request"],
  ["แก้ไขคำขอสลับคาบ", "Update swap request"],
  ["ยกเลิกคำขอสลับคาบ", "Cancel swap request"],
  ["อนุมัติสลับคาบ", "Approve swap"],
  ["ไม่อนุมัติสลับคาบ", "Reject swap"],
  ["กู้คืนข้อมูล", "Restore backup"]
];

const THAI_TO_ENGLISH = [...GLOSSARY].sort((a, b) => b[0].length - a[0].length);

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "SVG"]);
const THAI_PATTERN = /[\u0E00-\u0E7F]/;

export function BilingualGlossary() {
  const pathname = usePathname();

  useEffect(() => {
    const applyGlossary = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest("[data-bilingual-processed], .en-caption, .no-glossary")) return NodeFilter.FILTER_REJECT;
          if (!THAI_PATTERN.test(node.textContent ?? "")) return NodeFilter.FILTER_REJECT;
          if (!findNextMatch(node.textContent ?? "", 0)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      nodes.forEach(replaceTextNode);
    };

    let frame = 0;
    const scheduleGlossary = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyGlossary);
    };

    scheduleGlossary();
    const secondPass = window.setTimeout(scheduleGlossary, 600);
    const observer = new MutationObserver(scheduleGlossary);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(secondPass);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}

function replaceTextNode(node: Text) {
  const text = node.textContent ?? "";
  const matches = findMatches(text);

  if (shouldGroupTextNode(text, matches)) {
    const container = document.createElement("span");
    container.className = "bilingual-processed";
    container.dataset.bilingualProcessed = "true";

    const leadingWhitespace = text.match(/^\s*/)?.[0] ?? "";
    const trailingWhitespace = text.match(/\s*$/)?.[0] ?? "";
    const trimmedText = text.trim();

    if (leadingWhitespace) container.append(leadingWhitespace);
    container.append(createBilingualWrapper(trimmedText, matches.map((match) => match.english).join(" / "), "grouped"));
    if (trailingWhitespace) container.append(trailingWhitespace);

    node.replaceWith(container);
    return;
  }

  const container = document.createElement("span");
  container.className = "bilingual-processed";
  container.dataset.bilingualProcessed = "true";
  let index = 0;

  while (index < text.length) {
    const match = findNextMatch(text, index);

    if (!match) {
      container.append(text.slice(index));
      break;
    }

    if (match.index > index) {
      container.append(text.slice(index, match.index));
    }

    container.append(createBilingualWrapper(match.thai, match.english));
    index = match.index + match.thai.length;
  }

  node.replaceWith(container);
}

function createBilingualWrapper(thai: string, english: string, variant?: "grouped") {
  const wrapper = document.createElement("span");
  wrapper.className = variant === "grouped" ? "bilingual-text bilingual-text-grouped" : "bilingual-text";
  wrapper.dataset.bilingualProcessed = "true";

  const thaiText = document.createElement("span");
  thaiText.className = "th-caption";
  thaiText.textContent = thai;
  wrapper.append(thaiText);

  const caption = document.createElement("span");
  caption.className = "en-caption";
  caption.lang = "en";
  caption.textContent = english;
  wrapper.append(caption);

  return wrapper;
}

function findMatches(text: string) {
  const matches: { thai: string; english: string; index: number }[] = [];
  let index = 0;

  while (index < text.length) {
    const match = findNextMatch(text, index);
    if (!match) break;
    matches.push(match);
    index = match.index + match.thai.length;
  }

  return matches;
}

function shouldGroupTextNode(text: string, matches: { thai: string; english: string; index: number }[]) {
  if (matches.length === 0) return false;
  const trimmedText = text.trim();
  if (matches.length > 1) return true;
  return trimmedText !== matches[0].thai;
}

function findNextMatch(text: string, startIndex: number) {
  let next: { thai: string; english: string; index: number } | null = null;

  for (const [thai, english] of THAI_TO_ENGLISH) {
    const index = text.indexOf(thai, startIndex);
    if (index === -1) continue;
    if (!next || index < next.index || (index === next.index && thai.length > next.thai.length)) {
      next = { thai, english, index };
    }
  }

  return next;
}
