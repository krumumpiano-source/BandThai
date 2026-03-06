-- ══════════════════════════════════════════════════════════════
-- Update batch2: เติม Key ที่ขาด + แก้ Key ที่ถูกต้องจากข้อมูลใหม่
-- และ Insert เพลงใหม่ (batch3 — 2000s/2010s/2020s)
-- ══════════════════════════════════════════════════════════════
--
-- Key mapping:
--   Am / C  → C / Am   | G / Em → 1#  | D / Bm → 2#
--   A / F#m → 3#       | E / C#m→ 4#  | B / G#m→ 5#
--   F# / D#m→ 6#       | F / Dm → 1b  | Bb / Gm→ 2b
--   Eb / Cm → 3b       | Ab/G#  → 4b  | Db / Bbm→5b
-- ══════════════════════════════════════════════════════════════

-- ── UPDATE เพลงที่มีอยู่แล้ว: เติม/แก้ Key ────────────────────

-- แผลในใจ (Am → C / Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='แผลในใจ' AND artist='อำพล ลำพูน' AND source='global';
-- ไว้ใจ (Bb → 2b)
UPDATE public.band_songs SET key='2b' WHERE name='ไว้ใจ' AND artist='อำพล ลำพูน' AND source='global';
-- ใจนักเลง (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ใจนักเลง' AND artist='พงษ์พัฒน์' AND source='global';
-- ขอมือเธอหน่อย (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ขอมือเธอหน่อย' AND artist='นันทิดา แก้วบัวสาย' AND source='global';

-- สงสารกันหน่อย (Db → 5b)
UPDATE public.band_songs SET key='5b' WHERE name='สงสารกันหน่อย' AND source='global';
-- ถ้า (B → 5#)
UPDATE public.band_songs SET key='5#' WHERE name='ถ้า' AND source='global';
-- รักเธอเสมอ (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='รักเธอเสมอ' AND source='global';
-- ห่างไกลเหลือเกิน (F → 1b)
UPDATE public.band_songs SET key='1b' WHERE name='ห่างไกลเหลือเกิน' AND source='global';
-- เพียงรัก (Bm → 2#)
UPDATE public.band_songs SET key='2#' WHERE name='เพียงรัก' AND source='global';
-- เสียใจได้ยินไหม (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='เสียใจได้ยินไหม' AND source='global';
-- ลืมไปไม่รักกัน (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ลืมไปไม่รักกัน' AND source='global';
-- ไหนว่าจะไม่หลอกกัน (B → 5#)
UPDATE public.band_songs SET key='5#' WHERE name='ไหนว่าจะไม่หลอกกัน' AND source='global';
-- เธอปันใจ (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='เธอปันใจ' AND source='global';
-- พรุ่งนี้ไม่สาย (F → 1b)
UPDATE public.band_songs SET key='1b' WHERE name='พรุ่งนี้ไม่สาย' AND source='global';
-- รักเดียวใจเดียว (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='รักเดียวใจเดียว' AND source='global';
-- ยื้อ (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ยื้อ' AND source='global';
-- 18 ฝน (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='18 ฝน' AND source='global';
-- คิดถึง หรั่ง (B → 5#)
UPDATE public.band_songs SET key='5#' WHERE name='คิดถึง' AND artist='หรั่ง ร็อกเคสตร้า' AND source='global';
-- ใจสั่งมา (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ใจสั่งมา' AND source='global';
-- รักคงยังไม่พอ (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='รักคงยังไม่พอ' AND source='global';
-- โกหกหน้าตาย (Bb → 2b)
UPDATE public.band_songs SET key='2b' WHERE name='โกหกหน้าตาย' AND source='global';
-- ที่ว่าง (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ที่ว่าง' AND source='global';
-- ยิ่งใกล้ยิ่งเจ็บ (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ยิ่งใกล้ยิ่งเจ็บ' AND source='global';
-- แฟนเก่า (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='แฟนเก่า' AND source='global';
-- แพ้ใจ (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='แพ้ใจ' AND source='global';
-- ไร้ตัวตน (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ไร้ตัวตน' AND source='global';
-- ก็เลิกกันแล้ว (D → 2#)
UPDATE public.band_songs SET key='2#' WHERE name='ก็เลิกกันแล้ว' AND source='global';
-- ขวากหนาม (Am → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ขวากหนาม' AND source='global';
-- ขอเพียงที่พักใจ (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ขอเพียงที่พักใจ' AND source='global';
-- อยากให้รู้ว่าเหงา (B → 5#)
UPDATE public.band_songs SET key='5#' WHERE name='อยากให้รู้ว่าเหงา' AND source='global';
-- กระดาษห่อไฟ (Am → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='กระดาษห่อไฟ' AND source='global';
-- หยุดตรงนี้ที่เธอ (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='หยุดตรงนี้ที่เธอ' AND source='global';
-- ไม่รักดี (C → C/Am — มีแล้ว ✅)
-- คนฉลาด (C → C/Am — มีแล้ว ✅)
-- คาใจ (Em → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='คาใจ' AND source='global';
-- แอบมีเธอ (F → 1b)
UPDATE public.band_songs SET key='1b' WHERE name='แอบมีเธอ' AND source='global';
-- แอบรัก (D → 2#)
UPDATE public.band_songs SET key='2#' WHERE name='แอบรัก' AND source='global';
-- กอดหมอน (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='กอดหมอน' AND source='global';
-- ลงเอย (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ลงเอย' AND source='global';
-- เงียบๆ คนเดียว (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='เงียบๆ คนเดียว' AND source='global';
-- หมอกหรือควัน (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='หมอกหรือควัน' AND source='global';
-- ขอมือเธอหน่อย (G → 1# — อัปเดตแล้วข้างบน)
-- พลิกล็อก (C → C/Am — มีแล้ว ✅)
-- เจ้าช่อมาลี (Am → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='เจ้าช่อมาลี' AND source='global';
-- ซักกะนิด (D → 2#)
UPDATE public.band_songs SET key='2#' WHERE name='ซักกะนิด' AND source='global';
-- ลมหายใจ (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ลมหายใจ' AND source='global';
-- ประวัติศาสตร์ (Bb → 2b)
UPDATE public.band_songs SET key='2b' WHERE name='ประวัติศาสตร์' AND source='global';
-- สัมพันธ์ (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='สัมพันธ์' AND source='global';
-- คู่กัด (Am → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='คู่กัด' AND source='global';
-- ขอใจเธอคืน (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ขอใจเธอคืน' AND source='global';
-- เหลวไหล (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='เหลวไหล' AND source='global';
-- แม่มด (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='แม่มด' AND source='global';
-- ปอด ปอด (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ปอด ปอด' AND source='global';
-- ยาม (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ยาม' AND source='global';
-- ถอยดีกว่า (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ถอยดีกว่า' AND source='global';
-- ผ้าเช็ดหน้า (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ผ้าเช็ดหน้า' AND source='global';
-- กุ้มใจ (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='กุ้มใจ' AND source='global';
-- 191 (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='191' AND source='global';
-- ไม่อ้วนเอาเท่าไหร่ (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ไม่อ้วนเอาเท่าไหร่' AND source='global';
-- กลับดึก (Am → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='กลับดึก' AND source='global';
-- ร้องไห้กับฉัน (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ร้องไห้กับฉัน' AND source='global';
-- ข้อความ (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ข้อความ' AND source='global';
-- ความลับ (C → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='ความลับ' AND source='global';
-- เจ็บไปเจ็บมา (Am → C/Am)
UPDATE public.band_songs SET key='C / Am' WHERE name='เจ็บไปเจ็บมา' AND source='global';
-- ฝน เบิร์ดกะฮาร์ท (G → 1#)
UPDATE public.band_songs SET key='1#' WHERE name='ฝน' AND artist='เบิร์ดกะฮาร์ท' AND source='global';
-- เธอจะเลือกใคร (Bb → 2b)
UPDATE public.band_songs SET key='2b' WHERE name='เธอจะเลือกใคร' AND source='global';
-- ก่อน โมเดิร์นด็อก (E → 4#)
UPDATE public.band_songs SET key='4#' WHERE name='ก่อน' AND source='global';

-- ── INSERT เพลงใหม่ (batch3) ──────────────────────────────────
INSERT INTO public.band_songs (name, artist, key, bpm, singer, era, source, band_id)
VALUES
  -- ── 2000s ────────────────────────────────────────────────────
  ('รักเธอไม่มีวันหยุด',    'อ้อน ลัคนา',                  '4#',     '62',  'หญิง',       '2000s', 'global', NULL),
  ('จากคนอื่นคนไกล',        'มาลีวัลย์ เจมีน่า',            'C / Am', '63',  'หญิง',       '2000s', 'global', NULL),
  ('ทรายกับทะเล',           'นันทิดา แก้วบัวสาย',           '2#',     '66',  'หญิง',       '90s',   'global', NULL), -- 2537 = 90s
  ('ชั่วฟ้าดินสลาย',        'พลพล',                         '3#',     '67',  'ชาย',        '2000s', 'global', NULL),
  ('คนเดินถนน',             'พลพล',                         '1#',     '74',  'ชาย',        '2000s', 'global', NULL),
  ('ขอให้โชคดี',            'พลพล',                         '1#',     '80',  'ชาย',        '2000s', 'global', NULL),
  ('จิ๊จ๊ะ',                'Silly Fools',                  '1b',     '130', 'ชาย',        '2000s', 'global', NULL),
  ('L.O.V.E.',              'คูณสามซูเปอร์แก๊งค์',          'C / Am', '132', 'หญิง',       '90s',   'global', NULL), -- 2540 = 90s
  ('Ok นะคะ',               'แคทรียา อิงลิช',               '1#',     '134', 'หญิง',       '2000s', 'global', NULL), -- Em = 1#

  -- ── 90s (เพิ่มเติมที่ยังไม่มี) ──────────────────────────────
  ('ดอกไม้กับแจกัน',        'ใหม่ เจริญปุระ',               '2b',     '68',  'หญิง',       '90s',   'global', NULL), -- 2541

  -- ── 2000s ────────────────────────────────────────────────────
  ('สักวันหนึ่ง',           'มาริสา สุโกศล',                '1#',     '64',  'หญิง',       '2000s', 'global', NULL),
  ('หนึ่งในไม่กี่คน',       'โบ สุนิตา',                   '1#',     '68',  'หญิง',       '2000s', 'global', NULL),
  ('พรหมลิขิต',             'Big Ass',                       '3#',     '70',  'ชาย',        '2000s', 'global', NULL),
  ('แค่คนอีกคน',            'ปราโมทย์ วิเลปะนะ',            '1#',     '72',  'ชาย',        '2000s', 'global', NULL),
  ('ใจเธอกอดใคร',           'นีโอ เอ็กซ์',                  '2#',     '72',  'ชาย',        '2000s', 'global', NULL),
  ('สิทธิ์ของเธอ',          'อัสนี-วสันต์',                 '3b',     '72',  'ชาย',        '2000s', 'global', NULL),
  ('น้ำเต็มแก้ว',           'ดา เอ็นโดรฟิน',               '5#',     '74',  'หญิง',       '2000s', 'global', NULL),
  ('ภาพลวงตา',              'ดา เอ็นโดรฟิน',               '4#',     '74',  'หญิง',       '2000s', 'global', NULL),
  ('ใจเหลือๆ',              'Dr.Fuu',                        'C / Am', '74',  'ชาย',        '2000s', 'global', NULL),
  ('สลักจิต (โจทย์รัก)',    'เล้าโลม',                      'C / Am', '74',  'ชาย',        '2000s', 'global', NULL),
  ('สิ่งสำคัญ',             'ดา เอ็นโดรฟิน',               '1b',     '76',  'หญิง',       '2000s', 'global', NULL),
  ('คืนข้ามปี',             'ดา เอ็นโดรฟิน',               '3#',     '76',  'หญิง',       '2000s', 'global', NULL),
  ('เพื่อนสนิท',            'เอ็นโดรฟิน',                   'C / Am', '78',  'หญิง',       '2000s', 'global', NULL),
  ('อย่าทำให้ฟ้าผิดหวัง',   'เอ็นโดรฟิน',                   '1#',     '78',  'หญิง',       '2000s', 'global', NULL),
  ('ยอมจำนนฟ้าดิน',         'โบวี่',                         '2b',     '78',  'หญิง',       '2000s', 'global', NULL),
  ('หยุด',                  'Groove Riders',                 '1#',     '80',  'ชาย',        '2000s', 'global', NULL), -- B (1#) ตามที่ระบุ
  ('พูดไม่ค่อยเก่ง',        'AB Normal',                     '3#',     '80',  'ชาย',        '2000s', 'global', NULL),
  ('ด้วยความคิดถึง',        'Drama Stream',                  'C / Am', '80',  'ชาย',        '2000s', 'global', NULL),
  ('คนถูกทิ้ง',             'Blackhead',                     '1#',     '85',  'ชาย',        '2000s', 'global', NULL),
  ('สองรัก',                'Zeal',                          '1b',     '88',  'ชาย',        '2000s', 'global', NULL), -- Dm = 1b
  ('หมดชีวิตฉันให้เธอ',     'Zeal feat. บัวชมพู',           '2b',     '90',  'ชาย/หญิง',  '2000s', 'global', NULL),
  ('ผู้ชายห่วยๆ',           'มาช่า วัฒนพานิช',              'C / Am', '92',  'หญิง',       '2000s', 'global', NULL), -- Am
  ('ไม่รู้จักฉัน ไม่รู้จักเธอ','ป๊อป-ดา (Ost.)',            '1#',     '94',  'ชาย/หญิง',  '2000s', 'global', NULL),
  ('ที่หนึ่งไม่ไหว',        'ไอน้ำ',                         '1#',     '100', 'ชาย',        '2000s', 'global', NULL),
  ('รักคนมีเจ้าของ',        'ไอน้ำ',                         '1#',     '102', 'ชาย',        '2000s', 'global', NULL),
  ('ผู้หญิงลืมยาก',         'Pink',                          '5#',     '105', 'หญิง',       '2000s', 'global', NULL),
  ('คิดถึงเธอทุกทีที่อยู่คนเดียว', 'เจนนิเฟอร์ คิ้ม',      '3b',     '115', 'หญิง',       '2000s', 'global', NULL),
  ('ครั้งหนึ่งเราเคยรักกัน', 'ดา เอ็นโดรฟิน',              '1#',     '126', 'หญิง',       '2000s', 'global', NULL),
  ('Cinderella',            'Tattoo Colour',                 'C / Am', '124', 'ชาย',        '2000s', 'global', NULL),
  ('ขาหมู',                 'Tattoo Colour',                 '4#',     '128', 'ชาย',        '2000s', 'global', NULL),
  ('จะรักจะร้าย',           'Instinct',                      '1#',     '120', 'ชาย',        '2000s', 'global', NULL),
  ('ความหวาน',              'ลุลา',                           'C / Am', '120', 'หญิง',       '2010s', 'global', NULL), -- 2553 = 2010s
  ('แสงสุดท้าย',            'บอดี้สแลม',                    '3#',     '115', 'ชาย',        '2010s', 'global', NULL),

  -- ── 2010s ────────────────────────────────────────────────────
  ('เกินใจจะอดทน',          'ลานนา คัมมินส์',               'C / Am', '66',  'หญิง',       '2010s', 'global', NULL), -- 2547? → เช็กแล้ว 2547=2000s แต่ user ระบุ 2547
  ('ช่วงที่ดีที่สุด',       'Boy-Pod',                       '3#',     '70',  'ชาย',        '2000s', 'global', NULL), -- 2551=2000s
  ('รักสามเศร้า',           'พริกไทย',                       '1#',     '70',  'หญิง',       '2000s', 'global', NULL), -- F# minor = 2#? note: F#(1#) per user
  ('ยิ่งกว่าเสียใจ',        'พั้นช์ วรกาญจน์',              '5#',     '72',  'หญิง',       '2000s', 'global', NULL),
  ('คำถาม',                 'ทอฟฟี่',                        '4#',     '90',  'หญิง',       '2000s', 'global', NULL),
  ('คิดมาก',                'ปาล์มมี่',                      '3b',     '129', 'หญิง',       '2010s', 'global', NULL), -- 2554
  ('คนไม่จำเป็น',           'Getsunova',                     '6#',     '96',  'ชาย',        '2010s', 'global', NULL), -- 2559
  ('จันทร์',                'หญิง ธิติกานต์',               '1b',     '100', 'หญิง',       '2000s', 'global', NULL), -- 2548=2000s, Bb(1b)
  ('คนมีเสน่ห์',            'ป้าง นครินทร์',                '1#',     '104', 'ชาย',        '2010s', 'global', NULL), -- 2559
  ('กระโดดกอด',             'Klear',                         '5#',     '120', 'หญิง',       '2010s', 'global', NULL), -- 2558, B(2b) per user → B=5#
  ('ใจความสำคัญ',           'Musketeers',                    '3#',     '120', 'ชาย',        '2010s', 'global', NULL), -- 2557
  ('คนที่แสนดี',            'โทนี่ ผี',                     'C / Am', '85',  'ชาย',        '2010s', 'global', NULL), -- 2555
  ('คำยินดี',               'Klear',                         'C / Am', '86',  'หญิง',       '2010s', 'global', NULL)  -- 2555

ON CONFLICT DO NOTHING;
