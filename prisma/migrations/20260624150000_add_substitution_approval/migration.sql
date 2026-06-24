ALTER TABLE "Substitution" ADD COLUMN "status" "SwapStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Substitution" ADD COLUMN "approvedById" TEXT;
