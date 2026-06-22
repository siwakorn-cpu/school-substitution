CREATE TABLE "SchoolTerm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "sourceTerm" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'blank_schedule',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolTerm_name_key" ON "SchoolTerm"("name");
