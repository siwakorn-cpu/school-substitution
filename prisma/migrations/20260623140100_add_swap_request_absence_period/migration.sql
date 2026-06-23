ALTER TABLE "SwapRequest" ADD COLUMN "absencePeriodId" TEXT;

ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_absencePeriodId_fkey" FOREIGN KEY ("absencePeriodId") REFERENCES "AbsencePeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
