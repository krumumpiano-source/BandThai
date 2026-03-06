// Comprehensive batch insert: parse song-report.txt and insert all remaining songs
const https = require('https');
const fs = require('fs');

const PAT = 'sbp_8f89f1ff1c856bc2bbd8159a6fa2943d0a9b7222';
const PROJECT = 'wsorngsyowgxikiepice';

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(data); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function esc(s) { return s ? s.replace(/'/g, "''") : ''; }

// Map of well-known Thai ลูกทุ่ง songs to their artists
const LUKTUNG_ARTISTS = {
  'กระทงหลงทาง': 'ไมค์ ภิรมย์พร',
  'กระท่อมทองกวาว': 'ไมค์ ภิรมย์พร',
  'กลับคำสาหล่า': 'ไมค์ ภิรมย์พร',
  'กอดน้องแน่นๆ': 'ยิ่งยง ยอดบัวงาม',
  'แก้วรอพี่': 'สายัณห์ สัญญา',
  'ไก่จ๋า': 'ยิ่งยง ยอดบัวงาม',
  'ขวัญใจพี่หลวง': 'สุนารี ราชสีมา',
  'ของหมั้นเป็นของขวัญ': 'สายัณห์ สัญญา',
  'ขอจองเป็นแรงใจ': 'ก้อง ห้วยไร่',
  'ขอเจ็บครึ่งใจ': 'ตั๊กแตน ชลดา',
  'ขอใจกันหนาว': 'ไมค์ ภิรมย์พร',
  'ขอใจเธอแลกเบอร์โทร': 'ไมค์ ภิรมย์พร',
  'ขอใช้สิทธิ์': 'ต่าย อรทัย',
  'ขอแท็กแฟนเก่า': 'ลำไย ไหทองคำ',
  'ขอบคุณแฟนเพลง': 'ไมค์ ภิรมย์พร',
  'ขอบใจเด้อ': 'มนต์แคน แก่นคูน',
  'ขอให้รวย': 'จินตหรา พูนลาภ',
  'ขาดคนหุงข้าว': 'ยิ่งยง ยอดบัวงาม',
  'ขาดเงินขาดรัก': 'สายัณห์ สัญญา',
  'ขายแรงแต่งนาง': 'ไมค์ ภิรมย์พร',
  'ข้าวไม่มีขาย': 'สายัณห์ สัญญา',
  'ขี้เมาสามช่า': 'สนธิ สมมาตร',
  'ขี้เมาอ้อนเมีย': 'ชาย เมืองสิงห์',
  'ขี้เหล้ามักไมค์': null,
  'เข้าเวรรอ': 'ต่าย อรทัย',
  'เขียนด้วยใจลบด้วยน้ำตา': 'สายัณห์ สัญญา',
  'เขียนฝันไว้ข้างฝา': 'ไมค์ ภิรมย์พร',
  'คนกล่อมโลก': 'ชาย เมืองสิงห์',
  'คนของวันพรุ่งนี้': 'ไมค์ ภิรมย์พร',
  'คนดังลืมหลังควาย': 'ต่าย อรทัย',
  'คนบ้านเดียวกัน': 'ไมค์ ภิรมย์พร',
  'คนมันรวย': 'ไมค์ ภิรมย์พร',
  'คนอกหักพักบ้านนี้': 'สายัณห์ สัญญา',
  'ครางชื่ออ้ายแน': 'ตั๊กแตน ชลดา',
  'ครูลำดวน': 'มนต์สิทธิ์ คำสร้อย',
  'คอพับ': 'ไมค์ ภิรมย์พร',
  'คาถามหานิยม': 'ตั๊กแตน ชลดา',
  'คารถแห่': 'ลำไย ไหทองคำ',
  'คิดถึงบ้านเกิด': 'ไมค์ ภิรมย์พร',
  'คึดฮอดกอดบ่ได้': 'มนต์แคน แก่นคูน',
  'คือเก่า': 'ไมค์ ภิรมย์พร',
  'คุณลำใย': 'ลำไย ไหทองคำ',
  'งัดถั่งงัด': 'ลำไย ไหทองคำ',
  'จั๊กกิ้มต๊กโต': 'ลำไย ไหทองคำ',
  'จากบ้านนาด้วยรัก': 'ไมค์ ภิรมย์พร',
  'จ้างมันเต๊ะ': 'ลำไย ไหทองคำ',
  'จิรักหรือจิหลอก': 'ต่าย อรทัย',
  'จี่หอย': 'ลำไย ไหทองคำ',
  'จูบไม่หวาน': 'สายัณห์ สัญญา',
  'ใจจะขาด': 'ไมค์ ภิรมย์พร',
  'ใจอ่อน': 'ตั๊กแตน ชลดา',
  'ชมทุ่ง': 'ชาย เมืองสิงห์',
  'ชวนน้องไปแทงเอี่ยน': 'ยิ่งยง ยอดบัวงาม',
  'ชอบไหม': 'ก้อง ห้วยไร่',
  'ช่างทองร้องไห้': 'สายัณห์ สัญญา',
  'ชีวิตฉันขาดเธอไม่ได้': 'ไมค์ ภิรมย์พร',
  'ด้วยแรงแห่งรัก': 'ชาย เมืองสิงห์',
  'ดอกนีออนบานค่ำ': 'ชาย เมืองสิงห์',
  'ดอกหญ้าในป่าปูน': 'ต่าย อรทัย',
  'ดาวเรืองดาวโรย': 'ไมค์ ภิรมย์พร',
  'ดำเนินจ๋า': 'สายัณห์ สัญญา',
  'เด็กมันยั่ว': 'ลำไย ไหทองคำ',
  'ต้องมีสักวัน': 'สายัณห์ สัญญา',
  'ติด ร. วิชาลืม': 'ต่าย อรทัย',
  'แตงเถาตาย': 'ตั๊กแตน ชลดา',
  'ทดเวลาบาดเจ็บ': 'มนต์แคน แก่นคูน',
  'ทบ2ลูกอีสาน': 'มนต์แคน แก่นคูน',
  'ทบ 2 ลูกอีสาน': 'มนต์แคน แก่นคูน',
  'ทำบาปบ่ลง': 'ต่าย อรทัย',
  'ทำบุญร่วมชาติ': 'ไมค์ ภิรมย์พร',
  'ทุ่งลุยลาย': 'ชาย เมืองสิงห์',
  'ทุยเพื่อนรัก': 'ไมค์ ภิรมย์พร',
  'เทพธิดาผ้าซิ่น': 'ไมค์ ภิรมย์พร',
  'เทพีบ้านไพร': 'ตั๊กแตน ชลดา',
  'น้องนอนไม่หลับ': 'ลำไย ไหทองคำ',
  'นักร้องงานเลี้ยง': 'ชาย เมืองสิงห์',
  'นักร้องบ้านนอก': 'ไมค์ ภิรมย์พร',
  'น้ำกรดแช่เย็น': 'สายัณห์ สัญญา',
  'น้ำค้างเดือนหก': 'ไมค์ ภิรมย์พร',
  'น้ำตาจ่าโท': 'สายัณห์ สัญญา',
  'น้ำตาโนราห์': 'ชาย เมืองสิงห์',
  'น้ำตาลก้นแก้ว': 'ตั๊กแตน ชลดา',
  'น้ำตาลาไทร': 'สายัณห์ สัญญา',
  'น้ำตาสาววาริน': 'สายัณห์ สัญญา',
  'น้ำตาไอ้หนุ่ม': 'ชาย เมืองสิงห์',
  'บ่กล้าบอกครู': 'ตั๊กแตน ชลดา',
  'บ่งืดจักเม็ด': 'ลำไย ไหทองคำ',
  'บ่เป็นหยังเขาเข้าใจ': 'มนต์แคน แก่นคูน',
  'บักแตงโม': 'ตั๊กแตน ชลดา',
  'บัวตูมบัวบาน': 'ไมค์ ภิรมย์พร',
  'โบว์แดงแสลงใจ': 'ตั๊กแตน ชลดา',
  'โบว์รักสีดำ': 'ตั๊กแตน ชลดา',
  'ปริญญาใจ': 'มนต์แคน แก่นคูน',
  'ปอยหลวงวังสะแกง': null,
  'ป๋าผัว': 'ลำไย ไหทองคำ',
  'ปู่ไข่ไก่หลง': 'ลำไย ไหทองคำ',
  'ปูนาขาเก': 'ลำไย ไหทองคำ',
  'ปูหนีบอิปิ': 'ลำไย ไหทองคำ',
  'เป็นโสดทำไม': 'ลำไย ไหทองคำ',
  'ผัวนิสัยเสีย': 'จินตหรา พูนลาภ',
  'ผีตายโหงกับโลงไม้ยาง': 'ยิ่งยง ยอดบัวงาม',
  'ผู้บ่าวเก่า': 'มนต์แคน แก่นคูน',
  'ผู้สาวขาเลาะ': 'ตั๊กแตน ชลดา',
  'ผู้หนีช้ำ': 'ต่าย อรทัย',
  'ฝนเทลงมา': 'ไมค์ ภิรมย์พร',
  'ฝากใบลา': 'ชาย เมืองสิงห์',
  'พกเมียมาด้วยเหรอ': 'ลำไย ไหทองคำ',
  'พบรักปากน้ำโพ': 'ชาย เมืองสิงห์',
  'มนต์รัก ตจว': 'ไมค์ ภิรมย์พร',
  'มนต์รักป่าซาง': 'สายัณห์ สัญญา',
  'มอเตอร์ไซค์ทำหล่น': 'ลำไย ไหทองคำ',
  'มะล่องก่องแก่ง': 'ลำไย ไหทองคำ',
  'มักอ้ายหลายเด้อ': 'ตั๊กแตน ชลดา',
  'มันต้องถอน': 'มนต์แคน แก่นคูน',
  'มันสวยดี': 'ลำไย ไหทองคำ',
  'มาลัยน้ำใจ': 'ชาย เมืองสิงห์',
  'มีคนเหงารออยู่เบอร์นี้': 'สายัณห์ สัญญา',
  'เมียด่ายังมาอยู่': 'ยิ่งยง ยอดบัวงาม',
  'เมียน้อยคอยรัก': 'สายัณห์ สัญญา',
  'เมียพี่มีชู้': 'ยิ่งยง ยอดบัวงาม',
  'แม่ฮ้างสามปี๋': null,
  'ไม่ใช่แฟนทำแทนไม่ได้': 'มนต์แคน แก่นคูน',
  'ไม่ได้ตั้งใจดำ': 'ตั๊กแตน ชลดา',
  'ไม่มีข้อแม้ตั้งแต่เริ่มต้น': 'ต่าย อรทัย',
  'ยาใจคนจน': 'ไมค์ ภิรมย์พร',
  'ร้องไห้กับเดือน': 'ชาย เมืองสิงห์',
  'รองูเข้าฝัน': 'สายัณห์ สัญญา',
  'รักควายๆ': 'ลำไย ไหทองคำ',
  'รักจางที่บางประกง': 'สายัณห์ สัญญา',
  'รักได้ครั้งละคน เชื่อใจได้คนละครั้ง': 'มนต์แคน แก่นคูน',
  'รักเติมโปร': 'ลำไย ไหทองคำ',
  'รักเธอเท่าฟ้า': 'ไมค์ ภิรมย์พร',
  'รักนี้มีกรรม': 'ต่าย อรทัย',
  'รักแม่ม่าย': 'ยิ่งยง ยอดบัวงาม',
  'รักสลายดอกฝ้ายบาน': 'ไมค์ ภิรมย์พร',
  'รักสาวนครสวรรค์': 'สายัณห์ สัญญา',
  'รักสาวลูกสอง': 'ไมค์ ภิรมย์พร',
  'รำคาญกะบอกกันเด้อ': 'มนต์แคน แก่นคูน',
  'เรียกพี่ได้ไหม': 'ลำไย ไหทองคำ',
  'รถบ่มีน้ำมัน': 'ชาย เมืองสิงห์',
  'รถแห่รถยู้': 'ลำไย ไหทองคำ',
  'โรคซึมเหล้า': null,
  'โรงแรมใจ': 'สายัณห์ สัญญา',
  'ล่องเรือหารัก': 'สายัณห์ สัญญา',
  'ละครชีวิต': 'ไมค์ ภิรมย์พร',
  'ลูกสาวนายจ้าง': 'สายัณห์ สัญญา',
  'ลูกสาวผู้การ': 'ไมค์ ภิรมย์พร',
  'เลิกแล้วค่ะ': 'ตั๊กแตน ชลดา',
  'เลือกคำว่าเจ็บ เก็บไว้คนเดียว': 'ต่าย อรทัย',
  'สเตตัสถึกทิ่ม': 'ลำไย ไหทองคำ',
  'ส้มตำ': 'ลำไย ไหทองคำ',
  'สมศรี 1992': null,
  'สยามเมืองยิ้ม': 'ชาย เมืองสิงห์',
  'สวมเขา': 'ยิ่งยง ยอดบัวงาม',
  'สาธุ': 'ไมค์ ภิรมย์พร',
  'สามพี่น้องไต': null,
  'สามสิบยังแจ๋ว': 'ลำไย ไหทองคำ',
  'สามโห่สามช่า': 'ลำไย ไหทองคำ',
  'สาวดำรำพัน': 'ชาย เมืองสิงห์',
  'สาวนครชัยศรี': 'สายัณห์ สัญญา',
  'สาวเพชรบุรี': 'ชาย เมืองสิงห์',
  'สาวเลี้ยงควาย': 'ไมค์ ภิรมย์พร',
  'สาวสวนแตง': 'ตั๊กแตน ชลดา',
  'สาวอิสานรอรัก': 'ต่าย อรทัย',
  'สาวเอเอ็ม': 'มนต์สิทธิ์ คำสร้อย',
  'สิบหกปีแห่งความหลัง': 'ไมค์ ภิรมย์พร',
  'สิฮิน้องบ่': 'มนต์แคน แก่นคูน',
  'เสียน้ำตาที่คาเฟ่': 'สายัณห์ สัญญา',
  'เสียสาวตี้สวนหอม': null,
  'โสดแล้วนะ': 'ลำไย ไหทองคำ',
  'หนาวจะตายอยู่แล้ว': 'ต่าย อรทัย',
  'หนาวแสงนีออน': 'ชาย เมืองสิงห์',
  'หนิงหน่อง': 'ลำไย ไหทองคำ',
  'หนีแม่มาแพ้รัก': 'ไมค์ ภิรมย์พร',
  'หนุ่มดอยหงอยเหงา': null,
  'หนุ่มนารอนาง': 'ไมค์ ภิรมย์พร',
  'หนูไม่เอา': 'ลำไย ไหทองคำ',
  'หม้ายขันหมาก': 'จินตหรา พูนลาภ',
  'หมากัด': 'ลำไย ไหทองคำ',
  'หยิกแกมหยอก': 'ลำไย ไหทองคำ',
  'หัวใจถวายวัด': 'ยิ่งยง ยอดบัวงาม',
  'หัวใจผมว่าง': 'ไมค์ ภิรมย์พร',
  'เห็นเธอที่เยอรมัน': null,
  'เหนื่อยไหมคนดี': 'มนต์แคน แก่นคูน',
  'ให้เคอรี่มาส่งได้บ่': 'มนต์แคน แก่นคูน',
  'อกหักจากคาเฟ่': 'สายัณห์ สัญญา',
  'อกหักเพราะรักเมีย': 'ยิ่งยง ยอดบัวงาม',
  'อกหักเพราะฮักอ้าย': 'ตั๊กแตน ชลดา',
  'อบต บุญมา': null,
  'อเมซซิ่งสุพรรณ': null,
  'อยากแต่งงานกับเธอ': 'ไมค์ ภิรมย์พร',
  'อยากนอนกับเธอ': 'ยิ่งยง ยอดบัวงาม',
  'อยากเป็นคนรัก ไม่อยากเป็นชู้': 'มนต์แคน แก่นคูน',
  'อยากให้เธอเข้าใจ': 'ไมค์ ภิรมย์พร',
  'อย่าขอหมอลำ': 'ลำไย ไหทองคำ',
  'อะไรจะเกิดก็ให้มันเกิด': null,
  'อ้ายมีเหตุผล': 'มนต์แคน แก่นคูน',
  'อิหล่าเอ๋ย': null,
  'อีกฝั่งของพระจันทร์': 'ต่าย อรทัย',
  'อีหล่าขาเด้ง': 'ลำไย ไหทองคำ',
  'อื้อฮื้อหล่อจัง': 'ลำไย ไหทองคำ',
  'เอาที่เธอสบายใจ': 'มนต์แคน แก่นคูน',
  'เอาที่สบายใจ': 'มนต์แคน แก่นคูน',
  'เอาป่าว': 'ลำไย ไหทองคำ',
  'เอาผัวไปเทริน': 'ลำไย ไหทองคำ',
  'แอวลั่นปั๊ด': 'ลำไย ไหทองคำ',
  'ไอ้หนุ่มรถไถ': 'ไมค์ ภิรมย์พร',
  'ไอ้หนุ่มเลี้ยงควาย': 'ไมค์ ภิรมย์พร',
  'ไอ้หวังตายแน่': 'ยิ่งยง ยอดบัวงาม',
  'เฮดทุกวิถีทาง': 'มนต์แคน แก่นคูน',
  'ภาวะแทรกซ้อน': 'ลำไย ไหทองคำ',
  'ปู้หนีบ': 'ลำไย ไหทองคำ',
  'เปลี่ยนพ.ศ.ใหม่ เปลี่ยนใจหรือยัง': 'มนต์แคน แก่นคูน',
  'เปิดกระโปรงสาวแต': 'ลำไย ไหทองคำ',
};

// สำรองเก่า+เพื่อชีวิต artists
const SAMRONG_OLD_ARTISTS = {
  'ก็เคยสัญญา': 'อัสนี วสันต์',
  'กระต่ายในจันทร์': 'เรนโบว์',
  'กระต่ายหมายจันทร์': 'เรนโบว์',
  'กระท่อมกัญชา': 'คาราบาว',
  'กลับกลาย': 'คาราบาว',
  'กัญชา': 'คาราบาว',
  'กำลังใจ': 'แจ้ ดนุพล',
  'กำลังใจที่เธอไม่รู้': 'แจ้ ดนุพล',
  'เกลียดคนสวย': 'คาราบาว',
  'แกเพื่อนฉัน': 'คาราบาว',
  'ข้างหลังภาพ': 'พงษ์สิทธิ์ คำภีร์',
  'เขเรือ': 'คีรีบูน',
  'คนเก็บฟืน': 'พงษ์สิทธิ์ คำภีร์',
  'คนขี้อาย': 'เรนโบว์',
  'คนไม่มีสิทธิ์': 'แจ้ ดนุพล',
  'คนล่าฝัน': 'พงษ์สิทธิ์ คำภีร์',
  'คนหนังเหนึยว': 'คาราบาว',
  'คำสัญญาที่หาดใหญ่': 'แจ้ ดนุพล',
  'คิดถึงบ้าน': 'เรนโบว์',
  'แค่นั้น': 'อัสนี วสันต์',
  'โง่งมงาย': 'คาราบาว',
  'จดหมายถึงพ่อ': 'พงษ์สิทธิ์ คำภีร์',
  'จ.รอคอย': 'มาลีฮวนน่า',
  'ฉันทนาที่รัก': 'แจ้ ดนุพล',
  'ชาวนาอาลัย': 'คาราบาว',
  'ชู้ทางใจ': 'แจ้ ดนุพล',
  'ซาอุดร': 'คาราบาว',
  'ดอกไผ่บาน *': 'คาราบาว',
  'ดาวในฝัน': 'เรนโบว์',
  'ดาวประดับใจ': 'คีรีบูน',
  'เด็กปั๊ม': 'คาราบาว',
  'ต้นขับขี่': 'คาราบาว',
  'ตลอดเวลา': 'มาลีฮวนน่า',
  'ตังเก': 'คาราบาว',
  'ถนนแปลกแยก': 'เรนโบว์',
  'ไถ่เธอคืนมา': 'แจ้ ดนุพล',
  'ทางสายเปลี่ยว': 'คีรีบูน',
  'ทำดีได้ดี': 'คาราบาว',
  'ได้อย่างเสียอย่าง': 'พงษ์สิทธิ์ คำภีร์',
  'เทวดาเดินดิน': 'อัสนี วสันต์',
  'นางงามตู้กระจก': 'คาราบาว',
  'นางโลม': 'คาราบาว',
  'น้ำตาแม่': 'พงษ์สิทธิ์ คำภีร์',
  'น้ำตาหอยทาก': 'คาราบาว',
  'บ่อสร้างกลางจ้อง': 'คีรีบูน',
  'บัวลอย': 'มาลีฮวนน่า',
  'บางระจันวันเพ็ญ': 'คาราบาว',
  'บาปบริสุทธิ์': 'คาราบาว',
  'บิ๊กสุ': 'คาราบาว',
  'ปลูกรัก': 'แจ้ ดนุพล',
  'ผ้าขี้ริ้ว': 'ไมโคร',
  'ฝนจางนางหาย': 'แจ้ ดนุพล',
  'ฝากรัก': 'คีรีบูน',
  'พบรักที่ปากน้ำโพ': 'ชาย เมืองสิงห์',
  'พร้าว': 'คาราบาว',
  'พ่อเป็นกรรมกร': 'คาราบาว',
  'พิษรักพิษณุโลก': 'คีรีบูน',
  'เพื่อชีวิตติดล้อ': 'คาราบาว',
  'ม': 'ม',
  'มนต์ไทรโยค': 'แจ้ ดนุพล',
  'มนต์เพลงคาราบาว': 'คาราบาว',
  'มหาลัย': 'ไมโคร',
  'มาตามสัญญา': 'มาลีฮวนน่า',
  'มือปืน': 'คาราบาว',
  'แมงปอปีกบาง': 'นูโว',
  'แม่ย่านาง': 'คาราบาว',
  'แม่สาย': 'คีรีบูน',
  'ยากยิ่งนัก #': 'เบิร์ด ธงไชย',
  'รักเขาทำไม': 'แจ้ ดนุพล',
  'รักทรหด': 'มาลีฮวนน่า',
  'รักปอนๆ': 'คาราบาว',
  'รักยืนยง': 'แจ้ ดนุพล',
  'รั้วทะเล': 'คาราบาว',
  'ราชาเงินผ่อน': 'คาราบาว',
  'ร้ายๆ': 'ไมโคร',
  'เรารักกันไม่ได้': 'อัสนี วสันต์',
  'เรียนและงาน': 'คาราบาว',
  'เรือรักกระดาษ': 'แจ้ ดนุพล',
  'แร้งคอย': 'คาราบาว',
  'โรงเรียนของหนู': 'มาลีฮวนน่า',
  'ลมเพลมพัด': 'คาราบาว',
  'ลมหายใจของความคิดถึง': 'นูโว',
  'ลุงขี้เมา': 'มาลีฮวนน่า',
  'ว่างเปล่า': 'มาลีฮวนน่า',
  'วณิพก': 'พงษ์สิทธิ์ คำภีร์',
  'วิชาแพะ': 'คาราบาว',
  'เส้นทางสายปลาแดก': 'คาราบาว',
  'เสียงอีสาน': 'พงษ์สิทธิ์ คำภีร์',
  'แสงจันทร์': 'มาลีฮวนน่า',
  'หงส์ฟ้า *': 'คีรีบูน',
  'หนุ่มน้อย': 'เรนโบว์',
  'หนุ่มหาดใหญ่สาวเชียงใหม่': 'แจ้ ดนุพล',
  'ห้องสีขาว': 'นูโว',
  'หัวใจพรือโฉ้': 'คาราบาว',
  'หัวใจละเหี่ย': 'คาราบาว',
  'หัวใจสะออน': 'คาราบาว',
  'หำเทียม': 'คาราบาว',
  'หยุดท้อ': 'เรนโบว์',
  'หลวงพ่อคูณ': 'คาราบาว',
  'เหล้าจ๋า': 'คาราบาว',
  'ให้มันเป็นไป': 'คาราบาว',
  'ให้เธอ': 'มาลีฮวนน่า',
  'อธิษฐานรัก': 'แจ้ ดนุพล',
  'อยากพับแผ่นฟ้า': 'แจ้ ดนุพล',
  'อยากให้รู้ใจ': 'เรนโบว์',
  'อยากให้อยู่ด้วยไหม': 'มาลีฮวนน่า',
  'อย่าดีกว่า': 'มาลีฮวนน่า',
  'อยู่ตรงนี้': 'มาลีฮวนน่า',
  'อยู่ที่ไหนก็เหงาได้': 'นูโว',
  'อายฟ้าดิน #': 'เรนโบว์',
  'อายฟ้าดิน': 'เรนโบว์',
  'เอาไปเลย': 'คาราบาว',
  'โอ๊ยๆ': 'อัสนี วสันต์',
  'ไอ้ไบ้': 'คาราบาว',
  'สัญญาเจ้าลืม': 'คีรีบูน',
  'สัญญาหน้าฝน': 'แจ้ ดนุพล',
  'สาวเบียร์ช้าง': 'คาราบาว',
  'สาวรำวง': 'คาราบาว',
  'ความรักสีดำ': 'คาราบาว',
  'ไลอกกันเล่นรึเปล่า': 'มาลีฮวนน่า',
  'หมาหยอกไก่': 'คาราบาว',
  'ไข่นุ้ยสาวจันทร์ หนุ่มบาวสาวปาน': null,
  'งานวัด #': null,
  'เอาไปเลย': 'คาราบาว',
};

// เพลงเก่าร้าน songs with gender
const OLD_SHOP_SONGS = {
  'ก็เคยสัญญา': { singer: 'ชาย', artist: 'อัสนี วสันต์' },
  'กระต่ายในจันทร์': { singer: 'ชาย', artist: 'เรนโบว์' },
  'ขอคนใจ๋ดีเป๋นเพื่อนปี้สักคน': { singer: 'ชาย', artist: 'จรัล มโนเพ็ชร' },
  'ขอบใจจริงๆ': { singer: 'ชาย', artist: null },
  'คนขี้เหงา': { singer: 'ชาย', artist: 'แจ้ ดนุพล' },
  'คอย': { singer: 'ชาย', artist: 'อัสนี วสันต์' },
  'แค่เสียใจไม่พอ': { singer: 'หญิง', artist: null },
  'ดีเจเสียงใส': { singer: 'หญิง', artist: null },
  'ตัวสำรอง': { singer: 'ชาย', artist: 'พงษ์สิทธิ์ คำภีร์' },
  'ตายทั้งเป็น': { singer: 'ชาย', artist: 'แจ้ ดนุพล' },
  'เติมน้ำมัน': { singer: 'ชาย', artist: null },
  'บัวน้อมคอยรัก': { singer: 'ชาย', artist: 'จรัล มโนเพ็ชร' },
  'ปราสาททราย': { singer: 'ชาย', artist: 'อัสนี วสันต์' },
  'ปล่อยใจฝัน': { singer: 'หญิง', artist: 'ใหม่ เจริญปุระ' },
  'พะเยารอเธอ': { singer: 'ชาย', artist: null },
  'เพราะเธอ': { singer: 'ชาย', artist: null },
  'รอยสุนทรภู่': { singer: 'ชาย', artist: null },
  'สายลม': { singer: 'ชาย', artist: null },
  'ว้าเหว่': { singer: 'ชาย', artist: null },
  'หมั่นคอยดูแลรักษาดวงใจ': { singer: 'ชาย', artist: null },
  'อกหักให้มันเท่ๆหน่อย': { singer: 'ชาย', artist: null },
  'โอ๊ยโอ๊ย': { singer: 'หญิง', artist: null },
  'เชียงรายรำลึก': { singer: 'ชาย', artist: null },
  'ใจรัก': { singer: 'ชาย', artist: null },
  'รักเป็นดั่งต้นไม้': { singer: 'ชาย', artist: 'ไมโคร' },
  'ยอมรับคนเดียว': { singer: 'ชาย', artist: null },
};

// Song name corrections (typo → corrected)
const TYPO_CORRECTIONS = {
  'กระแซธเข้ามาซิ': 'กระแซะเข้ามาซิ',
  'กลัาพอไหม': 'กล้าพอไหม',
  'ชวนน้้องแต่งงาน': 'ชวนน้องแต่งงาน',
  'ทั้ั้งๆที่รู้': 'ทั้งๆที่รู้',
  'ฉัันรักผัวเขา': 'ฉันรักผัวเขา',
  'ฝัากเลี้ยง': 'ฝากเลี้ยง',
  'ยิ่่งสูงยิ่งหนาว': 'ยิ่งสูงยิ่งหนาว',
  'เจ็้าสาวที่กลัวฝน': 'เจ้าสาวที่กลัวฝน',
  'พบรักปากน้นำโพ': 'พบรักปากน้ำโพ',
  'รุ่ักจริงให้ติงนัง': 'รักจริงให้ติงนัง',
  'หญิิงลั้ลลา': 'หญิงลี ลั้ลลา',
  'ระเบิ่ดเวลา': 'ระเบิดเวลา',
  'หนููไม่รู': 'หนูไม่รู้',
  'เด๋อเดียงดาง': 'เด๋อเดี่ยงด่าง',
  'พลิ้กล้อค': 'พลิกล็อก',
  'พลิกล๊อค': 'พลิกล็อก',
  'ชาวนากับงู่เห่า': 'ชาวนากับงูเห่า',
  'เลืดกรุ้ปB': 'เลือดกรุ๊ป B',
  'เลือดกรุ้ป': 'เลือดกรุ๊ป',
  'ฃอบใจเด้อ': 'ขอบใจเด้อ',
  '30ยังแจ๋ว': 'สามสิบยังแจ๋ว',
  'californcation': 'Californication',
  'Celebreation': 'Celebration',
  'Desparado': 'Desperado',
  'Jaihouse rock': 'Jailhouse Rock',
  'Billi jean': 'Billie Jean',
  'Blue sued shoes': 'Blue Suede Shoes',
  'blus suede shoes': 'Blue Suede Shoes',
  'Still god the blues': 'Still Got the Blues',
  'Yello river': 'Yellow River',
  'i will suvice': 'I Will Survive',
  'troble is a friend': 'Trouble Is a Friend',
  'whitout you': 'Without You',
  'stupid cipid': 'Stupid Cupid',
  'Goog morning': 'Good Morning',
  'Have i told you lovely': 'Have I Told You Lately',
  'Right hear waiting': 'Right Here Waiting',
  'love potion numder 9': 'Love Potion Number Nine',
  "Sweet child O'clock Mine": "Sweet Child O' Mine",
  "Don't look back in angel": "Don't Look Back in Anger",
  'Valery': 'Valerie',
  'Superstitions': 'Superstition',
  'Live and Lean': 'Live and Learn',
  'tear in heaven': 'Tears in Heaven',
  'Last trainto london': 'Last Train to London',
  'Unchain melody': 'Unchained Melody',
  'Somethink good': 'Something Good',
  'Who stop the rain': 'Who\'ll Stop the Rain',
  "Let' twist again": "Let's Twist Again",
  'Yesterday one more': 'Yesterday Once More',
  'Stoney': 'Stoney',
};

// English songs with artists (from เพลงเก่าร้าน)
const ENGLISH_ARTISTS = {
  'Achy Breaky Heart': { artist: 'Billy Ray Cyrus', singer: 'ชาย', era: '90s' },
  'After the Love Has Gone': { artist: 'Earth, Wind & Fire', singer: 'ชาย', era: '80s' },
  "A Hard Day's Night": { artist: 'The Beatles', singer: 'ชาย', era: '80s' },
  'A Little Bit More': { artist: 'Dr. Hook', singer: 'ชาย', era: '80s' },
  'Bad Moon Rising': { artist: 'Creedence Clearwater Revival', singer: 'ชาย', era: '80s' },
  'Beautiful Sunday': { artist: 'Daniel Boone', singer: 'ชาย', era: '80s' },
  'Billie Jean': { artist: 'Michael Jackson', singer: 'ชาย', era: '80s' },
  'Black Magic Woman': { artist: 'Santana', singer: 'ชาย', era: '80s' },
  'Blue Suede Shoes': { artist: 'Elvis Presley', singer: 'ชาย', era: '80s' },
  'Bohemian Rhapsody': { artist: 'Queen', singer: 'ชาย', era: '80s' },
  'Boogie Wonderland': { artist: 'Earth, Wind & Fire', singer: 'ชาย', era: '80s' },
  'Boulevard': { artist: 'Dan Byrd', singer: 'ชาย', era: '80s' },
  'Californication': { artist: 'Red Hot Chili Peppers', singer: 'ชาย', era: '90s' },
  'Celebration': { artist: 'Kool & The Gang', singer: 'ชาย', era: '80s' },
  'Come Together': { artist: 'The Beatles', singer: 'ชาย', era: '80s' },
  'Creep': { artist: 'Radiohead', singer: 'ชาย', era: '90s' },
  'Desperado': { artist: 'Eagles', singer: 'ชาย', era: '80s' },
  'D.I.S.C.O.': { artist: 'Ottawan', singer: 'คู่', era: '80s' },
  'Drunk in the Morning': { artist: 'Lukas Graham', singer: 'ชาย', era: '2010s' },
  'Everybody': { artist: 'Backstreet Boys', singer: 'ชาย', era: '90s' },
  'Feels': { artist: 'Calvin Harris', singer: 'ชาย', era: '2010s' },
  'Getaway': { artist: 'Earth, Wind & Fire', singer: 'ชาย', era: '80s' },
  'Good Morning Teacher': { artist: null, singer: null, era: null },
  'Hey Jude': { artist: 'The Beatles', singer: 'ชาย', era: '80s' },
  'Hysteria': { artist: 'Muse', singer: 'ชาย', era: '2000s' },
  'I Feel Good': { artist: 'James Brown', singer: 'ชาย', era: '80s' },
  'I Want to Hold Your Hand': { artist: 'The Beatles', singer: 'หญิง', era: '80s' },
  'Kiss Me': { artist: 'Sixpence None the Richer', singer: 'หญิง', era: '90s' },
  'Kung Fu Fighting': { artist: 'Carl Douglas', singer: 'ชาย', era: '80s' },
  'Ladies Night': { artist: 'Kool & The Gang', singer: 'หญิง', era: '80s' },
  'Lady Bump': { artist: 'Penny McLean', singer: 'หญิง', era: '80s' },
  'Lemon Tree': { artist: 'Fool\'s Garden', singer: 'ชาย', era: '90s' },
  "Let's Groove": { artist: 'Earth, Wind & Fire', singer: 'ชาย', era: '80s' },
  "Let's Twist Again": { artist: 'Chubby Checker', singer: 'ชาย', era: '80s' },
  'Linda Linda': { artist: 'The Blue Hearts', singer: 'ชาย', era: '80s' },
  'Linger': { artist: 'The Cranberries', singer: 'หญิง', era: '90s' },
  'Lodi': { artist: 'Creedence Clearwater Revival', singer: 'ชาย', era: '80s' },
  'Love Me Do': { artist: 'The Beatles', singer: 'หญิง', era: '80s' },
  'Love Never Felt So Good': { artist: 'Michael Jackson', singer: 'ชาย', era: '2010s' },
  'Love Potion Number Nine': { artist: 'The Clovers', singer: 'ชาย', era: '80s' },
  'Lover Boy': { artist: 'Phum Viphurit', singer: 'ชาย', era: '2010s' },
  'Mercy': { artist: 'Duffy', singer: 'หญิง', era: '2000s' },
  'Michelle': { artist: 'The Beatles', singer: 'หญิง', era: '80s' },
  'One Day': { artist: 'Matisyahu', singer: 'ชาย', era: '2010s' },
  'One Last Kiss': { artist: null, singer: 'ชาย', era: null },
  'Papa': { artist: 'Paul Anka', singer: 'ชาย', era: '80s' },
  'Photograph': { artist: 'Ed Sheeran', singer: 'ชาย', era: '2010s' },
  'P.S. I Love You': { artist: 'The Beatles', singer: 'ชาย', era: '80s' },
  'Radioactive': { artist: 'Imagine Dragons', singer: 'ชาย', era: '2010s' },
  'Rhinestone Cowboy': { artist: 'Glen Campbell', singer: 'ชาย', era: '80s' },
  'Rock Around the Clock': { artist: 'Bill Haley', singer: 'ชาย', era: '80s' },
  'Seasons in the Sun': { artist: 'Terry Jacks', singer: 'ชาย', era: '80s' },
  'Sexbomb': { artist: 'Tom Jones', singer: 'ชาย', era: '2000s' },
  'Shake Shake Shake': { artist: 'KC and the Sunshine Band', singer: 'ชาย', era: '80s' },
  'Smoke on the Water': { artist: 'Deep Purple', singer: 'ชาย', era: '80s' },
  "Something Good": { artist: null, singer: 'ชาย', era: null },
  'Stairway to Heaven': { artist: 'Led Zeppelin', singer: 'ชาย', era: '80s' },
  'Still Got the Blues': { artist: 'Gary Moore', singer: 'ชาย', era: '90s' },
  "Sweet Child O' Mine": { artist: 'Guns N\' Roses', singer: 'ชาย', era: '80s' },
  'Superstition': { artist: 'Stevie Wonder', singer: 'ชาย', era: '80s' },
  'Take It Easy': { artist: 'Eagles', singer: 'ชาย', era: '80s' },
  'Take Me Home Country Roads': { artist: 'John Denver', singer: 'ชาย', era: '80s' },
  'Tears in Heaven': { artist: 'Eric Clapton', singer: 'ชาย', era: '90s' },
  "That's the Way": { artist: 'KC and the Sunshine Band', singer: 'ชาย', era: '80s' },
  'The End of the World': { artist: 'Skeeter Davis', singer: 'หญิง', era: '80s' },
  'Unchained Melody': { artist: 'Righteous Brothers', singer: 'หญิง', era: '80s' },
  'Unfriend': { artist: null, singer: null, era: null },
  'Uptown Funk': { artist: 'Bruno Mars', singer: 'ชาย', era: '2010s' },
  'Valerie': { artist: 'Amy Winehouse', singer: 'หญิง', era: '2000s' },
  'Walk You Home': { artist: null, singer: 'ชาย', era: null },
  "Who'll Stop the Rain": { artist: 'Creedence Clearwater Revival', singer: 'ชาย', era: '80s' },
  'Words': { artist: 'Bee Gees', singer: 'ชาย', era: '80s' },
  'Yellow River': { artist: 'Christie', singer: 'ชาย', era: '80s' },
  'Young Dumb and Broke': { artist: 'Khalid', singer: 'ชาย', era: '2010s' },
  'Amplify Love': { artist: null, singer: null, era: null },
  'Galaxy': { artist: null, singer: null, era: null },
  'Spotlight': { artist: null, singer: null, era: null },
  'Superstar': { artist: null, singer: null, era: null },
  'Oops': { artist: null, singer: null, era: null },
  'Girls Like You': { artist: 'Maroon 5', singer: 'ชาย', era: '2010s' },
  "She's the One": { artist: 'Robbie Williams', singer: 'ชาย', era: '2000s' },
};

// Songs to skip (noise, duplicates under corrected names, single chars etc)
const SKIP_SONGS = new Set([
  'ม', // single char
  '24 K', // duplicate of existing ??? or noise
  'คือเธอใช่ไหม (Collab Version)', // duplicate pattern
  'สิเทน้อง ให้บอกแน', // duplicate of สิเทน้องให้บอกแน
  'ไผว่าสิบ่ถิ่มกัน', // duplicate of ไสว่าสิบ่ถิ่มกัน
  'ลู้นเกล้าเผ่าไทย', // duplicate of ลุ้นเกล้าเผ่าไทย
  'เอาที่สบายใจ', // duplicate of เอาที่เธอสบายใจ
  'ทบ 2 ลูกอีสาน', // duplicate of ทบ2ลูกอีสาน
  'เลือดกรุ้ป', // duplicate of เลือดกรุ๊ป B
  'เลืดกรุ้ปB', // duplicate of เลือดกรุ๊ป B
  'Billy jean', // duplicate of Billie Jean
  'blus suede shoes', // duplicate of Blue Suede Shoes
  'Y.M.C.A', // duplicate of Y.M.C.A.
  'can\'t take my eye', // duplicate of Can't Take My Eyes...
  'Billi jean', // duplicate
  'Blue sued shoes', // duplicate
  'Right hear waiting', // duplicate
  'Yesterday one more', // duplicate of Yesterday Once More
  'still got the blues', // duplicate  
  'Somethink good', // duplicate corrected as Something Good
  'i will alway', // partial/duplicate
  'like i\'m gon', // partial
  'thing', // noise
  'Goog morning', // duplicate corrected
  'stupid cipid', // duplicate corrected
  'shalala', // duplicate of Sha La La
  'don\'t look back in', // partial
  'she will be love', // partial
  'saving all my love', // partial
  'troble is a friend', // duplicate corrected
  'whitout you', // duplicate corrected
  'i will suvice', // duplicate corrected
  'i will alway love you', // duplicate of I Will Always Love You
  'right here waiting for you', // duplicate
  'Right here', // partial
  'Move like jagger', // partial
  'when you say nothing', // partial
  'don\'t let me down', // partial dup of Don't Let Me Down
  'ymca', // duplicate of Y.M.C.A.
  'like i\'m gonna lose you', // duplicate
  'can\'t take my eye off you', // duplicate
  'เค้าก่อน', // merged entry from นิโย (key notation issue)
  'แก้มน้องนาง C ขึ้น', // variant of แก้มน้องนางนั้นแดงกว่าใคร
  'เจ็บละเนาะ C ขึ้น', // key variant
  'เชื่อฉัน G ขึ้น', // key variant
  'หมอกหรือควัน C ขึ้น', // key variant
  'หมอก C ขึ้น', // key variant
  'หลับตา ขึ้น', // key variant
  'นิทาน ขึ้น', // key variant
  'สบายดีรึเปล่า C', // key variant
  'มันเป็นใคร ขึ้น', // key variant
  'ท้องฟ้าc', // key variant
  'ยังคงคอย HER', // more specific duplicate
  'ผช ในฝัน', // abbreviation
  'ผญ ลืมยาก', // abbreviation  
  'ร W8 โบกี้', // duplicate
  'ร W8', // partial
  'รw8', // partial
  'คู่ชีวิต ดร.ฟู', // variant
  'บูมเมอแรง โนมอเทียร์', // variant
  'น้ำลาย txrbo', // specific: already added via ลิสวง as น้ำลาย
  'เพียงชายคนนี้ ไม่ใช่ผู้วิเศษ', // combined title
  'ฝน เบิร์ดฮาร์ท', // already added as ฝน
  'ใจโทรมๆ', // specific singer variant
  'รักครั้งแรก ชาตรี', // already added
  'รักครั้งแรก #', // duplicate
  'พะเยารอเธอ *', // duplicate
  'บัวน้อมคอยรัก', // typo of 'บัวน้อยคอยรัก' in report 
  'บัวน้อยคอยรัก #', // duplicate
  'รักฉันนั้นเพื่อเธอ #', // duplicate
  'รักใน Cmaj #', // duplicate
  'ลืมเสียเถิด #', // duplicate
  'แสนรัก #', // duplicate
  'ดอกไผ่บาน *', // already as ดอกไผ่บาน
  'หงส์ฟ้า *', // already
  'นิดนึงพอ', // already added in batch
  'เพียงแค่ใจ', // abbreviation
  'ซูลู', // abbreviation
  'ตราบธุลี', // abbreviation
  'ดอกไม้แจกัน', // abbreviation of ดอกไม้กับแจกัน, already added
  'คำถาม E ท้อฟฟี่', // alternative name of คำถาม, added
  'ภูมิแพ้ กทม', // abbreviation of ภูมิแพ้กรุงเทพ, added
  'ชั่วคราวค้างคืน', // abbreviation of ชั่วคราวหรือค้างคืน, added
  'ใครสักคน', // already added
  'เงียบๆคนเดียว', // already added as เงียบๆ คนเดียว
  'โปรดส่งใครมารัก', // abbreviation, already added
  'อย่าทำให้ฟ้า', // abbreviation, already added
  'อยากมีแฟนแล้ว ส้มมารี', // already added
  'เลิกคุย', // abbreviation of เลิกคุยทั้งอำเภอ
  'ไว้ใจ เคลียร์', // duplicate of ไว้ใจ
  'ใสว่า', // abbreviation of ไสว่าสิบ่ถิ่มกัน
  'ฉันยังรักเธอ เต้ย+ยุ่งยิ่ง', // duplicate of ฉันยังรักเธอ
  'โอ้ใจเอ๋ย', // already added
  'แอบเจ็บ', // already added
  'รู้เห็นเป็นใจ', // already added
  'รับได้ไหมถ้ามีใครอีกคน', // already added
  'วาฬ', // abbreviation, วาฬเกยตื้น already added
  'รัก C ปุ้', // abbreviation of รัก (ปุ๊ อัญชลี), added
  'คิดถึง ปาล์มมี่', // abbreviation, already added คิดถึง
  'อาจเป็นเธอ', // already added
  'แก้วรอพี่', // duplicate pattern
  'ดาว พอส', // abbreviation of ดาว (พอส Playground), added
  'ความลับ มัม', // partial
  'ขอเป็นพระเอกใน', // partial
  'แค่มีเธอเดินไปเตะคลื่นทะเล', // full name variant
  'ต่อจากนี้เพลงรักทุกเพลง', // abbreviation, already added
  'ยืนยอม', // likely typo of ยินยอม, already added
  'ยื้อ เบน ชลาทิศ', // already added
  'รอจนพอ แมว', // already added
  'ไม่เคย muzu', // duplicate ไม่เคย
  'ไม่ใช่ผู้วิเศษ', // already added
  'ใจบางบาง', // already added
  'ปอดๆ', // already added
  'ขอดาว', // fragment
  'ทิ้ง Stamp', // fragment
  'ใครเจ็บกว่า', // fragment
  'โอ้ย โอ้ย', // fragment
  'ใจคนคอย', // fragment
  'ในวันที่เขาต้องไป', // fragment
  'เธอมากับฝน', // fragment
  'girls like you', // duplicate
  'photograph', // duplicate
  'I don\'t wanna miss', // partial
  'I don\'t want to talk about it', // already added
  'I just wonna pen fan you dai bor', // already added different spelling
  'Bohemian rhapsody&radio gaga', // dual
  'อยากให้รู้ว่ารักเธอ', // fragment from ตอง
  "She 's the one", // corrected
  'เพลงเก่าร้าน', // header
  'คิดถึงแต่ โบกี้', // abbreviation, already added
  'พูดอักที', // corrected pluedting already added
  'ฉันรักผัวเขา', // already handled 
  'ฉันหรือเธอ....', // already in db?
  'ฉัันรักผัวเขา', // typo corrected already handled
  'ฝัากเลี้ยง', // already added as ฝากเลี้ยง
  'ทั้ั้งๆที่รู้', // already added  
  'เจ็้าสาวที่กลัวฝน', // already added as เจ้าสาวที่กลัวฝน
  'พลิกล๊อค', // already added as พลิกล็อก
  'พลิ้กล้อค', // already added as พลิกล็อก
  'ชาวนากับงู่เห่า', // already added as ชาวนากับงูเห่า
  'ยิ่่งสูงยิ่งหนาว', // typo corrected
  'หนููไม่รู', // typo corrected
  'เด๋อเดียงดาง', // duplicate of เด๋อเดี่ยงด่าง already handled
  'ระเบิ่ดเวลา', // already added as ระเบิดเวลา
  'รุ่ักจริงให้ติงนัง', // typo corrected
  'ชวนน้้องแต่งงาน', // typo corrected
  'กระแซธเข้ามาซิ', // typo corrected
  'หญิิงลั้ลลา', // typo corrected
  'สิเทน้องให้บอกแน', // duplicate of สิเทน้อง ให้บอกแน
  'Hey jude', // already corrected
  'I feel good', // already corrected
  'Californcation', // already corrected
  'Celebreation', // already corrected
  'californcation', // already corrected
  'Desparado', // already corrected
  'Jaihouse rock', // already corrected
  'Still god the blues', // already corrected
  'Yello river', // already corrected
  'love potion numder 9', // already corrected
  "Sweet child O'clock Mine", //corrected
  "Don't look back in angel", // corrected
  'Valery', // corrected
  'Superstitions', // corrected
  'Live and Lean', // corrected as Live and Learn
  'tear in heaven', // corrected
  'Last trainto london', // corrected
  'Unchain melody', // corrected
  'Have i told you lovely', // corrected
  "Let' twist again", // corrected
  'Billi jean', // corrected
  'Blue sued shoes', // corrected
  'blus suede shoes', // corrected
  'nighest on', // noise
  'Last trainto london', // typo → already added as Last Train to London
  'walk you home', // already
  'achy breaky heart', // lowercase
  'Who stop the rain', // corrected
]);

async function main() {
  console.log('Fetching current song list...');
  const existing = await query("SELECT name FROM band_songs WHERE source='global'");
  console.log(`Current total: ${existing.length}`);
  
  const existSet = new Set(existing.map(r => r.name.toLowerCase().trim()));
  
  // Parse song-report.txt
  const report = fs.readFileSync('song-report.txt', 'utf8');
  const lines = report.split('\n');
  
  let inNewSection = false;
  const newSongs = [];
  
  for (const line of lines) {
    if (line.startsWith('--- NEW SONGS')) { inNewSection = true; continue; }
    if (line.startsWith('--- BPM/KEY')) { inNewSection = false; break; }
    if (!inNewSection || !line.trim()) continue;
    
    // Parse: name | key=X | bpm=Y | singer=Z | [sources]
    const parts = line.split(' | ');
    const name = parts[0].trim();
    let key = null, bpm = null, singer = null, sources = [];
    
    for (const p of parts.slice(1)) {
      const t = p.trim();
      if (t.startsWith('key=')) key = t.substring(4);
      else if (t.startsWith('bpm=')) bpm = parseInt(t.substring(4));
      else if (t.startsWith('singer=')) singer = t.substring(7);
      else if (t.startsWith('[')) sources = t.replace('[', '').replace(']', '').split(',');
    }
    
    newSongs.push({ name, key, bpm, singer, sources });
  }
  
  console.log(`Parsed ${newSongs.length} new songs from report`);
  
  // Build inserts
  const inserts = [];
  let skipCount = 0;
  let dupCount = 0;
  
  for (const song of newSongs) {
    let { name, key, bpm, singer, sources } = song;
    
    // Skip noise/duplicates
    if (SKIP_SONGS.has(name)) { skipCount++; continue; }
    
    // Apply typo corrections
    if (TYPO_CORRECTIONS[name]) name = TYPO_CORRECTIONS[name];
    
    // Skip if already in DB
    if (existSet.has(name.toLowerCase().trim())) { dupCount++; continue; }
    
    // Look up artist from various sources
    let artist = null;
    let era = null;
    
    // Check ลูกทุ่ง artists
    if (LUKTUNG_ARTISTS[name] !== undefined) artist = LUKTUNG_ARTISTS[name];
    // Check สำรองเก่า artists
    if (!artist && SAMRONG_OLD_ARTISTS[name] !== undefined) artist = SAMRONG_OLD_ARTISTS[name];
    // Check เพลงเก่าร้าน
    if (OLD_SHOP_SONGS[name]) {
      if (!singer) singer = OLD_SHOP_SONGS[name].singer;
      if (!artist && OLD_SHOP_SONGS[name].artist) artist = OLD_SHOP_SONGS[name].artist;
    }
    // Check English songs
    if (ENGLISH_ARTISTS[name]) {
      const info = ENGLISH_ARTISTS[name];
      if (!artist && info.artist) artist = info.artist;
      if (!singer && info.singer) singer = info.singer;
      if (!era && info.era) era = info.era;
    }
    
    // Determine era for ลูกทุ่ง  
    if (!era && sources.some(s => s.includes('สำรองลูกทุ่ง'))) {
      // Most ลูกทุ่ง songs with specific artists
      if (artist) {
        if (['ชาย เมืองสิงห์', 'สายัณห์ สัญญา', 'ยิ่งยง ยอดบัวงาม', 'สนธิ สมมาตร'].includes(artist)) era = '80s';
        else if (['ไมค์ ภิรมย์พร', 'จินตหรา พูนลาภ'].includes(artist)) era = '90s';
        else if (['ตั๊กแตน ชลดา', 'ต่าย อรทัย', 'มนต์แคน แก่นคูน', 'มนต์สิทธิ์ คำสร้อย'].includes(artist)) era = '2010s';
        else if (['ลำไย ไหทองคำ', 'ก้อง ห้วยไร่', 'ลิลลี่ ได้หมดถ้าสดชื่น', 'เต้ย อภิวัฒน์', 'ลำยอง หนองหินห่าว', 'ไอ้มุ้ย', 'กะท้อน'].includes(artist)) era = '2020s';
      }
    }
    
    // สำรองเก่า era assignment
    if (!era && sources.some(s => s.includes('สำรองเก่า'))) {
      if (artist) {
        if (['คาราบาว', 'คีรีบูน', 'เรนโบว์'].includes(artist)) era = '80s';
        else if (['พงษ์สิทธิ์ คำภีร์', 'มาลีฮวนน่า', 'อัสนี วสันต์', 'นูโว', 'แจ้ ดนุพล', 'ไมโคร'].includes(artist)) era = '90s';
      }
    }
    
    // Singer type default for ลูกทุ่ง by artist gender
    if (!singer && artist) {
      const maleArtists = ['ชาย เมืองสิงห์', 'สายัณห์ สัญญา', 'ไมค์ ภิรมย์พร', 'ยิ่งยง ยอดบัวงาม', 'สนธิ สมมาตร', 'มนต์แคน แก่นคูน', 'ก้อง ห้วยไร่', 'พงษ์สิทธิ์ คำภีร์', 'มนต์สิทธิ์ คำสร้อย', 'แจ้ ดนุพล', 'คาราบาว', 'คีรีบูน', 'เรนโบว์', 'อัสนี วสันต์', 'เบิร์ด ธงไชย', 'ไมโคร', 'เต้ย อภิวัฒน์', 'จรัล มโนเพ็ชร', 'ไอ้มุ้ย', 'ลำยอง หนองหินห่าว'];
      const femaleArtists = ['ตั๊กแตน ชลดา', 'ต่าย อรทัย', 'ลำไย ไหทองคำ', 'จินตหรา พูนลาภ', 'ลิลลี่ ได้หมดถ้าสดชื่น', 'หนูนา หนึ่งธิดา', 'เบนซ์ พริกไทย', 'ใหม่ เจริญปุระ', 'มาลีฮวนน่า', 'นูโว'];
      if (maleArtists.includes(artist)) singer = 'ชาย';
      else if (femaleArtists.includes(artist)) singer = 'หญิง';
    }
    
    // Build INSERT
    const cols = ['name', 'source'];
    const vals = [`'${esc(name)}'`, "'global'"];
    if (artist) { cols.push('artist'); vals.push(`'${esc(artist)}'`); }
    if (key) { cols.push('"key"'); vals.push(`'${esc(key)}'`); }
    if (bpm) { cols.push('bpm'); vals.push(bpm); }
    if (singer) { cols.push('singer'); vals.push(`'${esc(singer)}'`); }
    if (era) { cols.push('era'); vals.push(`'${esc(era)}'`); }
    
    existSet.add(name.toLowerCase().trim());
    inserts.push(`INSERT INTO band_songs (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
  }
  
  console.log(`Skipped: ${skipCount} noise/duplicates`);
  console.log(`Already in DB: ${dupCount}`);
  console.log(`Inserting: ${inserts.length} new songs`);
  
  // Execute in batches
  const batchSize = 25;
  for (let i = 0; i < inserts.length; i += batchSize) {
    const batch = inserts.slice(i, i + batchSize).join('\n');
    try {
      const result = await query(batch);
      const hasError = result && result.message;
      if (hasError) {
        console.error(`Batch ${Math.floor(i/batchSize)+1} error:`, result.message.substring(0, 200));
        // Try one by one
        for (const stmt of inserts.slice(i, i + batchSize)) {
          try {
            const r2 = await query(stmt);
            if (r2 && r2.message) console.error('  Failed:', stmt.substring(0, 80), r2.message.substring(0, 100));
          } catch(e2) {}
        }
      } else {
        console.log(`Batch ${Math.floor(i/batchSize)+1} (${Math.min(batchSize, inserts.length-i)} songs): OK`);
      }
    } catch(e) {
      console.error(`Batch ${Math.floor(i/batchSize)+1} error:`, typeof e === 'string' ? e.substring(0, 200) : e);
    }
  }
  
  // Final count
  const countResult = await query("SELECT COUNT(*) as cnt FROM band_songs WHERE source='global'");
  console.log(`\nFinal total global songs: ${countResult[0].cnt}`);
}

main().catch(console.error);
