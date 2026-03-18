#!/bin/bash
set -e

echo "🔧 步驟 1: 生成 Prisma Client..."
npx prisma generate

echo ""
echo "🔧 步驟 2: 推送 Schema 到資料庫..."
npx prisma db push

echo ""
echo "🔧 步驟 3: 執行 Seed 初始化資料..."
npx prisma db seed

echo ""
echo "✅ 完成！資料庫已設定完成"
