set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0012 · Built-in interview question sets
-- ----------------------------------------------------------------------------
-- This is PRODUCT content, not family data: the questions ROOTS asks. It ships
-- in Mongolian first, with an English set alongside so the localisation path is
-- real rather than theoretical. A family can add its own set at any time.
-- ============================================================================

with mn_set as (
  insert into interview_question_sets (family_id, key, title, description, locale, audience, is_builtin)
  values (null, 'life_story', 'Амьдралын түүх',
          'Ах, эгч, аав, ээж, өвөө, эмээгээсээ асуух үндсэн асуултууд.', 'mn', 'elder', true)
  returning id
)
insert into interview_question_templates (set_id, order_index, question_key, question_text, hint, expects)
select mn_set.id, v.order_index, v.question_key, v.question_text, v.hint, v.expects::text
from mn_set, (values
  (1,  'birthplace',      'Та хаана төрсөн бэ?', 'Аймаг, сум, багийн нэрийг дурдаж болно.', 'place'),
  (2,  'birth_time',      'Хэдэн онд төрсөн бэ? Тэр үеийн тухай юу санаж байна вэ?', null, 'date'),
  (3,  'childhood',       'Таны бага нас ямар байсан бэ?', 'Хамгийн тод дурсамжаа ярина уу.', 'story'),
  (4,  'parents',         'Аав ээжийнхээ тухай юу санаж байна вэ?', 'Ямар хүмүүс байсан бэ?', 'story'),
  (5,  'parents_look',    'Аав ээж тань ямар царайлаг байсан бэ?', 'Өндөр намхан, царайны хэлбэр, үс, хөмсөг.', 'appearance'),
  (6,  'grandparents',    'Өвөө эмээгийнхээ тухай юу мэдэх вэ?', null, 'story'),
  (7,  'siblings',        'Ах дүү нар тань хэд байсан бэ?', null, 'person'),
  (8,  'home',            'Таны өссөн гэр ямар байсан бэ?', 'Гэр, байшин, хашаа, малын тухай.', 'story'),
  (9,  'school',          'Сургуулийн жилүүд ямар байсан бэ?', null, 'story'),
  (10, 'first_job',       'Анхны ажил тань юу байсан бэ?', null, 'event'),
  (11, 'meeting_partner', 'Хань тайгаа хэрхэн танилцсан бэ?', 'Хаана, хэдэн онд, хэн танилцуулсан.', 'story'),
  (12, 'wedding',         'Хуримын өдрөө яаж санаж байна вэ?', null, 'event'),
  (13, 'children',        'Хүүхдүүд тань төрөх үед ямар мэдрэмж төрсөн бэ?', null, 'story'),
  (14, 'hardest',         'Амьдралын хамгийн хэцүү үе аль нь байсан бэ?', null, 'story'),
  (15, 'most_important',  'Амьдралын тань хамгийн чухал үйл явдал юу вэ?', null, 'event'),
  (16, 'moves',           'Та ямар ямар газар амьдарч байсан бэ?', 'Он оноор нь дурдаж болно.', 'place'),
  (17, 'tradition',       'Манай гэр бүлд ямар уламжлал байдаг вэ?', null, 'story'),
  (18, 'recipe',          'Хамгийн их санагддаг гэрийн хоол юу вэ?', null, 'story'),
  (19, 'proud',           'Юугаараа хамгийн их бахархдаг вэ?', null, 'story'),
  (20, 'advice',          'Ач зээ нартаа ямар зөвлөгөө өгөх вэ?', 'Энэ хариулт үүрд хадгалагдана.', 'advice')
) as v(order_index, question_key, question_text, hint, expects);

with en_set as (
  insert into interview_question_sets (family_id, key, title, description, locale, audience, is_builtin)
  values (null, 'life_story', 'Life story',
          'The core questions to ask a parent, grandparent or elder relative.', 'en', 'elder', true)
  returning id
)
insert into interview_question_templates (set_id, order_index, question_key, question_text, hint, expects)
select en_set.id, v.order_index, v.question_key, v.question_text, v.hint, v.expects::text
from en_set, (values
  (1,  'birthplace',      'Where were you born?', null, 'place'),
  (2,  'birth_time',      'What year were you born, and what do you remember of that time?', null, 'date'),
  (3,  'childhood',       'What was your childhood like?', null, 'story'),
  (4,  'parents',         'What do you remember about your parents?', null, 'story'),
  (5,  'parents_look',    'What did your parents look like?', 'Height, face, hair, eyebrows.', 'appearance'),
  (6,  'grandparents',    'What do you know about your grandparents?', null, 'story'),
  (7,  'siblings',        'How many brothers and sisters did you have?', null, 'person'),
  (8,  'home',            'What was the home you grew up in like?', null, 'story'),
  (9,  'school',          'What were your school years like?', null, 'story'),
  (10, 'first_job',       'What was your first job?', null, 'event'),
  (11, 'meeting_partner', 'How did you meet your partner?', null, 'story'),
  (12, 'wedding',         'What do you remember about your wedding day?', null, 'event'),
  (13, 'children',        'What was it like when your children were born?', null, 'story'),
  (14, 'hardest',         'What was the hardest period of your life?', null, 'story'),
  (15, 'most_important',  'What was the most important event in your life?', null, 'event'),
  (16, 'moves',           'Which places have you lived in?', null, 'place'),
  (17, 'tradition',       'What traditions does our family keep?', null, 'story'),
  (18, 'recipe',          'Which home-cooked dish do you miss most?', null, 'story'),
  (19, 'proud',           'What are you most proud of?', null, 'story'),
  (20, 'advice',          'What advice would you give your grandchildren?', 'This answer is kept forever.', 'advice')
) as v(order_index, question_key, question_text, hint, expects);
