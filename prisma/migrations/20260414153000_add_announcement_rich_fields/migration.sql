-- Add richer announcement fields for links and prioritization
ALTER TABLE "class_announcements"
ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isImportant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ctaLabel" TEXT,
ADD COLUMN "ctaUrl" TEXT;

CREATE INDEX "class_announcements_classGroupId_isPinned_isImportant_visibleFrom_idx"
ON "class_announcements"("classGroupId", "isPinned", "isImportant", "visibleFrom");
