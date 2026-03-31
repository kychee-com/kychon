-- ============================================
-- Wild Lychee — Barrio Unido Demo Seed (idempotent)
-- "Centro Comunitario Barrio Unido"
-- Latino immigrant services hub, East LA
-- Spanish-first with English content_translations
-- ============================================

-- ============================================
-- 1. SITE CONFIG
-- ============================================

-- Branding
INSERT INTO site_config (key, value, category) VALUES
  ('site_name', '"Centro Comunitario Barrio Unido"', 'branding'),
  ('site_tagline', '"Juntos, somos más fuertes"', 'branding'),
  ('site_description', '"Barrio Unido es un centro comunitario en el corazón de Boyle Heights, Los Ángeles. Ofrecemos clases de inglés, preparación para la ciudadanía, clínica legal gratuita, despensa de alimentos y eventos culturales. Desde 2018, hemos servido a más de 2,400 familias."', 'branding'),
  ('logo_url', '"/assets/logo.png"', 'branding'),
  ('favicon_url', '"/assets/logo.png"', 'branding')
ON CONFLICT (key) DO NOTHING;

-- Theme (terracotta + warm cream)
INSERT INTO site_config (key, value, category) VALUES
  ('theme', '{
    "primary": "#C2553A",
    "primary_hover": "#A8432D",
    "bg": "#FFF8F0",
    "surface": "#F0E6D8",
    "text": "#2D1810",
    "text_muted": "#7A6B5E",
    "border": "#D4C4B0",
    "font_heading": "Playfair Display",
    "font_body": "Source Sans 3",
    "radius": "0.75rem",
    "max_width": "72rem"
  }', 'theme')
ON CONFLICT (key) DO NOTHING;

-- Feature flags (AI features OFF)
INSERT INTO site_config (key, value, category) VALUES
  ('feature_events', 'true', 'features'),
  ('feature_forum', 'true', 'features'),
  ('feature_directory', 'true', 'features'),
  ('feature_resources', 'true', 'features'),
  ('feature_blog', 'false', 'features'),
  ('feature_committees', 'true', 'features'),
  ('feature_ai_moderation', 'false', 'features'),
  ('feature_ai_translation', 'false', 'features'),
  ('feature_ai_newsletter', 'false', 'features'),
  ('feature_ai_insights', 'false', 'features'),
  ('feature_ai_onboarding', 'false', 'features'),
  ('feature_ai_event_recaps', 'false', 'features'),
  ('feature_activity_feed', 'true', 'features'),
  ('feature_reactions', 'true', 'features'),
  ('directory_public', 'false', 'features'),
  ('signup_mode', '"approved"', 'features')
ON CONFLICT (key) DO NOTHING;

-- i18n config (Spanish default, English available)
INSERT INTO site_config (key, value, category) VALUES
  ('languages', '["es", "en"]', 'i18n'),
  ('default_language', '"es"', 'i18n')
ON CONFLICT (key) DO NOTHING;

-- Navigation (Spanish labels)
INSERT INTO site_config (key, value, category) VALUES
  ('nav', '[
    {"label": "Inicio", "href": "/", "icon": "home", "public": true},
    {"label": "Nosotros", "href": "/page.html?slug=nosotros", "icon": "info", "public": true},
    {"label": "Miembros", "href": "/directory.html", "icon": "users", "auth": true, "feature": "feature_directory"},
    {"label": "Eventos", "href": "/events.html", "icon": "calendar", "feature": "feature_events"},
    {"label": "Recursos", "href": "/resources.html", "icon": "book-open", "feature": "feature_resources"},
    {"label": "Foro", "href": "/forum.html", "icon": "message-circle", "feature": "feature_forum"},
    {"label": "Programas", "href": "/committees.html", "icon": "heart", "feature": "feature_committees"},
    {"label": "Panel", "href": "/admin.html", "icon": "bar-chart-2", "admin": true},
    {"label": "Miembros", "href": "/admin-members.html", "icon": "users", "admin": true},
    {"label": "Configuración", "href": "/admin-settings.html", "icon": "settings", "admin": true}
  ]', 'nav')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. MEMBERSHIP TIERS
-- ============================================

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Vecino/a', 'Cualquier persona del barrio es bienvenida', ARRAY['Ver avisos', 'Calendario de eventos', 'Foro comunitario'], 'Gratis', 1, true
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Vecino/a');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Voluntario/a', 'Miembros activos que donan su tiempo', ARRAY['Directorio de miembros', 'Recursos', 'Inscripción a eventos', 'Foro', 'Programas'], 'Gratis', 2, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Voluntario/a');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Promotor/a', 'Líderes comunitarios que coordinan programas', ARRAY['Todos los beneficios', 'Coordinar eventos', 'Moderar foro', 'Acceso a reportes'], 'Gratis', 3, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Promotor/a');

INSERT INTO membership_tiers (name, description, benefits, price_label, position, is_default)
SELECT 'Consejero/a', 'Miembros de la mesa directiva', ARRAY['Acceso completo', 'Herramientas de administración', 'Reuniones de mesa directiva', 'Planificación estratégica'], 'Por nombramiento', 4, false
WHERE NOT EXISTS (SELECT 1 FROM membership_tiers WHERE name = 'Consejero/a');

-- ============================================
-- 3. MEMBER CUSTOM FIELDS
-- ============================================

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'telefono', 'Teléfono', 'text', NULL, false, false, 1
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'telefono');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'colonia', 'Colonia / Barrio', 'text', NULL, false, true, 2
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'colonia');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'idiomas', 'Idiomas', 'multi_select', '["español", "inglés", "portugués", "mixteco", "zapoteco", "náhuatl"]', false, true, 3
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'idiomas');

INSERT INTO member_custom_fields (field_name, field_label, field_type, options, required, visible_in_directory, position)
SELECT 'habilidades', 'Habilidades', 'multi_select', '["enseñanza", "traducción", "legal", "cocina", "organización", "tecnología", "cuidado de niños", "construcción"]', false, true, 4
WHERE NOT EXISTS (SELECT 1 FROM member_custom_fields WHERE field_name = 'habilidades');

-- ============================================
-- 4. COMMITTEES (Programas)
-- ============================================

INSERT INTO committees (name, description)
SELECT 'Clínica Legal', 'Consultas legales gratuitas sobre inmigración, DACA, permisos de trabajo y derechos laborales. En asociación con abogados voluntarios de la comunidad.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Clínica Legal');

INSERT INTO committees (name, description)
SELECT 'Clases de Inglés (ESL)', 'Clases de inglés como segundo idioma para adultos, niveles principiante a avanzado. Clases de conversación los miércoles, gramática los sábados.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Clases de Inglés (ESL)');

INSERT INTO committees (name, description)
SELECT 'Preparación Ciudadanía', 'Talleres mensuales de preparación para el examen de ciudadanía. Incluye simulacros de entrevista, estudio cívico y asistencia con formularios.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Preparación Ciudadanía');

INSERT INTO committees (name, description)
SELECT 'Despensa Comunitaria', 'Distribución semanal de alimentos frescos y no perecederos para familias del barrio. Los jueves de 4 a 7 PM en el centro.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Despensa Comunitaria');

INSERT INTO committees (name, description)
SELECT 'Jóvenes Unidos', 'Programa de mentoría y actividades para jóvenes de 12 a 18 años. Tutoría escolar, arte, deportes y desarrollo de liderazgo.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Jóvenes Unidos');

INSERT INTO committees (name, description)
SELECT 'Cultura y Fiestas', 'Organización de eventos culturales: Día de los Muertos, Posada Navideña, Cinco de Mayo, mercaditos y noches de cine comunitario.'
WHERE NOT EXISTS (SELECT 1 FROM committees WHERE name = 'Cultura y Fiestas');

-- ============================================
-- 5. FORUM CATEGORIES
-- ============================================

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Preguntas y Respuestas', 'Haz preguntas sobre servicios, trámites, recursos del barrio y más.', 1, '#C2553A'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Preguntas y Respuestas');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Recursos Compartidos', 'Comparte información útil: guías, contactos, oportunidades, recomendaciones.', 2, '#1A8A7D'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Recursos Compartidos');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Empleos y Oportunidades', 'Ofertas de trabajo, oportunidades de voluntariado, becas y capacitaciones.', 3, '#E8A317'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Empleos y Oportunidades');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Historias de Éxito', 'Celebra los logros de nuestra comunidad: ciudadanías, graduaciones, nuevos negocios.', 4, '#6B8F3C'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Historias de Éxito');

INSERT INTO forum_categories (name, description, position, color)
SELECT 'Avisos del Barrio', 'Noticias, alertas y avisos importantes para el vecindario.', 5, '#7B5EA7'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Avisos del Barrio');

-- ============================================
-- 6. MEMBERS (22 people)
-- ============================================

-- Member 1: Admin — Directora del centro
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'lucia.ramirez@barriounido.org', 'Lucía Ramírez', '/assets/avatar-01.jpg',
  'Directora fundadora de Barrio Unido. Nací en Oaxaca y llegué a Boyle Heights a los 15 años. Después de 20 años sirviendo a esta comunidad, fundé el centro para que nadie tenga que navegar solo.',
  (SELECT id FROM membership_tiers WHERE name = 'Consejero/a'), 'admin', 'active',
  '{"telefono": "323-555-0101", "colonia": "Boyle Heights", "idiomas": ["español", "inglés", "mixteco"], "habilidades": ["organización", "enseñanza", "legal"]}',
  now() - interval '730 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'lucia.ramirez@barriounido.org');

-- Member 2: Moderator — Abogada voluntaria
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'ana.delgado@gmail.com', 'Ana Delgado', '/assets/avatar-02.jpg',
  'Abogada de inmigración. Dono 10 horas al mes en la clínica legal de Barrio Unido. Cada caso resuelto es una familia que puede dormir tranquila.',
  (SELECT id FROM membership_tiers WHERE name = 'Promotor/a'), 'moderator', 'active',
  '{"telefono": "323-555-0102", "colonia": "Lincoln Heights", "idiomas": ["español", "inglés"], "habilidades": ["legal", "traducción"]}',
  now() - interval '680 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'ana.delgado@gmail.com');

-- Member 3: Moderator — Maestro de ESL
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'carlos.medina@outlook.com', 'Carlos Medina', '/assets/avatar-03.jpg',
  'Maestro de inglés jubilado del LAUSD. Ahora doy clases de ESL en el centro tres veces por semana. Ver a mis alumnos ganar confianza me llena el alma.',
  (SELECT id FROM membership_tiers WHERE name = 'Promotor/a'), 'moderator', 'active',
  '{"telefono": "323-555-0103", "colonia": "Boyle Heights", "idiomas": ["español", "inglés"], "habilidades": ["enseñanza", "traducción"]}',
  now() - interval '650 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'carlos.medina@outlook.com');

-- Member 4
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'rosa.martinez@yahoo.com', 'Rosa Martínez', '/assets/avatar-04.jpg',
  'Mamá de tres y voluntaria de la despensa comunitaria. Sé lo que es no tener suficiente comida — por eso estoy aquí cada jueves.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0104", "colonia": "East LA", "idiomas": ["español"], "habilidades": ["cocina", "organización", "cuidado de niños"]}',
  now() - interval '600 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'rosa.martinez@yahoo.com');

-- Member 5
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'miguel.santos@gmail.com', 'Miguel Santos', '/assets/avatar-05.jpg',
  'Dueño de la panadería Santos en la calle César Chávez. Dono pan y conchas para todos los eventos del centro. El barrio me dio todo, yo le devuelvo lo que puedo.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0105", "colonia": "Boyle Heights", "idiomas": ["español", "inglés"], "habilidades": ["cocina", "organización"]}',
  now() - interval '550 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'miguel.santos@gmail.com');

-- Member 6
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'jennifer.tran@gmail.com', 'Jennifer Tran', '/assets/avatar-06.jpg',
  'Trabajadora social del condado de LA. Ayudo a conectar familias con servicios de salud, vivienda y asistencia pública. Orgullosa aliada de esta comunidad.',
  (SELECT id FROM membership_tiers WHERE name = 'Promotor/a'), 'member', 'active',
  '{"telefono": "323-555-0106", "colonia": "El Sereno", "idiomas": ["inglés", "español"], "habilidades": ["organización", "legal", "traducción"]}',
  now() - interval '500 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'jennifer.tran@gmail.com');

-- Member 7
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'pedro.gutierrez@hotmail.com', 'Pedro Gutiérrez', '/assets/avatar-07.jpg',
  'Carpintero y padre de familia. Llegué de Guatemala hace 8 años. Barrio Unido me ayudó con mi permiso de trabajo y mis clases de inglés. Ahora soy voluntario de construcción.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0107", "colonia": "City Terrace", "idiomas": ["español"], "habilidades": ["construcción", "organización"]}',
  now() - interval '480 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'pedro.gutierrez@hotmail.com');

-- Member 8
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'maria.elena.rios@gmail.com', 'María Elena Ríos', '/assets/avatar-08.jpg',
  'Enfermera en el Hospital General de LA. Coordino las ferias de salud del centro — exámenes gratuitos de presión, diabetes y visión para todo el barrio.',
  (SELECT id FROM membership_tiers WHERE name = 'Promotor/a'), 'member', 'active',
  '{"telefono": "323-555-0108", "colonia": "Boyle Heights", "idiomas": ["español", "inglés"], "habilidades": ["organización", "enseñanza"]}',
  now() - interval '450 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'maria.elena.rios@gmail.com');

-- Member 9
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'david.kim@gmail.com', 'David Kim', '/assets/avatar-09.jpg',
  'Estudiante de derecho en UCLA. Hago mis horas pro bono en la clínica legal de Barrio Unido. Cada caso me enseña más que cualquier libro.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0109", "colonia": "Westwood", "idiomas": ["inglés", "español"], "habilidades": ["legal", "traducción", "tecnología"]}',
  now() - interval '400 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'david.kim@gmail.com');

-- Member 10
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'guadalupe.flores@yahoo.com', 'Guadalupe Flores', '/assets/avatar-10.jpg',
  'Abuela orgullosa y cocinera principal del programa de despensa. Mi especialidad son los tamales para la Posada Navideña — ¡300 tamales el año pasado!',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0110", "colonia": "Boyle Heights", "idiomas": ["español"], "habilidades": ["cocina", "organización"]}',
  now() - interval '380 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'guadalupe.flores@yahoo.com');

-- Member 11
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'oscar.herrera@gmail.com', 'Óscar Herrera', '/assets/avatar-11.jpg',
  'Muralista y artista local. Pinté el mural de la fachada del centro. El arte es la voz del barrio.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0111", "colonia": "East LA", "idiomas": ["español", "inglés"], "habilidades": ["enseñanza", "organización"]}',
  now() - interval '350 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'oscar.herrera@gmail.com');

-- Member 12
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'sandra.lopez@outlook.com', 'Sandra López', '/assets/avatar-12.jpg',
  'Contadora y consejera de la mesa directiva. Manejo las finanzas del centro y organizo los talleres de impuestos cada temporada.',
  (SELECT id FROM membership_tiers WHERE name = 'Consejero/a'), 'member', 'active',
  '{"telefono": "323-555-0112", "colonia": "Montecito Heights", "idiomas": ["español", "inglés"], "habilidades": ["organización", "tecnología"]}',
  now() - interval '700 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'sandra.lopez@outlook.com');

-- Member 13
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'jose.hernandez@gmail.com', 'José Hernández', '/assets/avatar-13.jpg',
  'Taxista y padre soltero. Vine de El Salvador hace 12 años. Barrio Unido me ayudó con mi caso de asilo. Ahora llevo a vecinos a sus citas de inmigración gratis.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0113", "colonia": "Boyle Heights", "idiomas": ["español"], "habilidades": ["traducción", "organización"]}',
  now() - interval '320 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'jose.hernandez@gmail.com');

-- Member 14
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'adriana.morales@gmail.com', 'Adriana Morales', '/assets/avatar-14.jpg',
  'Estudiante de Cal State LA y tutora del programa Jóvenes Unidos. Crecí en Boyle Heights y quiero que los chavos del barrio sepan que la universidad sí es para ellos.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0114", "colonia": "Boyle Heights", "idiomas": ["español", "inglés"], "habilidades": ["enseñanza", "tecnología", "cuidado de niños"]}',
  now() - interval '280 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'adriana.morales@gmail.com');

-- Member 15
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'roberto.vasquez@yahoo.com', 'Roberto Vásquez', '/assets/avatar-15.jpg',
  'Plomero con 20 años de experiencia. Hago reparaciones gratis para las personas mayores del barrio cuando puedo. Es lo que uno hace por los vecinos.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0115", "colonia": "City Terrace", "idiomas": ["español"], "habilidades": ["construcción", "organización"]}',
  now() - interval '250 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'roberto.vasquez@yahoo.com');

-- Member 16
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'elena.castro@gmail.com', 'Elena Castro', '/assets/avatar-16.jpg',
  'Periodista de La Opinión. Escribo sobre la comunidad de Boyle Heights y me encanta cubrir los eventos de Barrio Unido. El barrio tiene mil historias que contar.',
  (SELECT id FROM membership_tiers WHERE name = 'Vecino/a'), 'member', 'active',
  '{"telefono": "323-555-0116", "colonia": "Lincoln Heights", "idiomas": ["español", "inglés"], "habilidades": ["traducción", "organización"]}',
  now() - interval '220 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'elena.castro@gmail.com');

-- Member 17
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'marco.fuentes@outlook.com', 'Marco Fuentes', '/assets/avatar-17.jpg',
  'Chef y dueño del food truck "Sabor Oaxaqueño". Siempre presente en los mercaditos del centro con mis tlayudas y mezcal.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0117", "colonia": "East LA", "idiomas": ["español", "inglés", "zapoteco"], "habilidades": ["cocina", "organización"]}',
  now() - interval '200 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'marco.fuentes@outlook.com');

-- Member 18
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'patricia.wong@gmail.com', 'Patricia Wong', '/assets/avatar-18.jpg',
  'Maestra de primaria en Breed Street Elementary. Recomiendo Barrio Unido a todas las familias de mis alumnos. Este centro cambia vidas.',
  (SELECT id FROM membership_tiers WHERE name = 'Vecino/a'), 'member', 'active',
  '{"telefono": "323-555-0118", "colonia": "Boyle Heights", "idiomas": ["inglés", "español"], "habilidades": ["enseñanza", "cuidado de niños"]}',
  now() - interval '170 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'patricia.wong@gmail.com');

-- Member 19
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'raul.mendoza@gmail.com', 'Raúl Mendoza', '/assets/avatar-19.jpg',
  'Técnico de computadoras. Enseño clases de tecnología básica para adultos mayores — cómo usar el teléfono, correo electrónico y videollamadas para hablar con la familia.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0119", "colonia": "El Sereno", "idiomas": ["español", "inglés"], "habilidades": ["tecnología", "enseñanza"]}',
  now() - interval '150 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'raul.mendoza@gmail.com');

-- Member 20
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'teresa.ruiz@yahoo.com', 'Teresa Ruiz', '/assets/avatar-20.jpg',
  'Costurera y líder del grupo de mujeres emprendedoras. Damos talleres de costura y vendemos nuestros productos en el mercadito mensual.',
  (SELECT id FROM membership_tiers WHERE name = 'Voluntario/a'), 'member', 'active',
  '{"telefono": "323-555-0120", "colonia": "Boyle Heights", "idiomas": ["español"], "habilidades": ["enseñanza", "organización"]}',
  now() - interval '130 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'teresa.ruiz@yahoo.com');

-- Member 21: Pending
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'diego.salazar@gmail.com', 'Diego Salazar', '/assets/avatar-21.jpg',
  'Recién llegado de Puebla. Busco clases de inglés y ayuda con mi permiso de trabajo. Un amigo me recomendó Barrio Unido.',
  (SELECT id FROM membership_tiers WHERE name = 'Vecino/a'), 'member', 'pending',
  '{"telefono": "323-555-0121", "colonia": "Boyle Heights", "idiomas": ["español"], "habilidades": []}',
  now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'diego.salazar@gmail.com');

-- Member 22: Pending
INSERT INTO members (email, display_name, avatar_url, bio, tier_id, role, status, custom_fields, joined_at)
SELECT 'carmen.aguilar@outlook.com', 'Carmen Aguilar', '/assets/avatar-22.jpg',
  'Madre de dos hijos. Necesito información sobre el proceso de ciudadanía y las clases de inglés. ¡Gracias por este recurso!',
  (SELECT id FROM membership_tiers WHERE name = 'Vecino/a'), 'member', 'pending',
  '{"telefono": "323-555-0122", "colonia": "East LA", "idiomas": ["español"], "habilidades": ["cocina", "cuidado de niños"]}',
  now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM members WHERE email = 'carmen.aguilar@outlook.com');

-- ============================================
-- 7. COMMITTEE MEMBERS (30+ assignments)
-- ============================================

-- Clínica Legal
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clínica Legal' AND m.email = 'ana.delgado@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clínica Legal' AND m.email = 'david.kim@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clínica Legal' AND m.email = 'lucia.ramirez@barriounido.org' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clínica Legal' AND m.email = 'jennifer.tran@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clínica Legal' AND m.email = 'jose.hernandez@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);

-- Clases de Inglés (ESL)
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clases de Inglés (ESL)' AND m.email = 'carlos.medina@outlook.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clases de Inglés (ESL)' AND m.email = 'patricia.wong@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clases de Inglés (ESL)' AND m.email = 'adriana.morales@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Clases de Inglés (ESL)' AND m.email = 'raul.mendoza@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);

-- Preparación Ciudadanía
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Preparación Ciudadanía' AND m.email = 'lucia.ramirez@barriounido.org' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Preparación Ciudadanía' AND m.email = 'ana.delgado@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Preparación Ciudadanía' AND m.email = 'carlos.medina@outlook.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Preparación Ciudadanía' AND m.email = 'david.kim@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Preparación Ciudadanía' AND m.email = 'jennifer.tran@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);

-- Despensa Comunitaria
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Despensa Comunitaria' AND m.email = 'rosa.martinez@yahoo.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Despensa Comunitaria' AND m.email = 'guadalupe.flores@yahoo.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Despensa Comunitaria' AND m.email = 'miguel.santos@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Despensa Comunitaria' AND m.email = 'pedro.gutierrez@hotmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Despensa Comunitaria' AND m.email = 'roberto.vasquez@yahoo.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);

-- Jóvenes Unidos
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Jóvenes Unidos' AND m.email = 'adriana.morales@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Jóvenes Unidos' AND m.email = 'oscar.herrera@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Jóvenes Unidos' AND m.email = 'elena.castro@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Jóvenes Unidos' AND m.email = 'patricia.wong@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);

-- Cultura y Fiestas
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Cultura y Fiestas' AND m.email = 'marco.fuentes@outlook.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Cultura y Fiestas' AND m.email = 'oscar.herrera@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Cultura y Fiestas' AND m.email = 'teresa.ruiz@yahoo.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Cultura y Fiestas' AND m.email = 'guadalupe.flores@yahoo.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);
INSERT INTO committee_members (committee_id, member_id) SELECT c.id, m.id FROM committees c, members m WHERE c.name = 'Cultura y Fiestas' AND m.email = 'miguel.santos@gmail.com' AND NOT EXISTS (SELECT 1 FROM committee_members WHERE committee_id = c.id AND member_id = m.id);

-- ============================================
-- 8. EVENTS (10 total: 5 upcoming, 5 past)
-- ============================================

-- Upcoming 1: Noche de Ciudadanía
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Noche de Ciudadanía',
  'Taller mensual de preparación para el examen de ciudadanía. Incluye simulacro de entrevista en inglés, repaso de preguntas cívicas y asistencia para llenar el formulario N-400. Traiga su tarjeta de residencia. Cuidado de niños disponible.',
  'Centro Barrio Unido, 2024 E 1st St, Los Angeles, CA 90033',
  now() + interval '5 days' + interval '18 hours',
  now() + interval '5 days' + interval '21 hours',
  40, '/assets/event-citizenship.jpg', false,
  (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Noche de Ciudadanía');

-- Upcoming 2: Feria de Salud
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Feria de Salud Comunitaria',
  'Exámenes gratuitos de presión arterial, diabetes, colesterol y visión. Vacunas de gripe disponibles. Información sobre Medi-Cal y seguros de salud. Doctores y enfermeras voluntarias. ¡No se necesita cita!',
  'Parque Hollenbeck, 415 S St Louis St, Los Angeles, CA 90033',
  now() + interval '12 days' + interval '9 hours',
  now() + interval '12 days' + interval '14 hours',
  200, '/assets/event-health-fair.jpg', false,
  (SELECT id FROM members WHERE email = 'maria.elena.rios@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Feria de Salud Comunitaria');

-- Upcoming 3: Mercadito Comunitario
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Mercadito del Barrio',
  'Mercado mensual con vendedores locales: comida artesanal, ropa hecha a mano, productos de belleza naturales, plantas y más. Música en vivo y actividades para niños. ¡Apoya a los emprendedores del barrio!',
  'Centro Barrio Unido, 2024 E 1st St, Los Angeles, CA 90033',
  now() + interval '8 days' + interval '10 hours',
  now() + interval '8 days' + interval '16 hours',
  150, '/assets/event-market.jpg', false,
  (SELECT id FROM members WHERE email = 'teresa.ruiz@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Mercadito del Barrio');

-- Upcoming 4: Clínica Legal
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Clínica Legal Gratuita',
  'Consultas individuales de 30 minutos con abogados de inmigración voluntarios. Temas: DACA, permisos de trabajo, reunificación familiar, asilo y naturalización. Llame para hacer cita o llegue sin cita a partir de las 5 PM.',
  'Centro Barrio Unido, 2024 E 1st St, Los Angeles, CA 90033',
  now() + interval '3 days' + interval '17 hours',
  now() + interval '3 days' + interval '20 hours',
  25, '/assets/event-legal-clinic.jpg', false,
  (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Clínica Legal Gratuita');

-- Upcoming 5: Taller de Impuestos
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Taller de Impuestos Gratis (VITA)',
  'Preparación gratuita de impuestos con voluntarios certificados del IRS (programa VITA). Para familias con ingresos menores a $64,000. Traiga su W-2, identificación y número de seguro social. Servicio en español e inglés.',
  'Centro Barrio Unido, 2024 E 1st St, Los Angeles, CA 90033',
  now() + interval '15 days' + interval '10 hours',
  now() + interval '15 days' + interval '16 hours',
  30, '/assets/event-workshop.jpg', false,
  (SELECT id FROM members WHERE email = 'sandra.lopez@outlook.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Taller de Impuestos Gratis (VITA)');

-- Past 1: Posada Navideña
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Posada Navideña 2025',
  '¡Nuestra posada fue un éxito! Más de 200 familias celebraron con tamales, champurrado, piñatas, villancicos y la tradicional procesión. Los niños recibieron regalos donados por comercios locales. ¡Gracias a todos los voluntarios!',
  'Centro Barrio Unido, 2024 E 1st St, Los Angeles, CA 90033',
  now() - interval '90 days' + interval '17 hours',
  now() - interval '90 days' + interval '22 hours',
  250, '/assets/event-posada.jpg', false,
  (SELECT id FROM members WHERE email = 'guadalupe.flores@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Posada Navideña 2025');

-- Past 2: Día de los Muertos
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Celebración Día de los Muertos',
  'Una noche mágica en el parque Hollenbeck con altares comunitarios, pintura de calaveras, papel picado, pan de muerto y música de mariachi. Más de 300 personas vinieron a honrar a sus seres queridos. El altar colectivo fue hermoso.',
  'Parque Hollenbeck, 415 S St Louis St, Los Angeles, CA 90033',
  now() - interval '150 days' + interval '16 hours',
  now() - interval '150 days' + interval '22 hours',
  300, '/assets/event-dia-muertos.jpg', false,
  (SELECT id FROM members WHERE email = 'oscar.herrera@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Celebración Día de los Muertos');

-- Past 3: Mural Painting Day
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Día de Pintura del Mural Comunitario',
  'Treinta voluntarios ayudaron a Óscar Herrera a pintar el nuevo mural de la fachada del centro. El mural representa la historia de la inmigración y la fuerza de nuestra comunidad. ¡Quedó increíble!',
  'Centro Barrio Unido, 2024 E 1st St, Los Angeles, CA 90033',
  now() - interval '60 days' + interval '8 hours',
  now() - interval '60 days' + interval '16 hours',
  40, '/assets/event-mural.jpg', false,
  (SELECT id FROM members WHERE email = 'oscar.herrera@gmail.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Día de Pintura del Mural Comunitario');

-- Past 4: ESL Graduation
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Graduación de Clases de Inglés',
  '¡Felicidades a nuestros 18 graduados del programa de ESL! Después de 6 meses de clases, completaron el nivel intermedio. La ceremonia incluyó discursos de los alumnos — ¡en inglés! Estamos muy orgullosos.',
  'Centro Barrio Unido, 2024 E 1st St, Los Angeles, CA 90033',
  now() - interval '30 days' + interval '18 hours',
  now() - interval '30 days' + interval '20 hours',
  60, '/assets/event-graduation.jpg', false,
  (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Graduación de Clases de Inglés');

-- Past 5: Food Pantry Record Day
INSERT INTO events (title, description, location, starts_at, ends_at, capacity, image_url, is_members_only, created_by)
SELECT 'Despensa Comunitaria — Día Récord',
  'Rompimos récord: 180 familias recibieron alimentos esta semana gracias a la donación del banco de alimentos del condado de LA y 15 voluntarios que trabajaron desde las 6 AM. ¡Gracias a todos!',
  'Centro Barrio Unido, 2024 E 1st St, Los Angeles, CA 90033',
  now() - interval '14 days' + interval '16 hours',
  now() - interval '14 days' + interval '19 hours',
  50, '/assets/event-food-pantry.jpg', false,
  (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com')
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Despensa Comunitaria — Día Récord');

-- ============================================
-- 9. EVENT RSVPs (for past events)
-- ============================================

INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Posada Navideña 2025' AND m.email = 'lucia.ramirez@barriounido.org' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Posada Navideña 2025' AND m.email = 'rosa.martinez@yahoo.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Posada Navideña 2025' AND m.email = 'guadalupe.flores@yahoo.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Posada Navideña 2025' AND m.email = 'marco.fuentes@outlook.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Posada Navideña 2025' AND m.email = 'oscar.herrera@gmail.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Posada Navideña 2025' AND m.email = 'teresa.ruiz@yahoo.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Posada Navideña 2025' AND m.email = 'miguel.santos@gmail.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Celebración Día de los Muertos' AND m.email = 'oscar.herrera@gmail.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Celebración Día de los Muertos' AND m.email = 'lucia.ramirez@barriounido.org' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Celebración Día de los Muertos' AND m.email = 'marco.fuentes@outlook.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Celebración Día de los Muertos' AND m.email = 'guadalupe.flores@yahoo.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Celebración Día de los Muertos' AND m.email = 'elena.castro@gmail.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Graduación de Clases de Inglés' AND m.email = 'carlos.medina@outlook.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Graduación de Clases de Inglés' AND m.email = 'lucia.ramirez@barriounido.org' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Graduación de Clases de Inglés' AND m.email = 'adriana.morales@gmail.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);
INSERT INTO event_rsvps (event_id, member_id, status) SELECT e.id, m.id, 'going' FROM events e, members m WHERE e.title = 'Graduación de Clases de Inglés' AND m.email = 'patricia.wong@gmail.com' AND NOT EXISTS (SELECT 1 FROM event_rsvps WHERE event_id = e.id AND member_id = m.id);

-- ============================================
-- 10. ANNOUNCEMENTS (8 total, 2 pinned)
-- ============================================

-- Announcement 1 (pinned)
INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Bienvenidos al nuevo portal de Barrio Unido',
  '<p>¡Estamos emocionados de lanzar nuestro nuevo portal comunitario! Aquí podrán ver eventos, inscribirse como voluntarios, acceder a recursos y conectar con otros miembros de la comunidad.</p><p>Si tienen preguntas, no duden en escribir en el foro o hablar con cualquier promotor/a. <strong>¡Este espacio es de todos ustedes!</strong></p>',
  (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'), true,
  now() - interval '60 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Bienvenidos al nuevo portal de Barrio Unido');

-- Announcement 2 (pinned)
INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Horario actualizado de la despensa comunitaria',
  '<p>A partir de este mes, la despensa comunitaria abrirá <strong>dos veces por semana</strong>: los martes y jueves de 4 a 7 PM.</p><p>Gracias a una nueva alianza con el Banco de Alimentos del Condado de LA, tenemos más productos frescos: frutas, verduras, leche y huevos. ¡Vengan y compartan la información con sus vecinos!</p>',
  (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com'), true,
  now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Horario actualizado de la despensa comunitaria');

-- Announcement 3
INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Nuevas clases de inglés — nivel principiante',
  '<p>Comenzamos un nuevo ciclo de clases de inglés para principiantes absolutos. Perfecto para quienes nunca han estudiado inglés o quieren empezar desde cero.</p><p>Horario: lunes y miércoles, 6 a 8 PM. ¡Inscríbanse en el centro o por el portal!</p>',
  (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'), false,
  now() - interval '45 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Nuevas clases de inglés — nivel principiante');

-- Announcement 4
INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT '¡18 graduados del programa de ESL!',
  '<p>Estamos orgullosísimos de nuestros 18 alumnos que completaron el programa de inglés nivel intermedio. Después de 6 meses de estudio, dieron sus discursos de graduación <strong>¡en inglés!</strong></p><p>Fotos disponibles en la sección de recursos. ¡Felicidades a todos! 🎓</p>',
  (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'), false,
  now() - interval '28 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = '¡18 graduados del programa de ESL!');

-- Announcement 5
INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Récord en la despensa: 180 familias servidas',
  '<p>¡Esta semana rompimos nuestro récord! Gracias a 15 voluntarios que llegaron desde las 6 AM y a la generosa donación del banco de alimentos, pudimos servir a 180 familias.</p><p>Cada caja incluyó arroz, frijoles, aceite, frutas, verduras y leche. Gracias a todos los que hacen esto posible.</p>',
  (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com'), false,
  now() - interval '14 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Récord en la despensa: 180 familias servidas');

-- Announcement 6
INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'El mural de Barrio Unido está terminado',
  '<p>Después de tres fines de semana de trabajo, el mural de la fachada del centro está completo. Gracias a Óscar Herrera y los 30 voluntarios que pintaron con él.</p><p>El mural representa nuestras raíces, nuestro viaje y nuestra fuerza como comunidad. ¡Vengan a verlo y tómense una foto!</p>',
  (SELECT id FROM members WHERE email = 'oscar.herrera@gmail.com'), false,
  now() - interval '55 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'El mural de Barrio Unido está terminado');

-- Announcement 7
INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Próxima clínica legal: actualización sobre DACA',
  '<p>La abogada Ana Delgado dará una presentación especial sobre las últimas actualizaciones del programa DACA y opciones para los dreamers. Habrá consultas individuales después.</p><p>Fecha: este viernes a las 5 PM en el centro. No se necesita cita para la presentación. Para consulta individual, llame al 323-555-0102.</p>',
  (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'), false,
  now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Próxima clínica legal: actualización sobre DACA');

-- Announcement 8
INSERT INTO announcements (title, body, author_id, is_pinned, created_at)
SELECT 'Buscamos voluntarios para el mercadito',
  '<p>El próximo mercadito del barrio necesita voluntarios para: montaje de mesas (8 AM), registro de vendedores, actividades infantiles y limpieza. Si puedes donar 2-3 horas de tu tiempo, ¡inscríbete en el portal o habla con Teresa!</p>',
  (SELECT id FROM members WHERE email = 'teresa.ruiz@yahoo.com'), false,
  now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Buscamos voluntarios para el mercadito');

-- ============================================
-- 11. RESOURCES (12 items)
-- ============================================

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Tarjeta "Conozca Sus Derechos"', 'Tarjeta de bolsillo bilingüe con sus derechos constitucionales durante encuentros con ICE o la policía. Imprimible.', 'Guías Legales', '/resources/know-your-rights.pdf', false, (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'), now() - interval '200 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Tarjeta "Conozca Sus Derechos"');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Lista de verificación para renovación de DACA', 'Documentos necesarios, fechas límite y pasos para renovar su DACA. Actualizado para 2026.', 'Guías Legales', '/resources/daca-renewal-checklist.pdf', false, (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'), now() - interval '180 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Lista de verificación para renovación de DACA');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Guía de estudio para el examen de ciudadanía', '100 preguntas cívicas con respuestas en español e inglés. Incluye tarjetas de estudio recortables.', 'Ciudadanía', '/resources/citizenship-study-guide.pdf', false, (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'), now() - interval '300 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Guía de estudio para el examen de ciudadanía');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Cuaderno de ESL — Nivel 1', 'Material de estudio para el curso de inglés nivel principiante. Vocabulario básico, saludos, números, familia.', 'Clases de Inglés', '/resources/esl-workbook-level1.pdf', true, (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'), now() - interval '250 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Cuaderno de ESL — Nivel 1');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Cuaderno de ESL — Nivel 2', 'Material intermedio: tiempos verbales, conversación cotidiana, vocabulario de trabajo y servicios.', 'Clases de Inglés', '/resources/esl-workbook-level2.pdf', true, (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'), now() - interval '200 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Cuaderno de ESL — Nivel 2');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Derechos del inquilino en California', 'Guía completa sobre protecciones para inquilinos: renta justa, desalojos, reparaciones, depósitos y discriminación.', 'Guías Legales', '/resources/tenant-rights-ca.pdf', false, (SELECT id FROM members WHERE email = 'jennifer.tran@gmail.com'), now() - interval '160 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Derechos del inquilino en California');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Horario de la despensa comunitaria', 'Calendario actualizado de días y horarios de distribución de alimentos. Incluye lista de productos disponibles.', 'Servicios', '/resources/food-pantry-schedule.pdf', false, (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com'), now() - interval '100 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Horario de la despensa comunitaria');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Guía de inscripción a Medi-Cal', 'Paso a paso para inscribirse en Medi-Cal, el seguro médico gratuito de California. Incluye documentos necesarios y sitios de ayuda.', 'Servicios', '/resources/medi-cal-guide.pdf', false, (SELECT id FROM members WHERE email = 'maria.elena.rios@gmail.com'), now() - interval '140 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Guía de inscripción a Medi-Cal');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Solicitud de beca juvenil Barrio Unido', 'Formulario para aplicar a la beca anual de $1,000 para jóvenes del programa Jóvenes Unidos que van a la universidad.', 'Jóvenes', '/resources/youth-scholarship.pdf', true, (SELECT id FROM members WHERE email = 'adriana.morales@gmail.com'), now() - interval '80 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Solicitud de beca juvenil Barrio Unido');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Formulario de voluntario', 'Registro para nuevos voluntarios: información personal, disponibilidad, habilidades e intereses.', 'Formularios', '/resources/volunteer-form.pdf', false, (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'), now() - interval '350 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Formulario de voluntario');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Directorio de servicios de inmigración en LA', 'Lista de organizaciones, abogados y servicios gratuitos de inmigración en el condado de Los Ángeles.', 'Guías Legales', '/resources/immigration-services-directory.pdf', false, (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'), now() - interval '120 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Directorio de servicios de inmigración en LA');

INSERT INTO resources (title, description, category, file_url, is_members_only, uploaded_by, created_at)
SELECT 'Guía básica de tecnología para adultos', 'Cómo usar un smartphone, correo electrónico, WhatsApp y videollamadas. Con capturas de pantalla paso a paso.', 'Clases de Inglés', '/resources/tech-basics-guide.pdf', true, (SELECT id FROM members WHERE email = 'raul.mendoza@gmail.com'), now() - interval '90 days'
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE title = 'Guía básica de tecnología para adultos');

-- ============================================
-- 12. HOMEPAGE SECTIONS
-- ============================================

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'hero', '{
  "heading": "Bienvenidos a Barrio Unido",
  "subheading": "Tu centro comunitario en el corazón de Boyle Heights. Clases de inglés, clínica legal, despensa de alimentos, eventos culturales y más — todo gratis, todo para ti.",
  "cta_text": "Únete a la comunidad",
  "cta_href": "/page.html?slug=nosotros",
  "bg_image": "/assets/hero.jpg"
}', 1, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'hero');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'stats', '{
  "items": [
    {"value": "2,400+", "label": "Familias servidas"},
    {"value": "850+", "label": "Clases de inglés completadas"},
    {"value": "340+", "label": "Consultas legales"},
    {"value": "60+", "label": "Eventos al año"}
  ]
}', 2, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'stats');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'features', '{
  "columns": 3,
  "items": [
    {"icon": "shield", "title": "Clínica Legal", "desc": "Consultas gratuitas con abogados de inmigración. DACA, permisos de trabajo, asilo, ciudadanía."},
    {"icon": "book-open", "title": "Clases de Inglés", "desc": "ESL para adultos, desde principiante hasta avanzado. Clases de conversación y gramática."},
    {"icon": "file-text", "title": "Ciudadanía", "desc": "Talleres mensuales de preparación para el examen. Simulacros de entrevista y ayuda con formularios."},
    {"icon": "heart", "title": "Despensa de Alimentos", "desc": "Distribución semanal de alimentos frescos para familias del barrio. Martes y jueves, 4-7 PM."},
    {"icon": "users", "title": "Jóvenes Unidos", "desc": "Mentoría, tutoría escolar, arte y deportes para jóvenes de 12 a 18 años."},
    {"icon": "calendar", "title": "Cultura y Fiestas", "desc": "Día de los Muertos, Posada Navideña, mercaditos, noches de cine y más."}
  ]
}', 3, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'features');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'testimonials', '{
  "items": [
    {"quote": "Barrio Unido me ayudó a conseguir mi ciudadanía después de 18 años en este país. No tengo palabras para agradecer a Lucía y a Ana.", "name": "María Elena Ríos", "role": "Promotora"},
    {"quote": "My kids found a second family in the youth program. Adriana and Óscar have been incredible mentors. This place changes lives.", "name": "Jennifer Tran", "role": "Social Worker & Volunteer"},
    {"quote": "Llegué sin hablar una palabra de inglés. Ahora puedo hablar con el doctor, con la maestra de mis hijos, con mi jefe. Gracias, profesor Carlos.", "name": "Pedro Gutiérrez", "role": "Voluntario de construcción"}
  ]
}', 4, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'testimonials');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'activity_feed', '{"limit": 15}', 5, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'activity_feed');

INSERT INTO sections (page_slug, section_type, config, position, visible)
SELECT 'index', 'cta', '{
  "heading": "El barrio te necesita — y tú nos necesitas a nosotros",
  "text": "Ya seas vecino/a nuevo o de toda la vida, hay un lugar para ti en Barrio Unido. Ven a conocernos.",
  "cta_text": "Hazte voluntario/a",
  "cta_href": "/page.html?slug=nosotros"
}', 6, true
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE page_slug = 'index' AND section_type = 'cta');

-- ============================================
-- 13. CUSTOM PAGES
-- ============================================

INSERT INTO pages (slug, title, content, published)
SELECT 'nosotros', 'Sobre Barrio Unido',
  '<h2>Nuestra Historia</h2><p>Barrio Unido nació en 2018 cuando un grupo de vecinos de Boyle Heights decidió que nuestra comunidad merecía un espacio propio — un lugar donde cualquier persona pudiera encontrar ayuda, aprender, conectar y celebrar.</p><p>Lo que empezó como una mesa con café y formularios de inmigración en el garaje de Lucía Ramírez, hoy es un centro comunitario que sirve a más de 2,400 familias al año.</p><h2>Nuestra Misión</h2><p>Empoderar a las familias inmigrantes y latinx de East Los Angeles proporcionando servicios legales, educación, alimentos y espacios culturales — todo gratuito, todo con dignidad.</p><h2>Cómo Participar</h2><p>No importa si hablas español, inglés o ambos. No importa tu estatus migratorio. No importa cuánto tiempo lleves en el barrio. <strong>Aquí hay un lugar para ti.</strong></p><ul><li>Ven a un evento y conoce a la comunidad</li><li>Inscríbete como voluntario/a</li><li>Dona a nuestra despensa de alimentos</li><li>Comparte nuestros recursos con alguien que los necesite</li></ul>',
  true
WHERE NOT EXISTS (SELECT 1 FROM pages WHERE slug = 'nosotros');

-- ============================================
-- 14. CONTENT TRANSLATIONS (English for all admin content)
-- ============================================

-- Announcement translations
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'title', 'Welcome to the new Barrio Unido portal'
FROM announcements WHERE title = 'Bienvenidos al nuevo portal de Barrio Unido'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'body', '<p>We''re excited to launch our new community portal! Here you can view events, sign up to volunteer, access resources, and connect with other community members.</p><p>If you have questions, don''t hesitate to post in the forum or talk to any promotor/a. <strong>This space belongs to all of you!</strong></p>'
FROM announcements WHERE title = 'Bienvenidos al nuevo portal de Barrio Unido'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'title', 'Updated food pantry schedule'
FROM announcements WHERE title = 'Horario actualizado de la despensa comunitaria'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'body', '<p>Starting this month, the community food pantry will be open <strong>twice a week</strong>: Tuesdays and Thursdays from 4 to 7 PM.</p><p>Thanks to a new partnership with the LA County Food Bank, we have more fresh produce: fruits, vegetables, milk, and eggs. Come by and share the word with your neighbors!</p>'
FROM announcements WHERE title = 'Horario actualizado de la despensa comunitaria'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'title', 'New ESL classes — beginner level'
FROM announcements WHERE title = 'Nuevas clases de inglés — nivel principiante'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'body', '<p>We''re starting a new cycle of English classes for absolute beginners. Perfect for anyone who has never studied English or wants to start from scratch.</p><p>Schedule: Mondays and Wednesdays, 6 to 8 PM. Sign up at the center or through the portal!</p>'
FROM announcements WHERE title = 'Nuevas clases de inglés — nivel principiante'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'title', '18 ESL program graduates!'
FROM announcements WHERE title = '¡18 graduados del programa de ESL!'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'body', '<p>We are incredibly proud of our 18 students who completed the intermediate English program. After 6 months of study, they gave their graduation speeches <strong>in English!</strong></p><p>Photos available in the resources section. Congratulations to all!</p>'
FROM announcements WHERE title = '¡18 graduados del programa de ESL!'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'title', 'Food pantry record: 180 families served'
FROM announcements WHERE title = 'Récord en la despensa: 180 familias servidas'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'body', '<p>This week we broke our record! Thanks to 15 volunteers who showed up at 6 AM and a generous donation from the food bank, we were able to serve 180 families.</p><p>Each box included rice, beans, oil, fruits, vegetables, and milk. Thank you to everyone who makes this possible.</p>'
FROM announcements WHERE title = 'Récord en la despensa: 180 familias servidas'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'title', 'The Barrio Unido mural is finished'
FROM announcements WHERE title = 'El mural de Barrio Unido está terminado'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'body', '<p>After three weekends of work, the mural on the center''s facade is complete. Thanks to Óscar Herrera and the 30 volunteers who painted with him.</p><p>The mural represents our roots, our journey, and our strength as a community. Come see it and take a photo!</p>'
FROM announcements WHERE title = 'El mural de Barrio Unido está terminado'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'title', 'Next legal clinic: DACA update'
FROM announcements WHERE title = 'Próxima clínica legal: actualización sobre DACA'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'body', '<p>Attorney Ana Delgado will give a special presentation on the latest DACA program updates and options for dreamers. Individual consultations will follow.</p><p>Date: this Friday at 5 PM at the center. No appointment needed for the presentation. For individual consultation, call 323-555-0102.</p>'
FROM announcements WHERE title = 'Próxima clínica legal: actualización sobre DACA'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'title', 'Volunteers needed for the mercadito'
FROM announcements WHERE title = 'Buscamos voluntarios para el mercadito'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'announcement', id, 'en', 'body', '<p>The upcoming barrio market needs volunteers for: table setup (8 AM), vendor registration, kids'' activities, and cleanup. If you can donate 2-3 hours of your time, sign up on the portal or talk to Teresa!</p>'
FROM announcements WHERE title = 'Buscamos voluntarios para el mercadito'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

-- Event translations
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Citizenship Night' FROM events WHERE title = 'Noche de Ciudadanía'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'Monthly citizenship exam prep workshop. Includes mock interview in English, civics review, and N-400 form assistance. Bring your green card. Childcare available.' FROM events WHERE title = 'Noche de Ciudadanía'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Community Health Fair' FROM events WHERE title = 'Feria de Salud Comunitaria'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'Free blood pressure, diabetes, cholesterol, and vision screenings. Flu shots available. Medi-Cal and health insurance information. Volunteer doctors and nurses. No appointment needed!' FROM events WHERE title = 'Feria de Salud Comunitaria'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Barrio Market' FROM events WHERE title = 'Mercadito del Barrio'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'Monthly market with local vendors: artisan food, handmade clothing, natural beauty products, plants, and more. Live music and kids'' activities. Support local entrepreneurs!' FROM events WHERE title = 'Mercadito del Barrio'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Free Legal Clinic' FROM events WHERE title = 'Clínica Legal Gratuita'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', '30-minute individual consultations with volunteer immigration attorneys. Topics: DACA, work permits, family reunification, asylum, and naturalization. Call for appointment or walk in after 5 PM.' FROM events WHERE title = 'Clínica Legal Gratuita'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Free Tax Prep Workshop (VITA)' FROM events WHERE title = 'Taller de Impuestos Gratis (VITA)'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'Free tax preparation by IRS-certified volunteers (VITA program). For families earning under $64,000. Bring your W-2, ID, and social security number. Service in Spanish and English.' FROM events WHERE title = 'Taller de Impuestos Gratis (VITA)'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Christmas Posada 2025' FROM events WHERE title = 'Posada Navideña 2025'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'Our posada was a huge success! Over 200 families celebrated with tamales, champurrado, piñatas, carols, and the traditional procession. Kids received gifts donated by local businesses. Thank you to all the volunteers!' FROM events WHERE title = 'Posada Navideña 2025'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Day of the Dead Celebration' FROM events WHERE title = 'Celebración Día de los Muertos'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'A magical evening at Hollenbeck Park with community altars, skull face painting, papel picado, pan de muerto, and mariachi music. Over 300 people came to honor their loved ones. The collective altar was beautiful.' FROM events WHERE title = 'Celebración Día de los Muertos'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Community Mural Painting Day' FROM events WHERE title = 'Día de Pintura del Mural Comunitario'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'Thirty volunteers helped Óscar Herrera paint the new mural on the center''s facade. The mural represents the history of immigration and the strength of our community. It looks incredible!' FROM events WHERE title = 'Día de Pintura del Mural Comunitario'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'ESL Class Graduation' FROM events WHERE title = 'Graduación de Clases de Inglés'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'Congratulations to our 18 graduates from the ESL program! After 6 months of classes, they completed the intermediate level. The ceremony included speeches from students — in English! We are so proud.' FROM events WHERE title = 'Graduación de Clases de Inglés'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'title', 'Food Pantry — Record Day' FROM events WHERE title = 'Despensa Comunitaria — Día Récord'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'event', id, 'en', 'description', 'We broke a record: 180 families received food this week thanks to the LA County food bank donation and 15 volunteers who worked from 6 AM. Thank you all!' FROM events WHERE title = 'Despensa Comunitaria — Día Récord'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

-- Resource translations
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'Know Your Rights Card' FROM resources WHERE title = 'Tarjeta "Conozca Sus Derechos"'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'description', 'Bilingual pocket card with your constitutional rights during encounters with ICE or police. Printable.' FROM resources WHERE title = 'Tarjeta "Conozca Sus Derechos"'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'DACA Renewal Checklist' FROM resources WHERE title = 'Lista de verificación para renovación de DACA'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'Citizenship Exam Study Guide' FROM resources WHERE title = 'Guía de estudio para el examen de ciudadanía'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'ESL Workbook — Level 1' FROM resources WHERE title = 'Cuaderno de ESL — Nivel 1'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'ESL Workbook — Level 2' FROM resources WHERE title = 'Cuaderno de ESL — Nivel 2'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'Tenant Rights in California' FROM resources WHERE title = 'Derechos del inquilino en California'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'Food Pantry Schedule' FROM resources WHERE title = 'Horario de la despensa comunitaria'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'Medi-Cal Enrollment Guide' FROM resources WHERE title = 'Guía de inscripción a Medi-Cal'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'Barrio Unido Youth Scholarship Application' FROM resources WHERE title = 'Solicitud de beca juvenil Barrio Unido'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'Volunteer Registration Form' FROM resources WHERE title = 'Formulario de voluntario'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'LA Immigration Services Directory' FROM resources WHERE title = 'Directorio de servicios de inmigración en LA'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'resource', id, 'en', 'title', 'Basic Technology Guide for Adults' FROM resources WHERE title = 'Guía básica de tecnología para adultos'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

-- Page translations
INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'page', id, 'en', 'title', 'About Barrio Unido' FROM pages WHERE slug = 'nosotros'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

INSERT INTO content_translations (content_type, content_id, language, field, translated_text)
SELECT 'page', id, 'en', 'content', '<h2>Our Story</h2><p>Barrio Unido was born in 2018 when a group of Boyle Heights neighbors decided our community deserved a space of its own — a place where anyone could find help, learn, connect, and celebrate.</p><p>What started as a table with coffee and immigration forms in Lucía Ramírez''s garage is now a community center serving over 2,400 families per year.</p><h2>Our Mission</h2><p>To empower immigrant and Latinx families in East Los Angeles by providing legal services, education, food, and cultural spaces — all free, all with dignity.</p><h2>How to Get Involved</h2><p>It doesn''t matter if you speak Spanish, English, or both. It doesn''t matter what your immigration status is. It doesn''t matter how long you''ve been in the neighborhood. <strong>There''s a place for you here.</strong></p><ul><li>Come to an event and meet the community</li><li>Sign up as a volunteer</li><li>Donate to our food pantry</li><li>Share our resources with someone who needs them</li></ul>' FROM pages WHERE slug = 'nosotros'
ON CONFLICT (content_type, content_id, language, field) DO NOTHING;

-- ============================================
-- 15. FORUM TOPICS (15 topics)
-- ============================================

-- Preguntas y Respuestas
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Preguntas y Respuestas'),
  '¿Cuánto tiempo tarda el proceso de ciudadanía?',
  'Hola, tengo mi green card desde hace 5 años y quiero empezar el proceso. ¿Alguien sabe cuánto tiempo tarda desde que se envía la solicitud hasta el examen? ¿Es difícil el examen?',
  (SELECT id FROM members WHERE email = 'pedro.gutierrez@hotmail.com'), false, 3, now() - interval '2 days',
  now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = '¿Cuánto tiempo tarda el proceso de ciudadanía?');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Preguntas y Respuestas'),
  '¿Dónde puedo encontrar un doctor que hable español?',
  'Necesito un doctor de familia que hable español para mi mamá. Ella no habla inglés y tiene Medi-Cal. ¿Alguien tiene una recomendación en el área de Boyle Heights o East LA?',
  (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com'), false, 4, now() - interval '3 days',
  now() - interval '14 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Preguntas y Respuestas'),
  '¿Cómo me inscribo en las clases de inglés?',
  'Acabo de mudarme al barrio y quiero tomar clases de inglés. ¿Cuándo empiezan? ¿Necesito inscribirme antes o puedo llegar directamente?',
  (SELECT id FROM members WHERE email = 'carmen.aguilar@outlook.com'), false, 2, now() - interval '1 day',
  now() - interval '4 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = '¿Cómo me inscribo en las clases de inglés?');

-- Recursos Compartidos
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Recursos Compartidos'),
  'Lista de clínicas con servicio en español en East LA',
  'Hice una lista de todas las clínicas que conozco en East LA donde atienden en español y aceptan Medi-Cal. Si conocen más, agreguenlas aquí: AltaMed (varias locaciones), White Memorial, Clínica Romero, East LA Doctors Hospital.',
  (SELECT id FROM members WHERE email = 'maria.elena.rios@gmail.com'), true, 3, now() - interval '5 days',
  now() - interval '30 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Lista de clínicas con servicio en español en East LA');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Recursos Compartidos'),
  'App gratuita para practicar inglés',
  'Les recomiendo la app Duolingo para practicar entre clases. Es gratis y tiene lecciones cortas que pueden hacer en el bus o en la espera del doctor. También USALearns.org es muy buena.',
  (SELECT id FROM members WHERE email = 'adriana.morales@gmail.com'), false, 2, now() - interval '8 days',
  now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'App gratuita para practicar inglés');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Recursos Compartidos'),
  'Guía para abrir una cuenta de banco sin SSN',
  'Muchos bancos y credit unions en LA aceptan el ITIN (número de contribuyente) para abrir cuentas. Bank of America, Wells Fargo y Self-Help Federal Credit Union lo hacen. Traigan su ITIN, pasaporte y comprobante de domicilio.',
  (SELECT id FROM members WHERE email = 'sandra.lopez@outlook.com'), false, 2, now() - interval '12 days',
  now() - interval '25 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Guía para abrir una cuenta de banco sin SSN');

-- Empleos y Oportunidades
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Empleos y Oportunidades'),
  'Buscan cocineros en restaurante de la calle César Chávez',
  'El restaurante "La Casita" en César Chávez busca un cocinero con experiencia. Pagan $18/hora, turno de 10 AM a 6 PM, lunes a viernes. Hablar con Don Ramón directamente.',
  (SELECT id FROM members WHERE email = 'marco.fuentes@outlook.com'), false, 1, now() - interval '6 days',
  now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Buscan cocineros en restaurante de la calle César Chávez');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Empleos y Oportunidades'),
  'Beca completa para hijos de inmigrantes — TheDream.US',
  'TheDream.US ofrece becas de hasta $33,000 para dreamers y DACAmentados que quieren ir a la universidad. La fecha límite es en 2 meses. Adriana puede ayudarles con la solicitud.',
  (SELECT id FROM members WHERE email = 'adriana.morales@gmail.com'), true, 3, now() - interval '4 days',
  now() - interval '15 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Beca completa para hijos de inmigrantes — TheDream.US');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Empleos y Oportunidades'),
  'Curso gratuito de computación en East LA College',
  'East LA College ofrece cursos gratis de computación básica, Excel y certificación de Google. No necesitan documentos. Las inscripciones abren la próxima semana.',
  (SELECT id FROM members WHERE email = 'raul.mendoza@gmail.com'), false, 2, now() - interval '7 days',
  now() - interval '18 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Curso gratuito de computación en East LA College');

-- Historias de Éxito
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Historias de Éxito'),
  '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸',
  'Después de 22 años en este país, mi mamá finalmente es ciudadana estadounidense. Estudió con la guía del centro, practicó con el profesor Carlos y la abogada Ana la ayudó con todo el papeleo. Lloré como niño en la ceremonia. ¡Gracias Barrio Unido!',
  (SELECT id FROM members WHERE email = 'jose.hernandez@gmail.com'), false, 5, now() - interval '2 days',
  now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Historias de Éxito'),
  'De alumna de ESL a tutora: mi historia',
  'Hace 3 años llegué al centro sin hablar una palabra de inglés. Hoy soy tutora del programa y estudio en Cal State LA. Todo empezó con las clases del profesor Carlos. Si yo pude, tú también puedes.',
  (SELECT id FROM members WHERE email = 'adriana.morales@gmail.com'), false, 4, now() - interval '6 days',
  now() - interval '22 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Historias de Éxito'),
  'Teresa abrió su propia tienda de costura',
  'Quiero compartir que nuestra compañera Teresa Ruiz abrió su tienda de costura en la calle 1st. Empezó vendiendo en el mercadito del centro y ahora tiene su propio local. ¡Apóyenla! Se llama "Hilos del Barrio".',
  (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'), false, 3, now() - interval '8 days',
  now() - interval '18 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Teresa abrió su propia tienda de costura');

-- Avisos del Barrio
INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Avisos del Barrio'),
  'Cierre de calle 1st por construcción — ruta alternativa',
  'La calle 1st entre Soto y Lorena estará cerrada por 2 semanas por reparación de tuberías. Usen la calle 4th como alternativa. El centro sigue abierto — entren por la puerta de atrás en el callejón.',
  (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'), true, 2, now() - interval '1 day',
  now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Cierre de calle 1st por construcción — ruta alternativa');

INSERT INTO forum_topics (category_id, title, body, author_id, is_pinned, reply_count, last_reply_at, created_at)
SELECT (SELECT id FROM forum_categories WHERE name = 'Avisos del Barrio'),
  'Cuidado: estafas telefónicas haciéndose pasar por ICE',
  'Han reportado llamadas falsas de personas que dicen ser de ICE pidiendo dinero o información personal. ICE NUNCA llama por teléfono para pedir dinero. Si reciben una llamada así, cuelguen y reporten al 1-866-347-2423. Compartan con sus familias.',
  (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'), false, 3, now() - interval '4 days',
  now() - interval '9 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_topics WHERE title = 'Cuidado: estafas telefónicas haciéndose pasar por ICE');

-- ============================================
-- 16. FORUM REPLIES (~40 replies)
-- ============================================

-- Replies to: ¿Cuánto tiempo tarda el proceso de ciudadanía?
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Cuánto tiempo tarda el proceso de ciudadanía?'),
  'Hola Pedro, el proceso normalmente tarda entre 8 y 14 meses desde que envías el formulario N-400. El examen tiene 10 preguntas de civismo y una parte de lectura y escritura en inglés. Ven a la Noche de Ciudadanía y te ayudamos a prepararte.',
  (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'), now() - interval '9 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Cuánto tiempo tarda el proceso de ciudadanía?') AND author_id = (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Cuánto tiempo tarda el proceso de ciudadanía?'),
  'Yo lo hice el año pasado y tardó 10 meses. El examen no es tan difícil si estudias. La guía que tienen aquí en el centro es muy buena.',
  (SELECT id FROM members WHERE email = 'jose.hernandez@gmail.com'), now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Cuánto tiempo tarda el proceso de ciudadanía?') AND author_id = (SELECT id FROM members WHERE email = 'jose.hernandez@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Cuánto tiempo tarda el proceso de ciudadanía?'),
  '¡Ánimo Pedro! En el taller practicamos las preguntas muchas veces. Cuando llegue el día del examen ya te lo vas a saber de memoria.',
  (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'), now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Cuánto tiempo tarda el proceso de ciudadanía?') AND author_id = (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'));

-- Replies to: ¿Dónde puedo encontrar un doctor que hable español?
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?'),
  'AltaMed en la calle César Chávez es muy bueno. Todos hablan español y aceptan Medi-Cal. Mi familia va ahí desde hace años.',
  (SELECT id FROM members WHERE email = 'guadalupe.flores@yahoo.com'), now() - interval '13 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?') AND author_id = (SELECT id FROM members WHERE email = 'guadalupe.flores@yahoo.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?'),
  'También Clínica Romero en la calle Marengo. Son especialistas en atender a la comunidad inmigrante y no piden documentos.',
  (SELECT id FROM members WHERE email = 'maria.elena.rios@gmail.com'), now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?') AND author_id = (SELECT id FROM members WHERE email = 'maria.elena.rios@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?'),
  'En la feria de salud del centro pueden ver a una enfermera sin cita. La próxima es en 2 semanas en el parque Hollenbeck.',
  (SELECT id FROM members WHERE email = 'jennifer.tran@gmail.com'), now() - interval '6 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?') AND author_id = (SELECT id FROM members WHERE email = 'jennifer.tran@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?'),
  'Gracias a todos. Voy a llamar a AltaMed mañana. Mi mamá va a estar contenta.',
  (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com'), now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Dónde puedo encontrar un doctor que hable español?') AND author_id = (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com') AND body LIKE '%AltaMed%');

-- Replies to: ¿Cómo me inscribo en las clases de inglés?
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Cómo me inscribo en las clases de inglés?'),
  'Bienvenida Carmen. Puedes llegar directamente el lunes o miércoles a las 6 PM. Empezamos un nuevo ciclo para principiantes la próxima semana. No necesitas traer nada, nosotros damos los materiales.',
  (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'), now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Cómo me inscribo en las clases de inglés?') AND author_id = (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¿Cómo me inscribo en las clases de inglés?'),
  'Yo empecé hace un año sin saber nada. ¡Ahora ya puedo tener conversaciones básicas! Las clases son muy buenas y el profesor Carlos tiene mucha paciencia.',
  (SELECT id FROM members WHERE email = 'pedro.gutierrez@hotmail.com'), now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¿Cómo me inscribo en las clases de inglés?') AND author_id = (SELECT id FROM members WHERE email = 'pedro.gutierrez@hotmail.com'));

-- Replies to: Lista de clínicas con servicio en español
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Lista de clínicas con servicio en español en East LA'),
  'Agrego: St. John''s Well Child & Family Center en South Central también tiene sede en East LA. Pediatras y doctores generales.',
  (SELECT id FROM members WHERE email = 'jennifer.tran@gmail.com'), now() - interval '25 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Lista de clínicas con servicio en español en East LA') AND author_id = (SELECT id FROM members WHERE email = 'jennifer.tran@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Lista de clínicas con servicio en español en East LA'),
  'También SPIRITT Family Services ofrece consejería en español, por si alguien necesita apoyo emocional.',
  (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'), now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Lista de clínicas con servicio en español en East LA') AND author_id = (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Lista de clínicas con servicio en español en East LA'),
  'Excelente lista María Elena. La voy a imprimir para tenerla en la recepción del centro.',
  (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com'), now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Lista de clínicas con servicio en español en East LA') AND author_id = (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com') AND body LIKE '%María Elena%');

-- Replies to: ¡Mi mamá pasó el examen de ciudadanía!
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸'),
  '¡Muchas felicidades a tu mamá, José! Fue un honor ayudarla con su caso. Se lo merece.',
  (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'), now() - interval '11 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸') AND author_id = (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸'),
  'Estoy llorando de la emoción leyendo esto. Tu mamá estudió tanto — se lo merece. ¡Felicidades!',
  (SELECT id FROM members WHERE email = 'guadalupe.flores@yahoo.com'), now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸') AND author_id = (SELECT id FROM members WHERE email = 'guadalupe.flores@yahoo.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸'),
  'Fue una de mis mejores alumnas. Siempre llegaba temprano a practicar. ¡Felicidades doña!',
  (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'), now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸') AND author_id = (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸'),
  '¡Esto es lo que hace Barrio Unido! Qué orgullo. 22 años de espera valieron la pena.',
  (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'), now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸') AND author_id = (SELECT id FROM members WHERE email = 'lucia.ramirez@barriounido.org'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸'),
  'Congratulations! This is such an inspiring story. Your mom is a hero.',
  (SELECT id FROM members WHERE email = 'david.kim@gmail.com'), now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = '¡Mi mamá pasó el examen de ciudadanía! 🇺🇸') AND author_id = (SELECT id FROM members WHERE email = 'david.kim@gmail.com'));

-- Replies to: De alumna de ESL a tutora
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia'),
  'Adriana, tu historia me da tanta esperanza. Yo apenas estoy empezando y a veces me desanimo. Gracias por compartir.',
  (SELECT id FROM members WHERE email = 'carmen.aguilar@outlook.com'), now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia') AND author_id = (SELECT id FROM members WHERE email = 'carmen.aguilar@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia'),
  'Adriana es la prueba viviente de que el programa funciona. Estoy orgulloso de haber sido su maestro.',
  (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'), now() - interval '15 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia') AND author_id = (SELECT id FROM members WHERE email = 'carlos.medina@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia'),
  'You are an inspiration, Adriana. The kids in the youth program look up to you so much.',
  (SELECT id FROM members WHERE email = 'patricia.wong@gmail.com'), now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia') AND author_id = (SELECT id FROM members WHERE email = 'patricia.wong@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia'),
  '¡Echándole ganas! Qué bonita historia. El barrio necesita más jóvenes como tú.',
  (SELECT id FROM members WHERE email = 'teresa.ruiz@yahoo.com'), now() - interval '6 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'De alumna de ESL a tutora: mi historia') AND author_id = (SELECT id FROM members WHERE email = 'teresa.ruiz@yahoo.com'));

-- Replies to: Beca completa para hijos de inmigrantes
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Beca completa para hijos de inmigrantes — TheDream.US'),
  '¡Gracias por compartir esto! Mi hija está en 12vo grado y esto le vendría perfecto.',
  (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com'), now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Beca completa para hijos de inmigrantes — TheDream.US') AND author_id = (SELECT id FROM members WHERE email = 'rosa.martinez@yahoo.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Beca completa para hijos de inmigrantes — TheDream.US'),
  'Rosa, dile a tu hija que venga al centro el sábado. La puedo ayudar con el ensayo y la solicitud.',
  (SELECT id FROM members WHERE email = 'adriana.morales@gmail.com'), now() - interval '10 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Beca completa para hijos de inmigrantes — TheDream.US') AND author_id = (SELECT id FROM members WHERE email = 'adriana.morales@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Beca completa para hijos de inmigrantes — TheDream.US'),
  'Voy a imprimir la información y ponerla en la escuela donde trabajo. Muchos estudiantes necesitan saber de esto.',
  (SELECT id FROM members WHERE email = 'patricia.wong@gmail.com'), now() - interval '4 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Beca completa para hijos de inmigrantes — TheDream.US') AND author_id = (SELECT id FROM members WHERE email = 'patricia.wong@gmail.com'));

-- Replies to: Estafas telefónicas de ICE
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Cuidado: estafas telefónicas haciéndose pasar por ICE'),
  'Muy importante. A mi vecina le llamaron la semana pasada y estaba aterrorizada. Le expliqué que era falso. Hay que compartir esta información.',
  (SELECT id FROM members WHERE email = 'jose.hernandez@gmail.com'), now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Cuidado: estafas telefónicas haciéndose pasar por ICE') AND author_id = (SELECT id FROM members WHERE email = 'jose.hernandez@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Cuidado: estafas telefónicas haciéndose pasar por ICE'),
  'Recuerden: tienen derecho a no abrir la puerta, a guardar silencio y a pedir un abogado. Descarguen la tarjeta de derechos de nuestra sección de recursos.',
  (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com'), now() - interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Cuidado: estafas telefónicas haciéndose pasar por ICE') AND author_id = (SELECT id FROM members WHERE email = 'ana.delgado@gmail.com') AND body LIKE '%tarjeta de derechos%');

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Cuidado: estafas telefónicas haciéndose pasar por ICE'),
  'Compartí esto en mi grupo de WhatsApp del barrio. Gracias por la información Ana.',
  (SELECT id FROM members WHERE email = 'guadalupe.flores@yahoo.com'), now() - interval '4 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Cuidado: estafas telefónicas haciéndose pasar por ICE') AND author_id = (SELECT id FROM members WHERE email = 'guadalupe.flores@yahoo.com'));

-- Replies to: Teresa abrió su propia tienda
INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Teresa abrió su propia tienda de costura'),
  '¡Felicidades Teresa! Voy a pasar esta semana. Necesito arreglar unos pantalones.',
  (SELECT id FROM members WHERE email = 'maria.elena.rios@gmail.com'), now() - interval '15 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Teresa abrió su propia tienda de costura') AND author_id = (SELECT id FROM members WHERE email = 'maria.elena.rios@gmail.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Teresa abrió su propia tienda de costura'),
  'Qué orgullo. Teresa empezó vendiendo delantales en el mercadito y ahora tiene su local. ¡El sueño americano en acción!',
  (SELECT id FROM members WHERE email = 'marco.fuentes@outlook.com'), now() - interval '12 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Teresa abrió su propia tienda de costura') AND author_id = (SELECT id FROM members WHERE email = 'marco.fuentes@outlook.com'));

INSERT INTO forum_replies (topic_id, body, author_id, created_at)
SELECT (SELECT id FROM forum_topics WHERE title = 'Teresa abrió su propia tienda de costura'),
  'Gracias a todos por el apoyo. Si alguien necesita uniformes, vestidos de quinceañera o arreglos, ya saben dónde encontrarme.',
  (SELECT id FROM members WHERE email = 'teresa.ruiz@yahoo.com'), now() - interval '8 days'
WHERE NOT EXISTS (SELECT 1 FROM forum_replies WHERE topic_id = (SELECT id FROM forum_topics WHERE title = 'Teresa abrió su propia tienda de costura') AND author_id = (SELECT id FROM members WHERE email = 'teresa.ruiz@yahoo.com'));

-- ============================================
-- 17. ACTIVITY LOG (30 entries)
-- ============================================

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'signup', m.id, '{"name": "Diego Salazar"}', now() - interval '5 days'
FROM members m WHERE m.email = 'diego.salazar@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'signup' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'signup', m.id, '{"name": "Carmen Aguilar"}', now() - interval '3 days'
FROM members m WHERE m.email = 'carmen.aguilar@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'signup' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'announcement', m.id, '{"title": "Buscamos voluntarios para el mercadito"}', now() - interval '3 days'
FROM members m WHERE m.email = 'teresa.ruiz@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%mercadito%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Clínica Legal Gratuita", "status": "going"}', now() - interval '2 days'
FROM members m WHERE m.email = 'pedro.gutierrez@hotmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Clínica Legal%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Noche de Ciudadanía", "status": "going"}', now() - interval '2 days'
FROM members m WHERE m.email = 'jose.hernandez@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Ciudadanía%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'post', m.id, '{"topic": "¡Mi mamá pasó el examen de ciudadanía! 🇺🇸"}', now() - interval '12 days'
FROM members m WHERE m.email = 'jose.hernandez@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'post' AND metadata::text LIKE '%ciudadanía%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'announcement', m.id, '{"title": "Próxima clínica legal: actualización sobre DACA"}', now() - interval '7 days'
FROM members m WHERE m.email = 'ana.delgado@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%DACA%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Mercadito del Barrio", "status": "going"}', now() - interval '1 day'
FROM members m WHERE m.email = 'teresa.ruiz@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Mercadito%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Mercadito del Barrio", "status": "going"}', now() - interval '1 day'
FROM members m WHERE m.email = 'marco.fuentes@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Mercadito%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Feria de Salud Comunitaria", "status": "going"}', now() - interval '4 days'
FROM members m WHERE m.email = 'maria.elena.rios@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Feria de Salud%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'post', m.id, '{"topic": "Cierre de calle 1st por construcción"}', now() - interval '3 days'
FROM members m WHERE m.email = 'lucia.ramirez@barriounido.org'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'post' AND metadata::text LIKE '%calle 1st%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'resource_upload', m.id, '{"title": "Guía básica de tecnología para adultos"}', now() - interval '90 days'
FROM members m WHERE m.email = 'raul.mendoza@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'resource_upload' AND metadata::text LIKE '%tecnología%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Taller de Impuestos Gratis (VITA)", "status": "going"}', now() - interval '1 day'
FROM members m WHERE m.email = 'sandra.lopez@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Impuestos%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Noche de Ciudadanía", "status": "going"}', now() - interval '3 days'
FROM members m WHERE m.email = 'carlos.medina@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Ciudadanía%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'post', m.id, '{"topic": "¿Cómo me inscribo en las clases de inglés?"}', now() - interval '4 days'
FROM members m WHERE m.email = 'carmen.aguilar@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'post' AND metadata::text LIKE '%clases de inglés%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'announcement', m.id, '{"title": "Récord en la despensa: 180 familias servidas"}', now() - interval '14 days'
FROM members m WHERE m.email = 'rosa.martinez@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%180 familias%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Feria de Salud Comunitaria", "status": "going"}', now() - interval '5 days'
FROM members m WHERE m.email = 'rosa.martinez@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Feria de Salud%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Clínica Legal Gratuita", "status": "going"}', now() - interval '2 days'
FROM members m WHERE m.email = 'ana.delgado@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Clínica Legal%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'post', m.id, '{"topic": "Buscan cocineros en restaurante de la calle César Chávez"}', now() - interval '8 days'
FROM members m WHERE m.email = 'marco.fuentes@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'post' AND metadata::text LIKE '%cocineros%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Mercadito del Barrio", "status": "going"}', now() - interval '2 days'
FROM members m WHERE m.email = 'guadalupe.flores@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Mercadito%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Noche de Ciudadanía", "status": "going"}', now() - interval '4 days'
FROM members m WHERE m.email = 'lucia.ramirez@barriounido.org'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Ciudadanía%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'post', m.id, '{"topic": "Cuidado: estafas telefónicas haciéndose pasar por ICE"}', now() - interval '9 days'
FROM members m WHERE m.email = 'ana.delgado@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'post' AND metadata::text LIKE '%estafas%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Feria de Salud Comunitaria", "status": "going"}', now() - interval '6 days'
FROM members m WHERE m.email = 'guadalupe.flores@yahoo.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Feria de Salud%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'resource_upload', m.id, '{"title": "Solicitud de beca juvenil Barrio Unido"}', now() - interval '80 days'
FROM members m WHERE m.email = 'adriana.morales@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'resource_upload' AND metadata::text LIKE '%beca%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Taller de Impuestos Gratis (VITA)", "status": "going"}', now() - interval '3 days'
FROM members m WHERE m.email = 'jose.hernandez@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Impuestos%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'announcement', m.id, '{"title": "¡18 graduados del programa de ESL!"}', now() - interval '28 days'
FROM members m WHERE m.email = 'carlos.medina@outlook.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'announcement' AND metadata::text LIKE '%18 graduados%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Clínica Legal Gratuita", "status": "going"}', now() - interval '1 day'
FROM members m WHERE m.email = 'david.kim@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Clínica Legal%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'post', m.id, '{"topic": "App gratuita para practicar inglés"}', now() - interval '20 days'
FROM members m WHERE m.email = 'adriana.morales@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'post' AND metadata::text LIKE '%Duolingo%');

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Mercadito del Barrio", "status": "going"}', now() - interval '1 day'
FROM members m WHERE m.email = 'oscar.herrera@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Mercadito%' AND member_id = m.id);

INSERT INTO activity_log (action, member_id, metadata, created_at)
SELECT 'rsvp', m.id, '{"event": "Noche de Ciudadanía", "status": "going"}', now() - interval '3 days'
FROM members m WHERE m.email = 'ana.delgado@gmail.com'
AND NOT EXISTS (SELECT 1 FROM activity_log WHERE action = 'rsvp' AND metadata::text LIKE '%Ciudadanía%' AND member_id = m.id);
