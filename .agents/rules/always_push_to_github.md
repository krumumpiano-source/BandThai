# Always Push to GitHub

**CRITICAL RULE**: ทุกครั้งที่มีการสร้าง แก้ไข หรือลบไฟล์ในโปรเจกต์นี้ คุณ **ต้อง** รันคำสั่ง Git เพื่อ Commit และ Push ขึ้น GitHub เสมอ **และต้องนำไปรวมกับ main branch** เพื่อให้การแก้ไขอัปเดตไปที่หน้าเว็บจริง (Live Website - GitHub Pages) ทันที ห้ามลืมเด็ดขาด

**ขั้นตอนการทำงาน (Action Required):**
เมื่อคุณเขียนโค้ดเสร็จและยืนยันการทำงานแล้ว ก่อนจบการสนทนาในรอบนั้นๆ ให้รันชุดคำสั่งด้านล่างนี้ผ่าน Terminal เสมอ:
`git add . ; git commit -m "update: [สรุปสิ่งที่คุณเพิ่งแก้ไป]" ; git push origin dev ; git checkout main ; git merge dev ; git push origin main ; git checkout dev`

หากคุณละเลยกฎข้อนี้ จะถือเป็นการฝ่าฝืนคำสั่งขั้นร้ายแรงของ User
