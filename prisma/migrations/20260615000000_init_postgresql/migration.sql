-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PERSONNEL', 'HEAD', 'DEPT_REP', 'TEACHER');
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "RoomType" AS ENUM ('CLASSROOM', 'SPECIAL');
CREATE TYPE "AbsenceType" AS ENUM ('LEAVE', 'PERSONAL', 'OFFICIAL');
CREATE TYPE "AbsencePeriodAction" AS ENUM ('SUBSTITUTE', 'SWAP', 'NONE');
CREATE TYPE "WorkStatus" AS ENUM ('PENDING', 'DONE', 'CANCELLED');
CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "TemporaryScheduleSource" AS ENUM ('SWAP', 'SUBSTITUTE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "teacherId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headTeacherId" TEXT,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingSchedule" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "specialRoomId" TEXT,
    "term" TEXT NOT NULL DEFAULT '1/2569',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherAbsence" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherAbsence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AbsencePeriod" (
    "id" TEXT NOT NULL,
    "absenceId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "actionType" "AbsencePeriodAction" NOT NULL DEFAULT 'NONE',
    "status" "WorkStatus" NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "AbsencePeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Substitution" (
    "id" TEXT NOT NULL,
    "absencePeriodId" TEXT NOT NULL,
    "originalTeacherId" TEXT NOT NULL,
    "substituteTeacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "period" INTEGER NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "specialRoomId" TEXT,
    "assignedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Substitution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "requesterTeacherId" TEXT NOT NULL,
    "targetTeacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fromScheduleId" TEXT NOT NULL,
    "toScheduleId" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemporarySchedule" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "originalScheduleId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "classRoomId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "specialRoomId" TEXT,
    "sourceType" "TemporaryScheduleSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemporarySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_teacherId_key" ON "User"("teacherId");
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Teacher_code_key" ON "Teacher"("code");
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");
CREATE UNIQUE INDEX "TeachingSchedule_teacherId_dayOfWeek_period_term_key" ON "TeachingSchedule"("teacherId", "dayOfWeek", "period", "term");
CREATE UNIQUE INDEX "Substitution_absencePeriodId_key" ON "Substitution"("absencePeriodId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingSchedule" ADD CONSTRAINT "TeachingSchedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingSchedule" ADD CONSTRAINT "TeachingSchedule_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingSchedule" ADD CONSTRAINT "TeachingSchedule_specialRoomId_fkey" FOREIGN KEY ("specialRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingSchedule" ADD CONSTRAINT "TeachingSchedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAbsence" ADD CONSTRAINT "TeacherAbsence_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AbsencePeriod" ADD CONSTRAINT "AbsencePeriod_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "TeacherAbsence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AbsencePeriod" ADD CONSTRAINT "AbsencePeriod_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "TeachingSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_absencePeriodId_fkey" FOREIGN KEY ("absencePeriodId") REFERENCES "AbsencePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requesterTeacherId_fkey" FOREIGN KEY ("requesterTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_targetTeacherId_fkey" FOREIGN KEY ("targetTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
