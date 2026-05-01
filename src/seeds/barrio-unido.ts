import type { ProjectSeed } from './types.js';

const BARRIO_NAV = [
  { label: 'Inicio', href: '/', icon: 'home', public: true },
  { label: 'Nosotros', href: '/page.html?slug=nosotros', icon: 'info', public: true },
  { label: 'Miembros', href: '/directory.html', icon: 'users', auth: true, feature: 'feature_directory' },
  { label: 'Eventos', href: '/events.html', icon: 'calendar', feature: 'feature_events' },
  { label: 'Recursos', href: '/resources.html', icon: 'book-open', feature: 'feature_resources' },
  { label: 'Foro', href: '/forum.html', icon: 'message-circle', feature: 'feature_forum' },
  { label: 'Programas', href: '/committees.html', icon: 'heart', feature: 'feature_committees' },
  { label: 'Panel', href: '/admin.html', icon: 'bar-chart-2', admin: true },
  { label: 'Miembros', href: '/admin-members.html', icon: 'users', admin: true },
  { label: 'Configuración', href: '/admin-settings.html', icon: 'settings', admin: true },
];

const NOSOTROS_HTML = `<img src="/assets/about.jpg" alt="Comunidad de Barrio Unido" style="width:100%;border-radius:0.75rem;margin-bottom:2rem"><h2>Nuestra Historia</h2><p>Barrio Unido nació en 2018 cuando un grupo de vecinos de Boyle Heights decidió que nuestra comunidad merecía un espacio propio — un lugar donde cualquier persona pudiera encontrar ayuda, aprender, conectar y celebrar.</p><p>Lo que empezó como una mesa con café y formularios de inmigración en el garaje de Lucía Ramírez, hoy es un centro comunitario que sirve a más de 2,400 familias al año.</p><h2>Nuestra Misión</h2><p>Empoderar a las familias inmigrantes y latinx de East Los Angeles proporcionando servicios legales, educación, alimentos y espacios culturales — todo gratuito, todo con dignidad.</p><h2>Cómo Participar</h2><p>No importa si hablas español, inglés o ambos. No importa tu estatus migratorio. No importa cuánto tiempo lleves en el barrio. <strong>Aquí hay un lugar para ti.</strong></p><ul><li>Ven a un evento y conoce a la comunidad</li><li>Inscríbete como voluntario/a</li><li>Dona a nuestra despensa de alimentos</li><li>Comparte nuestros recursos con alguien que los necesite</li></ul>`;

export const seed: ProjectSeed = {
  site_config: {
    site_name: { value: 'Centro Comunitario Barrio Unido', category: 'branding' },
    site_tagline: { value: 'Juntos, somos más fuertes', category: 'branding' },
    site_description: {
      value:
        'Barrio Unido es un centro comunitario en el corazón de Boyle Heights, Los Ángeles. Ofrecemos clases de inglés, preparación para la ciudadanía, clínica legal gratuita, despensa de alimentos y eventos culturales. Desde 2018, hemos servido a más de 2,400 familias.',
      category: 'branding',
    },
    // Logo is square 256×256 → brand_icon_url. Picker rule: icon + text.
    brand_text: { value: 'Centro Comunitario Barrio Unido', category: 'branding' },
    brand_text_short: { value: 'Barrio Unido', category: 'branding' },
    brand_icon_url: { value: '/assets/logo.png', category: 'branding' },
    brand_wordmark_url: { value: '', category: 'branding' },
    favicon_url: { value: '/assets/logo.png', category: 'branding' },
    theme: {
      value: {
        primary: '#C2553A',
        primary_hover: '#A8432D',
        bg: '#FFF8F0',
        surface: '#F0E6D8',
        text: '#2D1810',
        text_muted: '#7A6B5E',
        border: '#D4C4B0',
        font_heading: 'Merriweather',
        font_body: 'Noto Sans',
        radius: '0.75rem',
        max_width: '72rem',
      },
      category: 'theme',
    },
    feature_events: { value: true, category: 'features' },
    feature_forum: { value: true, category: 'features' },
    feature_directory: { value: true, category: 'features' },
    feature_resources: { value: true, category: 'features' },
    feature_blog: { value: false, category: 'features' },
    feature_committees: { value: true, category: 'features' },
    feature_ai_moderation: { value: false, category: 'features' },
    feature_ai_translation: { value: false, category: 'features' },
    feature_ai_newsletter: { value: false, category: 'features' },
    feature_ai_insights: { value: false, category: 'features' },
    feature_ai_onboarding: { value: false, category: 'features' },
    feature_ai_event_recaps: { value: false, category: 'features' },
    feature_activity_feed: { value: true, category: 'features' },
    feature_reactions: { value: true, category: 'features' },
    directory_public: { value: false, category: 'features' },
    signup_mode: { value: 'approved', category: 'features' },
    demo_mode: { value: true, category: 'features' },
    languages: { value: ['es', 'en'], category: 'i18n' },
    default_language: { value: 'es', category: 'i18n' },
  },
  membership_tiers: [
    {
      name: 'Vecino/a',
      description: 'Cualquier persona del barrio es bienvenida',
      benefits: ['Ver avisos', 'Calendario de eventos', 'Foro comunitario'],
      price_label: 'Gratis',
      position: 1,
      is_default: true,
    },
    {
      name: 'Voluntario/a',
      description: 'Miembros activos que donan su tiempo',
      benefits: ['Directorio de miembros', 'Recursos', 'Inscripción a eventos', 'Foro', 'Programas'],
      price_label: 'Gratis',
      position: 2,
    },
    {
      name: 'Promotor/a',
      description: 'Líderes comunitarios que coordinan programas',
      benefits: ['Todos los beneficios', 'Coordinar eventos', 'Moderar foro', 'Acceso a reportes'],
      price_label: 'Gratis',
      position: 3,
    },
    {
      name: 'Consejero/a',
      description: 'Miembros de la mesa directiva',
      benefits: ['Acceso completo', 'Herramientas de administración', 'Reuniones de mesa directiva', 'Planificación estratégica'],
      price_label: 'Por nombramiento',
      position: 4,
    },
  ],
  member_custom_fields: [
    { field_name: 'telefono', field_label: 'Teléfono', field_type: 'text', required: false, visible_in_directory: false, position: 1 },
    { field_name: 'colonia', field_label: 'Colonia / Barrio', field_type: 'text', required: false, visible_in_directory: true, position: 2 },
    {
      field_name: 'idiomas',
      field_label: 'Idiomas',
      field_type: 'multi_select',
      options: ['español', 'inglés', 'portugués', 'mixteco', 'zapoteco', 'náhuatl'],
      required: false,
      visible_in_directory: true,
      position: 3,
    },
    {
      field_name: 'habilidades',
      field_label: 'Habilidades',
      field_type: 'multi_select',
      options: ['enseñanza', 'traducción', 'legal', 'cocina', 'organización', 'tecnología', 'cuidado de niños', 'construcción'],
      required: false,
      visible_in_directory: true,
      position: 4,
    },
  ],
  pages: [
    { slug: 'nosotros', title: 'Sobre Barrio Unido', content: NOSOTROS_HTML, published: true },
  ],
  sections: [
    // --- Header chrome (global) ---
    {
      page_slug: '*',
      zone: 'header',
      scope: 'global',
      section_type: 'brand_header',
      config: { href: '/' },
      position: 1,
    },
    {
      page_slug: '*',
      zone: 'header',
      scope: 'global',
      section_type: 'nav',
      config: { items: BARRIO_NAV },
      position: 2,
    },
    {
      page_slug: '*',
      zone: 'header',
      scope: 'global',
      section_type: 'sign_in_bar',
      config: { show_lang_toggle: true, show_theme_toggle: true },
      position: 3,
    },
    // --- Homepage main ---
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'hero',
      config: {
        heading: 'Bienvenidos a Barrio Unido',
        subheading: 'Tu centro comunitario en el corazón de Boyle Heights. Clases de inglés, clínica legal, despensa de alimentos, eventos culturales y más — todo gratis, todo para ti.',
        cta_text: 'Únete a la comunidad',
        cta_href: '/page.html?slug=nosotros',
        bg_image: '/assets/hero.jpg',
      },
      position: 1,
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'stats',
      config: {
        items: [
          { value: '2,400+', label: 'Familias servidas' },
          { value: '850+', label: 'Clases de inglés completadas' },
          { value: '340+', label: 'Consultas legales' },
          { value: '60+', label: 'Eventos al año' },
        ],
      },
      position: 2,
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'features',
      config: {
        columns: 3,
        items: [
          { icon: 'shield', title: 'Clínica Legal', desc: 'Consultas gratuitas con abogados de inmigración. DACA, permisos de trabajo, asilo, ciudadanía.' },
          { icon: 'book-open', title: 'Clases de Inglés', desc: 'ESL para adultos, desde principiante hasta avanzado. Clases de conversación y gramática.' },
          { icon: 'file-text', title: 'Ciudadanía', desc: 'Talleres mensuales de preparación para el examen. Simulacros de entrevista y ayuda con formularios.' },
          { icon: 'heart', title: 'Despensa de Alimentos', desc: 'Distribución semanal de alimentos frescos para familias del barrio. Martes y jueves, 4-7 PM.' },
          { icon: 'users', title: 'Jóvenes Unidos', desc: 'Mentoría, tutoría escolar, arte y deportes para jóvenes de 12 a 18 años.' },
          { icon: 'calendar', title: 'Cultura y Fiestas', desc: 'Día de los Muertos, Posada Navideña, mercaditos, noches de cine y más.' },
        ],
      },
      position: 3,
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'testimonials',
      config: {
        items: [
          { quote: 'Barrio Unido me ayudó a conseguir mi ciudadanía después de 18 años en este país. No tengo palabras para agradecer a Lucía y a Ana.', name: 'María Elena Ríos', role: 'Promotora' },
          { quote: 'My kids found a second family in the youth program. Adriana and Óscar have been incredible mentors. This place changes lives.', name: 'Jennifer Tran', role: 'Social Worker & Volunteer' },
          { quote: 'Llegué sin hablar una palabra de inglés. Ahora puedo hablar con el doctor, con la maestra de mis hijos, con mi jefe. Gracias, profesor Carlos.', name: 'Pedro Gutiérrez', role: 'Voluntario de construcción' },
        ],
      },
      position: 4,
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'embed',
      config: {
        heading: 'Clima en Boyle Heights (Windy)',
        provider: 'iframe',
        params: {
          // Windy embed for Boyle Heights, Los Angeles. Windy is iframe-
          // friendly and renders fully under `allow-scripts allow-same-origin`.
          // (Note: a "weather" verified provider exists too; using the
          // generic iframe here keeps the trust-gate + "External content"
          // pill flow visible for demo.)
          src: 'https://embed.windy.com/embed2.html?lat=34.0334&lon=-118.2073&zoom=10&type=map&location=coordinates&detail=&metricWind=mph&metricTemp=%C2%B0F&radarRange=-1',
        },
        // Pre-acknowledged at seed time — this is the seed-level equivalent
        // of an admin checking "I trust embed.windy.com" in the edit popover.
        trust_acknowledged: true,
        height: '480px',
        responsive: false,
      },
      position: 5,
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'announcements_feed',
      config: { heading: 'Avisos', limit: 20 },
      position: 6,
      // column-span-rows: avisos + actividad reciente side-by-side.
      column_span: '2/3',
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'activity_feed',
      config: { limit: 15 },
      position: 7,
      column_span: '1/3',
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'cta',
      config: {
        heading: 'El barrio te necesita — y tú nos necesitas a nosotros',
        text: 'Ya seas vecino/a nuevo o de toda la vida, hay un lugar para ti en Barrio Unido. Ven a conocernos.',
        cta_text: 'Hazte voluntario/a',
        cta_href: '/page.html?slug=nosotros',
      },
      position: 8,
    },
    // --- Footer chrome (global) ---
    // column-span-rows: address + copyright share a row in the footer.
    {
      page_slug: '*',
      zone: 'footer',
      scope: 'global',
      section_type: 'footer_address',
      config: {
        name: 'Centro Comunitario Barrio Unido',
        address_lines: ['Boyle Heights, Los Ángeles, CA'],
        phone: '323-555-0100',
        email: 'hola@barriounido.org',
        hours: 'Lun–Vie 9am–6pm · Sábados 10am–2pm',
      },
      position: 1,
      column_span: '1/2',
    },
    {
      page_slug: '*',
      zone: 'footer',
      scope: 'global',
      section_type: 'footer_copyright',
      config: {
        year: 'auto',
        org_name: 'Centro Comunitario Barrio Unido',
        admin_contact_label: 'Contáctanos',
        admin_contact_href: 'mailto:hola@barriounido.org',
      },
      position: 2,
      column_span: '1/2',
    },
    {
      page_slug: '*',
      zone: 'footer',
      scope: 'global',
      section_type: 'footer_attribution',
      config: { text: 'Powered by [Kychon](https://kychon.com) on [Run402](https://run402.com)' },
      position: 99,
    },
  ],
  extraSqlFile: 'demo/barrio-unido/seed.sql',
};
