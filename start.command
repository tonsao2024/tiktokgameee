#!/bin/bash
# ดับเบิลคลิกไฟล์นี้บน Mac เพื่อเปิดเวที
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "ยังไม่ได้ติดตั้ง Node.js — ดาวน์โหลดรุ่น LTS จาก https://nodejs.org แล้วเปิดไฟล์นี้ใหม่"
  open https://nodejs.org
  read -r -p "กด Enter เพื่อปิด"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "กำลังติดตั้ง (ครั้งแรกครั้งเดียว) กรุณารอสักครู่..."
  npm install || { read -r -p "ติดตั้งไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ กด Enter เพื่อปิด"; exit 1; }
fi
echo "เวทีกำลังเปิดที่ http://localhost:3000 (เปิดหน้าต่างนี้ค้างไว้ตลอดการไลฟ์)"
(sleep 3 && open http://localhost:3000) &
node server.js
