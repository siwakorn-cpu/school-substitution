CREATE TABLE "ActivityPeriod" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityPeriod_dayOfWeek_period_key" ON "ActivityPeriod"("dayOfWeek", "period");
