// Test fixtures: site_config variations

export const defaultConfig = [
  { key: 'site_name', value: 'Test Community', category: 'branding' },
  { key: 'site_tagline', value: 'A test community', category: 'branding' },
  { key: 'site_description', value: 'Test description', category: 'branding' },
  { key: 'logo_url', value: '', category: 'branding' },
  { key: 'favicon_url', value: '', category: 'branding' },
  { key: 'theme', value: {
    primary: '#6366f1', primary_hover: '#4f46e5', bg: '#ffffff',
    surface: '#f8fafc', text: '#0f172a', text_muted: '#64748b',
    border: '#e2e8f0', font_heading: 'Inter', font_body: 'Inter',
    radius: '0.5rem', max_width: '72rem',
  }, category: 'theme' },
  { key: 'feature_events', value: true, category: 'features' },
  { key: 'feature_forum', value: false, category: 'features' },
  { key: 'feature_directory', value: true, category: 'features' },
  { key: 'feature_resources', value: false, category: 'features' },
  { key: 'feature_blog', value: false, category: 'features' },
  { key: 'feature_committees', value: false, category: 'features' },
  { key: 'feature_ai_moderation', value: false, category: 'features' },
  { key: 'feature_ai_translation', value: false, category: 'features' },
  { key: 'feature_ai_newsletter', value: false, category: 'features' },
  { key: 'feature_ai_insights', value: false, category: 'features' },
  { key: 'feature_ai_onboarding', value: false, category: 'features' },
  { key: 'feature_ai_event_recaps', value: false, category: 'features' },
  { key: 'directory_public', value: false, category: 'features' },
  { key: 'nav', value: [
    { label: 'Home', href: '/', icon: 'home', public: true },
    { label: 'Members', href: '/directory.html', icon: 'users', auth: true, feature: 'feature_directory' },
    { label: 'Events', href: '/events.html', icon: 'calendar', feature: 'feature_events' },
    { label: 'Forum', href: '/forum.html', icon: 'message-circle', feature: 'feature_forum' },
    { label: 'Dashboard', href: '/admin.html', icon: 'bar-chart-2', admin: true },
  ], category: 'nav' },
];

export const allFeaturesEnabled = defaultConfig.map(c =>
  c.key.startsWith('feature_') ? { ...c, value: true } : c
);

export const noFeaturesEnabled = defaultConfig.map(c =>
  c.key.startsWith('feature_') ? { ...c, value: false } : c
);

export const defaultTheme = defaultConfig.find(c => c.key === 'theme').value;
export const defaultNav = defaultConfig.find(c => c.key === 'nav').value;

export const featureFlags = [
  'feature_events', 'feature_forum', 'feature_directory', 'feature_resources',
  'feature_blog', 'feature_committees', 'feature_ai_moderation',
  'feature_ai_translation', 'feature_ai_newsletter', 'feature_ai_insights',
  'feature_ai_onboarding', 'feature_ai_event_recaps',
];
