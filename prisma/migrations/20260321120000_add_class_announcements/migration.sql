-- CreateTable
CREATE TABLE "class_announcements" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "visibleFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibleUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_announcements_classGroupId_visibleFrom_idx" ON "class_announcements"("classGroupId", "visibleFrom");

-- CreateIndex
CREATE INDEX "announcement_reads_announcementId_idx" ON "announcement_reads"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcementId_userId_key" ON "announcement_reads"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_announcements" ADD CONSTRAINT "class_announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "class_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
