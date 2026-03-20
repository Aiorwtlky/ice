-- 老師可將已結束等比賽從學生端列表隱藏
DO $$ BEGIN
  ALTER TABLE "class_competitions" ADD COLUMN "hiddenFromStudents" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
