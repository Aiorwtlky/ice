import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 開始初始化資料庫（可重複執行，已存在則略過）...');

  // 1. 期數「測試學堂」
  console.log('📅 建立期數...');
  let term = await prisma.term.findFirst({ where: { name: '測試學堂' } });
  if (!term) {
    term = await prisma.term.create({
      data: { name: '測試學堂', isActive: true },
    });
    console.log(`✅ 期數建立完成: ${term.name}`);
  } else {
    console.log(`✅ 期數已存在: ${term.name}`);
  }
  if (!term) throw new Error('seed: term 建立失敗');
  const termId = term.id;

  // 2. 遊戲模組（點擊一、點擊二、河內塔）
  console.log('🎮 建立遊戲模組...');
  const codes = [
    { code: 'CLICK_1', name: '點擊一', description: '單擊測試遊戲模組' },
    { code: 'CLICK_2', name: '點擊二', description: '雙擊測試遊戲模組' },
  ];
  for (const c of codes) {
    const existing = await prisma.gameModule.findFirst({
      where: { termId: term.id, code: c.code },
    });
    if (!existing) {
      await prisma.gameModule.create({
        data: { termId: term.id, code: c.code, name: c.name, description: c.description },
      });
    }
  }
  const click1Module = await prisma.gameModule.findFirst({
    where: { termId: term.id, code: 'CLICK_1' },
  });
  if (!click1Module) throw new Error('CLICK_1 模組未找到');
  console.log('✅ 遊戲模組就緒（點擊一、點擊二、河內塔）');

  // 3. Super Admin（已存在則更新密碼）
  console.log('👤 建立 Super Admin...');
  const adminPassword = '9901';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { account: 'AD-01' },
    create: {
      account: 'AD-01',
      name: '李冠彣',
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
    },
    update: { passwordHash: adminPasswordHash, name: '李冠彣' },
  });
  console.log(`✅ Super Admin: ${admin.account}`);

  // 共用：校正/補齊學校資料（即使已存在也會補齊學生歸屬、活動分類與示範解鎖）
  async function ensureSchool(opts: {
    schoolCode: string;
    schoolName: string;
    teacherAccounts: { account: string; name: string; password: string }[];
    studentPrefix: string;
    studentCount: number;
  }) {
    const { schoolCode, schoolName, teacherAccounts, studentPrefix, studentCount } = opts;
    console.log(`🏫 校正/補齊：${schoolName} (${schoolCode})...`);

    const teachers = [];
    for (const t of teacherAccounts) {
      const passwordHash = await bcrypt.hash(t.password, 10);
      const teacher = await prisma.user.upsert({
        where: { account: t.account },
        create: {
          account: t.account,
          name: t.name,
          role: UserRole.TEACHER,
          schoolCode,
          passwordHash,
        },
        update: { name: t.name, schoolCode, passwordHash },
      });
      teachers.push(teacher);
    }

    let group = await prisma.classGroup.findFirst({ where: { schoolCode } });
    if (!group) {
      group = await prisma.classGroup.create({
        data: {
          name: schoolName,
          schoolCode,
          teacherId: teachers[0].id,
          activeTermId: termId,
        },
      });
    } else {
      await prisma.classGroup.update({
        where: { id: group.id },
        data: {
          name: group.name || schoolName,
          activeTermId: group.activeTermId ?? termId,
          teacherId: group.teacherId ?? teachers[0].id,
        },
      });
      group = (await prisma.classGroup.findUnique({ where: { id: group.id } })) as typeof group;
    }

    // 活動分類：沿用 Session 當作分類容器（目前 UI 叫「活動分類」）
    let session = await prisma.session.findFirst({
      where: { classGroupId: group.id },
      orderBy: { order: 'asc' },
    });
    if (!session) {
      session = await prisma.session.create({
        data: {
          classGroupId: group.id,
          name: '測試分類',
          sessionAt: null,
          order: 1,
          isActive: true,
        },
      });
    }

    await prisma.sessionGameUnlock.upsert({
      where: { sessionId_gameModuleId: { sessionId: session.id, gameModuleId: click1Module.id } },
      create: { sessionId: session.id, gameModuleId: click1Module.id, isUnlocked: true },
      update: {},
    });

    for (let i = 0; i < studentCount; i++) {
      const num = String(i + 1).padStart(2, '0');
      const account = `${studentPrefix}-${num}`;
      const passwordHash = await bcrypt.hash(`88${num}`, 10);
      await prisma.user.upsert({
        where: { account },
        create: {
          account,
          name: null,
          role: UserRole.STUDENT,
          schoolCode,
          passwordHash,
          studentGroupId: group.id,
        },
        update: { schoolCode, passwordHash, studentGroupId: group.id },
      });
    }

    console.log(`✅ ${schoolName}：教師 ${teacherAccounts.length} 位、學員 ${studentCount} 位（缺漏已補齊）`);
  }

  // 4. 明禮國小 (ML) — 以 ensureSchool 補齊
  const mlGroupExisting = await prisma.classGroup.findFirst({ where: { schoolCode: 'ML' } });
  if (!mlGroupExisting) {
    console.log('🏫 建立明禮國小...');
    const mlTeachers = await Promise.all([
      prisma.user.create({
        data: {
          account: 'TC-ML01',
          name: '蔡依恬',
          role: UserRole.TEACHER,
          schoolCode: 'ML',
          passwordHash: await bcrypt.hash('9901', 10),
        },
      }),
      prisma.user.create({
        data: {
          account: 'TC-ML02',
          name: '許滋玹',
          role: UserRole.TEACHER,
          schoolCode: 'ML',
          passwordHash: await bcrypt.hash('9902', 10),
        },
      }),
      prisma.user.create({
        data: {
          account: 'TC-ML03',
          name: '李旻倩',
          role: UserRole.TEACHER,
          schoolCode: 'ML',
          passwordHash: await bcrypt.hash('9903', 10),
        },
      }),
    ]);
    const mlGroup = await prisma.classGroup.create({
      data: {
        name: '明禮國小',
        schoolCode: 'ML',
        teacherId: mlTeachers[0].id,
        activeTermId: term.id,
      },
    });
    const mlSession = await prisma.session.create({
      data: {
        classGroupId: mlGroup.id,
        name: '第一堂',
        sessionAt: null,
        order: 1,
        isActive: true,
      },
    });
    await prisma.sessionGameUnlock.create({
      data: { sessionId: mlSession.id, gameModuleId: click1Module.id, isUnlocked: true },
    });
    for (let i = 0; i < 30; i++) {
      const num = String(i + 1).padStart(2, '0');
      await prisma.user.create({
        data: {
          account: `ML-${num}`,
          name: null,
          role: UserRole.STUDENT,
          schoolCode: 'ML',
          passwordHash: await bcrypt.hash(`88${num}`, 10),
          studentGroupId: mlGroup.id,
        },
      });
    }
    await prisma.classGameUnlock.create({
      data: { classGroupId: mlGroup.id, gameModuleId: click1Module.id, isUnlocked: true },
    });
    console.log('✅ 明禮國小: 3 位老師, 30 名學生');
  } else {
    if (!mlGroupExisting.activeTermId) {
      await prisma.classGroup.update({ where: { id: mlGroupExisting.id }, data: { activeTermId: term.id } });
      console.log('✅ 明禮國小已存在，已補上 activeTerm');
    } else {
      console.log('⏭️ 明禮國小已存在，略過');
    }
  }

  // 5. 三潭國小 (ST)
  const stGroupExisting = await prisma.classGroup.findFirst({ where: { schoolCode: 'ST' } });
  if (!stGroupExisting) {
    console.log('🏫 建立三潭國小...');
    const stTeachers = await Promise.all([
      prisma.user.create({
        data: {
          account: 'TC-ST01',
          name: '李冠彣',
          role: UserRole.TEACHER,
          schoolCode: 'ST',
          passwordHash: await bcrypt.hash('9901', 10),
        },
      }),
      prisma.user.create({
        data: {
          account: 'TC-ST02',
          name: '吳佳憲',
          role: UserRole.TEACHER,
          schoolCode: 'ST',
          passwordHash: await bcrypt.hash('9902', 10),
        },
      }),
    ]);
    const stGroup = await prisma.classGroup.create({
      data: {
        name: '三潭國小',
        schoolCode: 'ST',
        teacherId: stTeachers[0].id,
        activeTermId: term.id,
      },
    });
    const stSession = await prisma.session.create({
      data: {
        classGroupId: stGroup.id,
        name: '第一堂',
        sessionAt: null,
        order: 1,
        isActive: true,
      },
    });
    await prisma.sessionGameUnlock.create({
      data: { sessionId: stSession.id, gameModuleId: click1Module.id, isUnlocked: true },
    });
    for (let i = 0; i < 30; i++) {
      const num = String(i + 1).padStart(2, '0');
      await prisma.user.create({
        data: {
          account: `ST-${num}`,
          name: null,
          role: UserRole.STUDENT,
          schoolCode: 'ST',
          passwordHash: await bcrypt.hash(`88${num}`, 10),
          studentGroupId: stGroup.id,
        },
      });
    }
    await prisma.classGameUnlock.create({
      data: { classGroupId: stGroup.id, gameModuleId: click1Module.id, isUnlocked: true },
    });
    console.log('✅ 三潭國小: 2 位老師, 30 名學生');
  } else {
    if (!stGroupExisting.activeTermId) {
      await prisma.classGroup.update({ where: { id: stGroupExisting.id }, data: { activeTermId: term.id } });
      console.log('✅ 三潭國小已存在，已補上 activeTerm');
    } else {
      console.log('⏭️ 三潭國小已存在，略過');
    }
  }

  // 6. 崙雅國小 (LY)
  const lyGroupExisting = await prisma.classGroup.findFirst({ where: { schoolCode: 'LY' } });
  if (!lyGroupExisting) {
    console.log('🏫 建立崙雅國小...');
    const lyTeachers = await Promise.all([
      prisma.user.create({
        data: {
          account: 'TC-LY01',
          name: '張隆君',
          role: UserRole.TEACHER,
          schoolCode: 'LY',
          passwordHash: await bcrypt.hash('9901', 10),
        },
      }),
      prisma.user.create({
        data: {
          account: 'TC-LY02',
          name: '陳平',
          role: UserRole.TEACHER,
          schoolCode: 'LY',
          passwordHash: await bcrypt.hash('9902', 10),
        },
      }),
    ]);
    const lyGroup = await prisma.classGroup.create({
      data: {
        name: '崙雅國小',
        schoolCode: 'LY',
        teacherId: lyTeachers[0].id,
        activeTermId: term.id,
      },
    });
    const lySession = await prisma.session.create({
      data: {
        classGroupId: lyGroup.id,
        name: '第一堂',
        sessionAt: null,
        order: 1,
        isActive: true,
      },
    });
    await prisma.sessionGameUnlock.create({
      data: { sessionId: lySession.id, gameModuleId: click1Module.id, isUnlocked: true },
    });
    for (let i = 0; i < 30; i++) {
      const num = String(i + 1).padStart(2, '0');
      await prisma.user.create({
        data: {
          account: `LY-${num}`,
          name: null,
          role: UserRole.STUDENT,
          schoolCode: 'LY',
          passwordHash: await bcrypt.hash(`88${num}`, 10),
          studentGroupId: lyGroup.id,
        },
      });
    }
    await prisma.classGameUnlock.create({
      data: { classGroupId: lyGroup.id, gameModuleId: click1Module.id, isUnlocked: true },
    });
    console.log('✅ 崙雅國小: 2 位老師, 30 名學生');
  } else {
    if (!lyGroupExisting.activeTermId) {
      await prisma.classGroup.update({ where: { id: lyGroupExisting.id }, data: { activeTermId: term.id } });
      console.log('✅ 崙雅國小已存在，已補上 activeTerm');
    } else {
      console.log('⏭️ 崙雅國小已存在，略過');
    }
  }

  // 補齊：即使班級已存在也會把 30 個帳號綁回去，否則老師端會看不到成員
  await ensureSchool({
    schoolCode: 'ML',
    schoolName: '明禮國小',
    teacherAccounts: [
      { account: 'TC-ML01', name: '蔡依恬', password: '9901' },
      { account: 'TC-ML02', name: '許滋玹', password: '9902' },
      { account: 'TC-ML03', name: '李旻倩', password: '9903' },
    ],
    studentPrefix: 'ML',
    studentCount: 30,
  });
  await ensureSchool({
    schoolCode: 'ST',
    schoolName: '三潭國小',
    teacherAccounts: [
      { account: 'TC-ST01', name: '李冠彣', password: '9901' },
      { account: 'TC-ST02', name: '吳佳憲', password: '9902' },
    ],
    studentPrefix: 'ST',
    studentCount: 30,
  });
  await ensureSchool({
    schoolCode: 'LY',
    schoolName: '崙雅國小',
    teacherAccounts: [
      { account: 'TC-LY01', name: '張隆君', password: '9901' },
      { account: 'TC-LY02', name: '陳平', password: '9902' },
    ],
    studentPrefix: 'LY',
    studentCount: 30,
  });

  console.log('\n🎉 資料庫 seed 完成！');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
