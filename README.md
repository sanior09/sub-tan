<div align="center">

# 👻 ผีตาลหลอน (Sub-Tan 3D Endless Runner)
### *"บนเเล้วต้องเเก้นะครับ...."* 🙏🌼🏃‍♂️💨

[![Live Demo](https://img.shields.io/badge/🎮_เล่นเกมออนไลน์-sub--tan.onrender.com-ff2b4a?style=for-the-badge&logo=render&logoColor=white)](https://sub-tan.onrender.com)
[![Three.js](https://img.shields.io/badge/3D_Engine-Three.js_r147-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Platform](https://img.shields.io/badge/Platform-PC_%26_Mobile_Web-42e695?style=for-the-badge)](https://sub-tan.onrender.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-ffd24a?style=for-the-badge)](./LICENSE)
[![Owner](https://img.shields.io/badge/Owner-%40sanior09-8a2be2?style=for-the-badge&logo=github)](https://github.com/sanior09)

<p align="center">
  <b>เกมวิ่งหนีผี 3 มิติสุดหลอนสไตล์ Subway Surfers บนเว็บเบราว์เซอร์</b><br>
  เมื่อคุณไปจุดธูปบนบานต่อหน้า <b>"ศาลเจ้าพ่อตาล"</b> แล้วได้ของสมหวัง แต่ดันชิ่งหนีไม่ยอมเอาพวงมาลัยมาแก้บน!<br>
  งานนี้ <b>เจ้าพ่อตาล</b> เลยต้องออกวิ่งไล่ทวงพวงมาลัยด้วยตัวเองแบบติดขอบจอ!
</p>

---

### 🚀 [👉 คลิกที่นี่เพื่อเข้าเล่นเกมทันที (Play Live on Render)](https://sub-tan.onrender.com)
*(รองรับทั้งคอมพิวเตอร์ และมือถือ iOS / Android ไม่ต้องติดตั้งแอป)*

</div>

---

## ✨ จุดเด่นของเกม (Key Features)

- ⛩️ **ฉากเปิดไหว้ศาลเจ้าพ่อตาล (Subway Surfers Intro):** เริ่มต้นด้วยฉากตัวละครนั่งพนมมือจุดธูปก้มกราบขอพรหน้า **ศาลเจ้าพ่อตาล** พร้อมเครื่องเซ่นไหว้น้ำแดงแฟนต้า พวงมาลัย และผีตาลที่แอบชะโงกหน้าจ้องมองอยู่หลังศาล พอแตะหน้าจอปุ๊บ ตัวละครจะหันหลังสับตีนแตกวิ่งหนีทันที!
- 📹 **ระบบกล้องหน้าเรียลไทม์ (Picture-in-Picture Front Cam):** หน้าต่างกล้องหน้ามุมขวาบนแสดงภาพผีตาลในชุดสูทนักเรียน VBAC ที่กำลังวิ่งสับขาไล่จี้ตามหลังมาแบบติดๆ พร้อมไฟกะพริบเตือนภัยเมื่อผีตาลเข้าใกล้
- 🌼 **ระบบเก็บพวงมาลัยแก้บน:** เก็บ **พวงมาลัยดอกมะลิ** ตามทางเพื่อช่วยเพิ่มระยะห่างจากผีตาล หากชนสิ่งกีดขวางผีตาลจะพุ่งเข้ามาประชิดตัวทันที
- 🔊 **ระบบเสียงสังเคราะห์ Web Audio API 100%:** เสียงฝีเท้า เสียงหัวใจเต้นตึกตักตามระยะห่างของผี เสียงเก็บพวงมาลัย และเสียง Jump Scare สุดสะพรึง สร้างด้วยโค้ดล้วนโดยไม่ต้องโหลดไฟล์เสียงภายนอก
- 📱 **Cross-Platform (PC & Mobile Ready):** เล่นได้ลื่นไหลทั้งบนคอมพิวเตอร์ (Keyboard) และสมาร์ทโฟน (Touch Swipe)

---

## 🎮 วิธีบังคับ (Controls)

| การกระทำ (Action) | 💻 คอมพิวเตอร์ (Keyboard) | 📱 มือถือ / แท็บเล็ต (Touch Screen) |
| :--- | :---: | :---: |
| **เริ่มเกม / วิ่งหนี** | คลิกเมาส์ หรือกด `Space` / `Enter` | แตะที่หน้าจอ |
| **เบี่ยงซ้าย** | `←` หรือ `A` | ปัดนิ้วไปทางซ้าย (Swipe Left) |
| **เบี่ยงขวา** | `→` หรือ `D` | ปัดนิ้วไปทางขวา (Swipe Right) |
| **กระโดดข้ามสิ่งกีดขวาง** | `↑` / `W` / `Space` | ปัดนิ้วขึ้น (Swipe Up) |
| **สไลด์ลอดคาน** | `↓` หรือ `S` | ปัดนิ้วลง (Swipe Down) |

---

## 🗂️ โครงสร้างโปรเจกต์ (Project Structure)

```text
sub-tan/
├── index.html          # โครงสร้างหน้าเว็บ, HUD, กรอบกล้องหน้า PiP และหน้าจอเริ่ม/จบเกม
├── game.js             # ระบบเกมหลัก 3D (Three.js), ฉากศาลเจ้าพ่อตาล, ระบบวิ่ง 3 เลน, กล้องคู่ และเสียง WebAudio
├── character.js        # ระบบสร้างโมเดล 3D ตัวละครวิ่งหนี และโมเดลผีตาลพร้อมแอนิเมชัน
├── face.js             # ข้อมูลเท็กซ์เจอร์ใบหน้าผีตาล และไอคอนพวงมาลัยดอกมะลิ (Base64)
├── robot.js            # โมเดล 3D ตัวละครผู้เล่น (RobotExpressive GLB)
├── xbot.js             # โมเดล 3D โครงกระดูกมนุษย์สำหรับผีตาล (Xbot GLB)
├── lib/                # ไลบรารี Three.js (r147) และ GLTFLoader
├── render.yaml         # ไฟล์ตั้งค่าสำหรับ Deploy อัตโนมัติบน Render Static Site
└── LICENSE             # สัญญาอนุญาตการใช้งานแบบ MIT License
```

---

## 🛠️ การรันโปรเจกต์บนเครื่อง (Run Locally)

โปรเจกต์นี้ออกแบบให้ทำงานแบบ **Zero-Dependency Static Web** สามารถเปิดเล่นได้ทันทีโดยไม่ต้องติดตั้งเซิร์ฟเวอร์:

1. **Clone โปรเจกต์ลงเครื่อง:**
   ```bash
   git clone https://github.com/sanior09/sub-tan.git
   cd sub-tan
   ```
2. **เปิดเล่นได้ทันที:**
   ดับเบิลคลิกไฟล์ `index.html` เพื่อเปิดในเว็บเบราว์เซอร์ (Chrome, Edge, Safari, Firefox) ได้เลย!

---

## 📜 ลิขสิทธิ์และความเป็นเจ้าของ (Ownership & License)

- **เจ้าของโปรเจกต์และผู้พัฒนา (Creator & Copyright Holder):** [**@sanior09**](https://github.com/sanior09)
- **สัญญาอนุญาต (License):** โปรเจกต์นี้อยู่ภายใต้สัญญาอนุญาตแบบ [**MIT License**](./LICENSE) — สามารถนำไปศึกษา ดัดแปลง หรือต่อยอดได้โดยต้องคงชื่อเจ้าของลิขสิทธิ์เดิม (`Copyright (c) 2026 sanior09`) ไว้ตามเงื่อนไขของสัญญาอนุญาต

<div align="center">
  <br>
  <b>⚠️ คำเตือน: บนอะไรไว้ อย่าลืมเอาพวงมาลัยไปแก้บนนะครับท่าน...</b>
</div>
