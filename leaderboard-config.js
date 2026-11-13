// การตั้งค่าเชื่อมต่อ Supabase สำหรับกระดานผู้นำออนไลน์ (Global Leaderboard)
// 1. สร้างโปรเจกต์ฟรีที่ https://supabase.com
// 2. นำคำสั่ง SQL จากไฟล์ supabase-setup.sql ไปรันในเมนู SQL Editor ของ Supabase
// 3. คัดลอก Project URL และ anon public key (Project Settings -> API) มาวางด้านล่างนี้
window.SUBTAN_LB_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  table: 'leaderboard',
};
