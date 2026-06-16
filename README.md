# ระบบจัดครูสอนแทนและแลกคาบ

เว็บแอปภาษาไทยสำหรับนำเข้าตารางสอน บันทึกครูลา/ไปราชการ จัดครูสอนแทน แลกคาบ และดูสถิติ พัฒนาด้วย Next.js, TypeScript, Prisma และ PostgreSQL

## สิ่งที่ต้องรู้ก่อน Deploy

- ระบบ production ใช้ PostgreSQL ไม่ใช้ไฟล์ SQLite เพราะไฟล์ใน Render Web Service อาจหายเมื่อ restart หรือ deploy ใหม่
- ไฟล์ `render.yaml` เตรียม Render Web Service ให้พร้อม โดยใช้ PostgreSQL จาก Aiven
- Render จะรัน database migration อัตโนมัติก่อนเปิดเวอร์ชันใหม่
- Render จะสร้างบัญชีผู้ดูแลระบบครั้งแรกจาก username/password ที่กรอกตอนสร้าง Blueprint
- `SESSION_SECRET` ถูกสร้างแบบสุ่มโดย Render และ cookie session มีลายเซ็นป้องกันการแก้ค่า
- ข้อมูลเก่าใน `prisma/dev.db` ไม่ถูกย้ายไป PostgreSQL อัตโนมัติ

> คำเตือนเรื่องแพ็กเกจฟรี: Render Free Web Service จะพักเมื่อไม่มีผู้เข้า 15 นาทีและการเปิดครั้งถัดไปอาจรอประมาณ 1 นาที ส่วน Aiven PostgreSQL Free ใช้ได้ไม่จำกัดเวลาและมี backup แต่จำกัด 1 GB disk, 1 GB RAM, 20 connections, ไม่มี SLA, ไม่มี connection pooling และ Aiven อาจปิด service ที่ไม่ได้ใช้นานหลังส่งแจ้งเตือน ระบบใช้งานจริงของโรงเรียนควรอัปเกรดแพ็กเกจเมื่อเริ่มมีข้อมูลสำคัญ

## Deploy แบบทีละขั้นตอน

### 1. สมัครบัญชีที่จำเป็น

1. เปิด [GitHub](https://github.com/) แล้วกด `Sign up` หากยังไม่มีบัญชี
2. เปิด [Render](https://dashboard.render.com/register) แล้วสมัครด้วยบัญชี GitHub
3. เปิด [Aiven Console](https://console.aiven.io/) แล้วสมัครบัญชี Aiven
4. เมื่อ Render ขอสิทธิ์เข้าถึง GitHub ให้กดยอมรับ สามารถเลือกให้เข้าถึงเฉพาะ repository นี้ได้

### 2. สร้าง PostgreSQL ฟรีบน Aiven

1. เข้า [Aiven Console](https://console.aiven.io/)
2. กด `Create service`
3. เลือก `PostgreSQL`
4. เลือก plan เป็น `Free`
5. เลือก region ที่ใกล้ไทยที่สุดที่ Aiven เปิดให้ใช้ในบัญชีของคุณ เช่น Singapore หากมีให้เลือก
6. ตั้งชื่อ service เช่น `school-substitution-db`
7. กด `Create service`
8. รอจนสถานะเป็น `Running`
9. เปิดหน้า service แล้วหาเมนู `Connection information`
10. คัดลอกค่า `Service URI` หรือ `Connection URI` ซึ่งหน้าตาประมาณนี้:

```text
postgres://avnadmin:YOUR_PASSWORD@HOST.aivencloud.com:PORT/defaultdb?sslmode=require
```

11. เก็บค่านี้ไว้ชั่วคราวเพื่อไปใส่ใน Render เป็น `DATABASE_URL`

ถ้า URI ที่คัดลอกมาไม่มี `?sslmode=require` ให้เติมท้าย URL เอง เช่น:

```text
postgres://avnadmin:YOUR_PASSWORD@HOST.aivencloud.com:PORT/defaultdb?sslmode=require
```

ห้าม commit หรือส่ง `DATABASE_URL` ขึ้น GitHub เพราะมีรหัสผ่านฐานข้อมูลอยู่ในนั้น

### 3. สร้าง GitHub repository

วิธีง่ายสำหรับคนไม่ถนัด Terminal คือใช้ GitHub Desktop

1. ดาวน์โหลดและติดตั้ง [GitHub Desktop](https://desktop.github.com/)
2. เปิดโปรแกรมและ Sign in ด้วยบัญชี GitHub
3. เลือกเมนู `File` > `Add Local Repository...`
4. เลือกโฟลเดอร์โปรเจกต์ `/Users/siwbook/Documents/ClaudeCode`
5. หากแจ้งว่าโฟลเดอร์นี้ยังไม่ใช่ Git repository ให้กด `create a repository`
6. ตั้งชื่อ เช่น `school-substitution`
7. ไม่ต้องเลือกสร้าง README หรือ `.gitignore` เพิ่ม เพราะโปรเจกต์มีอยู่แล้ว
8. กด `Create Repository`
9. ที่ช่อง Summary พิมพ์ `Prepare PostgreSQL deployment on Render`
10. กด `Commit to main`
11. กด `Publish repository`
12. แนะนำให้ยกเลิก `Keep this code private` เฉพาะกรณีต้องการ repository สาธารณะ หากมีข้อมูลหรือโค้ดภายในให้คงเป็น Private
13. กด `Publish Repository`

ตรวจบนเว็บไซต์ GitHub ว่ามีไฟล์ต่อไปนี้:

- `render.yaml`
- `package.json`
- `prisma/schema.prisma`
- `prisma/migrations/20260615000000_init_postgresql/migration.sql`

ห้ามมีไฟล์ `.env` บน GitHub เพราะมีไว้เก็บรหัสลับ ไฟล์นี้ถูกระบุใน `.gitignore` แล้ว

#### ทางเลือก: ใช้ Terminal แทน GitHub Desktop

สร้าง repository ว่างบน GitHub ก่อน โดยไม่เลือกสร้าง README จากนั้นเปิด Terminal แล้วรัน:

```bash
cd /Users/siwbook/Documents/ClaudeCode
git init
git add .
git commit -m "Prepare PostgreSQL deployment on Render"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/school-substitution.git
git push -u origin main
```

เปลี่ยน `YOUR_GITHUB_USERNAME` เป็นชื่อบัญชี GitHub ของตนเอง

### 4. สร้างระบบบน Render ด้วย Blueprint

1. เข้า [Render Dashboard](https://dashboard.render.com/)
2. กด `New +`
3. เลือก `Blueprint`
4. หากยังไม่เห็น repository ให้กด `Configure account` หรือ `Connect account` แล้วอนุญาต Render ให้อ่าน repository
5. เลือก repository `school-substitution`
6. ช่อง Branch เลือก `main`
7. Render จะพบไฟล์ `render.yaml` และแสดง resource `school-substitution` เป็น Web Service
8. Render จะถามค่ารหัสลับที่มี `sync: false` ให้กรอก:
   - `DATABASE_URL`: วาง Aiven Service URI ที่ได้จากขั้นตอนก่อนหน้า ต้องมี `sslmode=require`
   - `ADMIN_USERNAME`: ชื่อสำหรับเข้าระบบครั้งแรก เช่น `schooladmin`
   - `ADMIN_PASSWORD`: รหัสผ่านอย่างน้อย 12 ตัวอักษร ควรมีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และอักขระพิเศษ
9. เก็บ username/password นี้ไว้ใน password manager ห้ามใส่รหัสผ่านเดียวกับอีเมลหรือ GitHub
10. ตรวจว่า Render Web Service อยู่ region `Singapore`
11. กด `Apply` หรือ `Create Blueprint`

ไม่ต้องกรอก `SESSION_SECRET` เพราะ Render จะสุ่มค่า 256-bit ให้

### 5. รอการ Deploy ครั้งแรก

Render จะทำงานตามลำดับนี้:

1. ติดตั้ง package ด้วย `npm ci`
2. สร้าง Prisma Client
3. build Next.js
4. รัน `prisma migrate deploy` เพื่อสร้างตารางใน Aiven PostgreSQL
5. เปิด Web Service
6. รัน `db:bootstrap` เพื่อสร้างบัญชี admin ครั้งแรกโดยไม่ล้างข้อมูล

ที่หน้า Blueprint หรือ Web Service ให้เปิดแท็บ `Events`/`Logs` และรอจนสถานะเป็น `Live` หากสำเร็จควรเห็นข้อความใกล้เคียง:

```text
Created administrator: schooladmin
```

จากนั้นกด URL ที่ลงท้ายด้วย `.onrender.com` ระบบควรเปิดหน้า Login ผ่าน HTTPS อัตโนมัติ

### 6. เข้าระบบและตั้งค่าครั้งแรก

1. Login ด้วย `ADMIN_USERNAME` และ `ADMIN_PASSWORD` ที่กรอกใน Render
2. เข้าเมนู `อัพโหลดข้อมูล`
3. นำเข้าข้อมูลครู ผู้ใช้ และตารางสอนตาม template ของระบบ
4. ตรวจหน้า `ภาพรวม`, `บันทึกการลา/ไปราชการ`, `จัดสอนแทน` และ `แลกคาบ`
5. สร้างบัญชีผู้ใช้งานจริง และไม่แชร์บัญชี admin ให้ผู้ใช้ทั่วไป

บัญชีตัวอย่าง `admin/admin1234` จะมีเฉพาะเมื่อใช้คำสั่ง demo seed ในเครื่อง ไม่ถูกสร้างบน Render

## การอัปเดตระบบในอนาคต

เมื่อแก้ไฟล์แล้ว ให้ commit และ push ไป branch `main` ผ่าน GitHub Desktop ปุ่ม `Commit` แล้ว `Push origin` จากนั้น Render จะ deploy อัตโนมัติ ทุก deploy จะรัน migration ที่ยังไม่เคยรันก่อนเปิดระบบเวอร์ชันใหม่

ห้ามแก้ migration ที่เคย deploy แล้ว หากต้องแก้ database schema ให้สร้าง migration ใหม่:

```bash
npx prisma migrate dev --name describe_your_change
```

## การแก้ปัญหาพื้นฐาน

### หน้าเว็บเปิดช้าในครั้งแรก

แพ็กเกจ Free จะพัก Web Service หลังไม่มีผู้เข้า 15 นาที การปลุกกลับมาอาจใช้ประมาณ 1 นาที ไม่ใช่ข้อมูลหาย

### Deploy ขึ้น Failed

1. เปิด Render > `school-substitution` > `Logs`
2. เลื่อนหาบรรทัดสีแดงบรรทัดแรก ไม่ใช่เฉพาะบรรทัดสุดท้าย
3. ตรวจว่า `DATABASE_URL` จาก Aiven ถูกต้องและมี `sslmode=require`
4. ตรวจว่า Aiven service อยู่สถานะ `Running`
5. ตรวจว่า `ADMIN_PASSWORD` ยาวอย่างน้อย 12 ตัวอักษร
6. ตรวจว่าไฟล์ migration ถูก push ขึ้น GitHub
7. หลังแก้ไข ให้กด `Manual Deploy` > `Deploy latest commit`

### ลืมรหัสผ่าน admin

การแก้ environment variable อย่างเดียวไม่เปลี่ยนรหัสผ่านในฐานข้อมูล เพราะ bootstrap ตั้งใจทำงานเพียงครั้งแรก ให้ Login ด้วย admin คนอื่นแล้วเปลี่ยน/สร้างบัญชีผ่านหน้า `จัดการผู้ใช้` หากไม่มี admin ที่เข้าได้ ต้องใช้การเชื่อมต่อฐานข้อมูลหรือสคริปต์ดูแลระบบโดยผู้พัฒนา

### Aiven ถูกปิดเพราะไม่ได้ใช้งานนาน

Aiven Free ไม่มีเวลาหมดอายุตายตัว แต่ Aiven ระบุว่าอาจปิด service ที่ไม่ได้ใช้งานนานโดยแจ้งเตือนก่อน หากเกิดขึ้นให้เข้า Aiven Console แล้วเปิด service กลับมา จากนั้นเข้าเว็บ Render อีกครั้ง

## การรันในเครื่องด้วย PostgreSQL

ต้องติดตั้ง Node.js 20/22 และ PostgreSQL ก่อน แล้วทำตามนี้:

1. สร้าง database ชื่อ `school_substitution`
2. คัดลอก `.env.example` เป็น `.env`
3. แก้ `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME` และ `ADMIN_PASSWORD`
4. รันคำสั่ง:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

เปิด `http://localhost:3000`

> `npm run db:seed` เป็นข้อมูล demo และล้างข้อมูลใน database เป้าหมายก่อนสร้างใหม่ ห้ามรันกับ production ส่วน `npm run db:bootstrap` สร้าง admin เฉพาะเมื่อยังไม่มี admin และไม่ล้างข้อมูล

## สิทธิ์ผู้ใช้

- `Admin`: จัดการข้อมูลทั้งหมด รวมถึงบัญชีผู้ใช้
- `หัวหน้างานบุคคล`: บันทึกครูลา/ไปราชการให้ครูทุกคน
- `หัวหน้ากลุ่มสาระ`: ดำเนินการแลกคาบ
- `ตัวแทนกลุ่มสาระ`: ดำเนินการแลกคาบ
- `Teacher`: บันทึกไปราชการ/ลากิจของตนเอง ดำเนินการแลกคาบ และอนุมัติรายการที่ตนเองเป็นครูปลายทาง

## เอกสารอ้างอิง

- [Render: Deploy a Next.js App](https://render.com/docs/deploy-nextjs-app)
- [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Render Free Instance Limitations](https://render.com/docs/free)
- [Aiven for PostgreSQL Free Tier](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier)
- [Aiven: Connect with Prisma](https://aiven.io/docs/products/postgresql/howto/connect-prisma)
- [Prisma Migrate in Production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
