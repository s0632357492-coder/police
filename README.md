# Discord Voice Management Bot (Enterprise)

บอทจัดการห้องเสียงระดับ Enterprise สร้างด้วย Node.js + discord.js v14 + SQLite
รองรับ 5 ระบบตามสเปก: Voice 24/7, Vote Moderation, Special Channel Permission, Reason Control, Dev Tool Dashboard

## 1) ติดตั้ง

```bash
npm install
```

> ต้องการ Node.js เวอร์ชัน 18.17.0 ขึ้นไป

หากต้องการให้บอท **เข้าห้องเสียงจริง** (สำหรับระบบ Voice 24/7) ให้ติดตั้งแพ็กเกจเสียงเพิ่ม:

```bash
npm install @discordjs/voice @discordjs/opus
```

(ถ้าไม่ติดตั้ง บอทยังทำงานได้ปกติทุกระบบ เพียงแต่จะไม่ต่อสัญญาณเสียงจริง — สถานะใน DB / auto-recovery / anti-troll ยังทำงานครบ)

## 2) ตั้งค่า

```bash
cp .env.example .env
```

แก้ไข `.env`:

```
DISCORD_TOKEN=โทเคนบอทของคุณ
CLIENT_ID=Application ID ของบอท
GUILD_ID=ใส่ Guild ID ถ้าต้องการ deploy คำสั่งเฉพาะเซิร์ฟเวอร์ (อัปเดตทันที) หรือเว้นว่างไว้เพื่อ deploy แบบ Global
```

**สำคัญ:** เปิด **Privileged Gateway Intents** ในหน้า Discord Developer Portal ของบอท:
- SERVER MEMBERS INTENT
- MESSAGE CONTENT INTENT

## 3) ลงทะเบียน Slash Commands

```bash
npm run deploy
```

## 4) รันบอท

```bash
npm start
```

---

## โครงสร้างโปรเจกต์

```
src/
 ├── commands/        # slash commands ทั้งหมด (14 คำสั่ง)
 ├── events/           # ready, interactionCreate, voiceStateUpdate, guildMemberUpdate/Remove, guildBanAdd
 ├── database/         # db.js — สร้าง schema SQLite อัตโนมัติเมื่อรันครั้งแรก
 ├── systems/
 │     ├── voice247/       # เข้าห้อง 24/7 + auto-rejoin + recovery
 │     ├── vote/            # votekick / votetimeout / votemute / votedeaf
 │     ├── specialvoice/    # spch / delspch — Special Moderator ต่อห้อง
 │     ├── reason/          # setreason / reason — นับสิทธิ์เกิน 5 ครั้ง -> ล็อก role
 │     ├── protection/      # ตรวจจับการแกล้งบอท (kick/ban/timeout/disconnect/move)
 │     ├── devtool/         # dashboard แบบ live-update ทุก 5 นาที (edit message เดิม)
 │     ├── logger/          # log ลง DB + ส่ง embed เข้าห้อง log
 │     ├── permissions/     # ตรวจสอบสิทธิ์ตาม Role ID ที่ตั้งไว้
 │     └── recovery/        # backup/restore DB, health check
 ├── utils/            # cooldown, embed helpers, command/event loader
 ├── config/config.js  # **แก้ Role ID / ค่าคงที่ทั้งหมดได้ที่นี่ที่เดียว**
 └── index.js          # entry point
```

## คำสั่งทั้งหมด

| คำสั่ง | คำอธิบาย | สิทธิ์ |
|---|---|---|
| `/on247` | เข้าห้องเสียงและอยู่ 24/7 | Role ตาม `ADMIN_ROLE_IDS` |
| `/stopon` | ปิดระบบ 24/7 | Role ตาม `ADMIN_ROLE_IDS` |
| `/votekick` `/votetimeout` `/votemute` `/votedeaf` | เริ่มโหวตลงโทษ | สมาชิกทั่วไป (น้ำหนักเสียงต่างกันตาม Role) |
| `/spch` `/delspch` | ตั้ง/ยกเลิก Special Channel Permission | Role ตาม `ADMIN_ROLE_IDS` |
| `/voicekick` `/voicemute` `/voicedeaf` | ใช้สิทธิ์ Moderator/Special Moderator จัดการห้องเสียง | Moderator หรือ Special Moderator ของห้องนั้น |
| `/setreason` | ตั้งค่าระบบ Reason Control | Role ตาม `ADMIN_ROLE_IDS` |
| `/reason` | ส่งเหตุผลผ่าน Modal เพื่อขอคืน Role | ผู้ที่ถูกล็อกเท่านั้น |
| `/devtool` | เปิด Dashboard แบบ live | Role ตาม `ADMIN_ROLE_IDS` |
| `/noob <target>` | เพิ่มสมาชิกเข้ารายชื่อ Noob Target (สูงสุด 5 คน) — โหวตเห็นด้วยแค่ 2 เสียงก็โดนลงโทษทันที | Role ตาม `ADMIN_ROLE_IDS` |
| `/unnoob <target>` | เอาสมาชิกออกจากรายชื่อ Noob Target (กลับสู่เกณฑ์ปกติ) | Role ตาม `ADMIN_ROLE_IDS` |
| `/help` | แสดงคู่มือคำสั่งที่สมาชิกทั่วไปใช้ได้ (ไม่รวมคำสั่งแอดมิน) | ทุกคน |

## การแก้ไข Role ID / Channel ID

ทุกค่าคงที่ (Role ผู้ดูแล, Role น้ำหนักโหวต, ห้องกัก Vote Kick ฯลฯ) รวมไว้ที่ไฟล์เดียว:

```
src/config/config.js
```

## หมายเหตุด้านสถาปัตยกรรม

- **ฐานข้อมูล**: ใช้ SQLite (`better-sqlite3`) เก็บที่ `data/bot.db` เหมาะกับเซิร์ฟเวอร์ขนาดเล็ก-กลาง
  หากต้องการ PostgreSQL สำหรับสเกลใหญ่ ให้แทนที่ `src/database/db.js` ด้วย client ของ `pg` หรือ Prisma/Drizzle
  แล้ว map interface (`prepare/run/get/all`) ให้เหมือนเดิม เพื่อไม่ต้องแก้โค้ดใน systems/* ทั้งหมด
- **Race condition / กดปุ่มซ้ำ**: ป้องกันด้วย in-memory lock (`utils/cooldown.js`) — เพียงพอสำหรับบอท process เดียวตามสเปก
- **Auto Recovery**: เมื่อบอทรีสตาร์ท `ready` event จะอ่านตาราง `voice247` แล้วกลับเข้าห้องเดิมทุกเซิร์ฟเวอร์อัตโนมัติ
- **Backup**: สำรอง DB อัตโนมัติทุก 6 ชั่วโมงไปที่ `data/backups/` (เก็บ 10 ไฟล์ล่าสุด)
- **การป้องกันบอท**: ตรวจ Audit Log หาผู้กระทำเมื่อบอทถูก kick/ban/timeout/disconnect/move แล้ว Timeout 5 นาที + DM แจ้งเตือน

## ข้อจำกัดที่ควรทราบก่อนใช้งานจริง

1. ค่า Role ID / Channel ID ในสเปกถูกใส่ไว้ล่วงหน้าใน `config.js` แล้ว — ตรวจสอบว่าตรงกับเซิร์ฟเวอร์จริงของคุณก่อนใช้งาน
2. `VOTE_THRESHOLD` (คะแนนที่ต้องถึงเพื่อดำเนินการ) ตั้งไว้ที่ 3 เป็นค่าเริ่มต้น ปรับได้ที่ `src/systems/vote/voteService.js`
2.1. **Noob Target** (`/noob`, `/unnoob`): เพิ่มสมาชิกได้สูงสุด `NOOB_MAX_TARGETS` (ค่าเริ่มต้น 5) คนต่อเซิร์ฟเวอร์ — เมื่อมีการเปิดโหวตลงโทษต่อสมาชิกที่อยู่ในรายชื่อนี้ จะใช้เกณฑ์ `NOOB_VOTE_THRESHOLD` (ค่าเริ่มต้น 2 เสียงเห็นด้วย) แทนเกณฑ์ปกติ ปรับค่าได้ที่ `src/config/config.js` เกณฑ์จะถูกล็อกไว้ ณ ตอนเปิดโหวต (ถ้าถอดออกจากรายชื่อระหว่างโหวตที่เปิดอยู่แล้ว จะไม่กระทบ session ที่เปิดไปก่อนหน้า)
3. Dashboard (`/devtool`) ใช้ Discord embed แบบ text-based ไม่ใช่เว็บแอป (เนื่องจาก Discord ไม่รองรับ UI แบบกราฟิกในแชท) — อัปเดตด้วยการ edit message ทุก 5 นาทีตามสเปก
4. ระบบ Reason Control จะนับเฉพาะการกระทำที่ผ่านคำสั่งของบอท (`/voicekick`, `/voicemute`, `/voicedeaf`, และ Vote ที่ผ่านมติ) ไม่ได้ hook เข้ากับการ kick/ban ผ่านเมนู Discord โดยตรง
