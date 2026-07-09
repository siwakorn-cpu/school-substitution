ALTER TABLE "Substitution" ALTER COLUMN "substituteTeacherId" DROP NOT NULL;
ALTER TABLE "Substitution" ADD COLUMN "externalSubstituteName" TEXT;
