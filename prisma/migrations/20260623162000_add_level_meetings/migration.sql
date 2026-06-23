CREATE TABLE "LevelMeeting" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LevelMeetingTeacher" (
    "id" TEXT NOT NULL,
    "levelMeetingId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelMeetingTeacher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LevelMeeting_level_key" ON "LevelMeeting"("level");

CREATE UNIQUE INDEX "LevelMeetingTeacher_levelMeetingId_teacherId_key" ON "LevelMeetingTeacher"("levelMeetingId", "teacherId");

ALTER TABLE "LevelMeetingTeacher" ADD CONSTRAINT "LevelMeetingTeacher_levelMeetingId_fkey" FOREIGN KEY ("levelMeetingId") REFERENCES "LevelMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LevelMeetingTeacher" ADD CONSTRAINT "LevelMeetingTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
