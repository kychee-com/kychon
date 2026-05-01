import type { ProjectSeed } from './types.js';

const EAGLES_NAV = [
  { label: 'Home', href: '/', icon: 'home', public: true },
  { label: 'About', href: '/page.html?slug=about', icon: 'info', public: true },
  { label: 'Volunteer', href: '/page.html?slug=volunteer', icon: 'heart', public: true },
  { label: 'Members', href: '/directory.html', icon: 'users', auth: true, feature: 'feature_directory' },
  { label: 'Events', href: '/events.html', icon: 'calendar', feature: 'feature_events' },
  { label: 'Resources', href: '/resources.html', icon: 'book-open', feature: 'feature_resources' },
  { label: 'Forum', href: '/forum.html', icon: 'message-circle', feature: 'feature_forum' },
  { label: 'Committees', href: '/committees.html', icon: 'briefcase', feature: 'feature_committees' },
  { label: 'Dashboard', href: '/admin.html', icon: 'bar-chart-2', admin: true },
  { label: 'Members', href: '/admin-members.html', icon: 'users', admin: true },
  { label: 'Settings', href: '/admin-settings.html', icon: 'settings', admin: true },
];

const ABOUT_HTML = `
<section class="page-content">
  <img src="/assets/about-hero.jpg" alt="Eagles volunteers serving the Wichita community" style="width:100%;max-height:28rem;aspect-ratio:16/9;object-fit:cover;border-radius:0.75rem;margin-bottom:2rem" />
  <h1>About The Eagles — Good Samaritans of Wichita</h1>

  <h2>Our Story</h2>
  <p>The Eagles were founded in 2014 by a small group of Wichita neighbors who believed that everyday people could create extraordinary change. What started as a weekend food drive in a church parking lot has grown into one of Sedgwick County's most active volunteer organizations, with over 200 members and 15,000 cumulative volunteer hours.</p>

  <h2>Our Mission</h2>
  <p>We exist to lift our community — one neighbor at a time. Through hands-on volunteering, food security programs, youth mentoring, habitat builds, and community outreach, The Eagles connect people who want to help with people who need it most.</p>

  <h2>Our Values</h2>
  <ul>
    <li><strong>Service First</strong> — We show up, roll up our sleeves, and do the work.</li>
    <li><strong>Every Neighbor Matters</strong> — We serve all Wichitans regardless of background, identity, or circumstance.</li>
    <li><strong>Transparency</strong> — Every dollar donated and every hour volunteered is accounted for and reported.</li>
    <li><strong>Joy in Giving</strong> — Volunteering is not a chore. It is a privilege that enriches the giver as much as the receiver.</li>
    <li><strong>Community Over Ego</strong> — We celebrate collective impact, not individual recognition.</li>
  </ul>

  <h2>What We Do</h2>
  <p>The Eagles operate year-round programs including:</p>
  <ul>
    <li><strong>Food Drives & Holiday Baskets</strong> — Collecting and distributing thousands of pounds of food annually</li>
    <li><strong>Habitat Builds</strong> — Partnering with Habitat for Humanity to build homes for Wichita families</li>
    <li><strong>Youth Mentoring</strong> — One-on-one mentoring for at-risk teens, with a focus on education and career readiness</li>
    <li><strong>Community Garden</strong> — Growing fresh produce donated to local food pantries</li>
    <li><strong>Coat & Supply Drives</strong> — Keeping families warm in winter and kids prepared for school</li>
    <li><strong>Home Repairs</strong> — Fixing porches, plumbing, and safety hazards for elderly and low-income homeowners</li>
  </ul>

  <h2>By the Numbers</h2>
  <ul>
    <li><strong>12 years</strong> of service to Wichita</li>
    <li><strong>200+</strong> active members and volunteers</li>
    <li><strong>15,000+</strong> cumulative volunteer hours</li>
    <li><strong>5,000+</strong> neighbors directly helped</li>
    <li><strong>350</strong> holiday food baskets delivered last year</li>
    <li><strong>800 lbs</strong> of produce grown in our community garden</li>
  </ul>

  <h2>Leadership</h2>
  <p>The Eagles are governed by a volunteer Board of Directors and led by six standing committees: Fundraising, Community Outreach, Youth Programs, Events Planning, Communications & Media, and the Board itself. Every member has a voice and a vote.</p>

  <p><strong>President:</strong> Marcus Reid — founding member, retired teacher, and lifelong Wichitan.</p>
</section>
`;

const VOLUNTEER_HTML = `
<section class="page-content">
  <img src="/assets/volunteer-hero.jpg" alt="Hands joining together — Eagles volunteers at work" style="width:100%;max-height:28rem;aspect-ratio:16/9;object-fit:cover;border-radius:0.75rem;margin-bottom:2rem" />
  <h1>Volunteer With The Eagles</h1>

  <p>Whether you have an hour or a hundred, there is a place for you with The Eagles. We welcome volunteers of all ages, backgrounds, and skill levels. No experience necessary — just a willingness to help.</p>

  <h2>How to Get Started</h2>
  <ol>
    <li><strong>Sign Up</strong> — Create a free account on this site. Select "Volunteer" as your membership tier.</li>
    <li><strong>Attend Orientation</strong> — Join our monthly New Volunteer Training Workshop to learn about safety protocols, programs, and how everything works.</li>
    <li><strong>Pick Your First Event</strong> — Browse upcoming events and RSVP. We recommend starting with a food drive or park cleanup — they are fun, social, and easy to jump into.</li>
    <li><strong>Find Your Niche</strong> — Love building things? Join a Habitat crew. Great with kids? Try youth mentoring. Prefer the kitchen? Help with community meals. There is something for everyone.</li>
  </ol>

  <h2>Volunteer Opportunities</h2>

  <h3>Food Security</h3>
  <p>Sort and pack food donations, drive delivery routes to distribution sites, or help coordinate our holiday food basket program. We partner with the Kansas Food Bank and serve 12 sites across Wichita.</p>

  <h3>Construction & Home Repair</h3>
  <p>Join Habitat for Humanity build crews or our home repair brigade for elderly and low-income homeowners. Skills in carpentry, plumbing, or electrical work are a plus, but we train on site.</p>

  <h3>Youth Mentoring</h3>
  <p>Mentor an at-risk teen one-on-one, help with homework and college prep, or lead group workshops on life skills. Background checks are required. Training is provided.</p>

  <h3>Community Garden</h3>
  <p>Plant, weed, water, and harvest fresh produce at our Fairmount Park garden. All produce is donated to local food pantries. No gardening experience needed.</p>

  <h3>Events & Fundraising</h3>
  <p>Help plan and run our annual gala, fall festival, and other community events. Tasks include setup, registration, food service, photography, and cleanup.</p>

  <h3>Communications</h3>
  <p>Write newsletter articles, manage social media, take event photos, or design promotional materials. If you have media or marketing skills, we need you.</p>

  <h2>Skills We Need</h2>
  <p>Every skill is valuable. Here are some we are especially looking for:</p>
  <ul>
    <li>Construction, carpentry, plumbing</li>
    <li>Cooking and food handling</li>
    <li>Driving (especially with a truck or van)</li>
    <li>Mentoring and tutoring</li>
    <li>Fundraising and proposal writing</li>
    <li>Event organizing and logistics</li>
    <li>Technology, web, and social media</li>
    <li>Spanish or other language skills</li>
  </ul>

  <h2>Time Commitment</h2>
  <p>There is no minimum requirement. Some Eagles volunteer every weekend; others help once a quarter. We track hours so you can document your service for employers, schools, or personal records.</p>

  <h2>Ready?</h2>
  <p>Click "Join Now" at the top of the page to create your account, or email us at <strong>volunteer@eagleswichita.org</strong> with any questions. We look forward to welcoming you to the flock!</p>
</section>
`;

export const seed: ProjectSeed = {
  site_config: {
    site_name: { value: 'The Eagles — Good Samaritans of Wichita', category: 'branding' },
    site_tagline: { value: 'Lifting our community, one neighbor at a time', category: 'branding' },
    site_description: {
      value:
        'The Eagles are a Wichita-based volunteer organization dedicated to serving our neighbors through food drives, mentoring, habitat builds, and community outreach. Founded in 2014, we believe that small acts of kindness create lasting change.',
      category: 'branding',
    },
    logo_url: { value: '/assets/logo.png', category: 'branding' },
    favicon_url: { value: '/assets/logo.png', category: 'branding' },
    theme: {
      value: {
        primary: '#1b365d',
        primary_hover: '#142a4d',
        bg: '#fffdf7',
        surface: '#f5f0e8',
        text: '#1a1a2e',
        text_muted: '#6b7280',
        border: '#d4d0c8',
        font_heading: 'Cormorant Garamond',
        font_body: 'Inter',
        radius: '0.5rem',
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
    feature_ai_moderation: { value: true, category: 'features' },
    feature_ai_translation: { value: true, category: 'features' },
    feature_ai_newsletter: { value: true, category: 'features' },
    feature_ai_insights: { value: true, category: 'features' },
    feature_ai_onboarding: { value: true, category: 'features' },
    feature_ai_event_recaps: { value: true, category: 'features' },
    directory_public: { value: false, category: 'features' },
    signup_mode: { value: 'approved', category: 'features' },
    demo_mode: { value: true, category: 'features' },
  },
  membership_tiers: [
    {
      name: 'Volunteer',
      description: 'Join our volunteer roster and start making a difference',
      benefits: ['Event sign-ups', 'Forum access', 'Announcements'],
      price_label: 'Free',
      position: 1,
      is_default: true,
    },
    {
      name: 'Eagle Member',
      description: 'Annual supporter of Eagles programs and operations',
      benefits: ['Volunteer benefits', 'Member directory', 'Resources library', 'Voting rights', 'Eagles t-shirt'],
      price_label: '$25/year',
      position: 2,
    },
    {
      name: 'Eagle Sponsor',
      description: 'Generous sponsor fueling our biggest initiatives',
      benefits: ['All member benefits', 'Sponsor recognition', 'Gala VIP table', 'Quarterly impact report', 'Tax receipt'],
      price_label: '$100/year',
      position: 3,
    },
    {
      name: 'Board Member',
      description: 'Appointed leadership guiding the Eagles mission',
      benefits: ['Full access', 'Admin tools', 'Board meetings', 'Strategic planning', 'Financial oversight'],
      price_label: 'By appointment',
      position: 4,
    },
  ],
  member_custom_fields: [
    { field_name: 'phone', field_label: 'Phone Number', field_type: 'text', required: false, visible_in_directory: false, position: 1 },
    { field_name: 'neighborhood', field_label: 'Neighborhood', field_type: 'text', required: false, visible_in_directory: true, position: 2 },
    { field_name: 'employer', field_label: 'Employer', field_type: 'text', required: false, visible_in_directory: false, position: 3 },
    {
      field_name: 'skills',
      field_label: 'Skills',
      field_type: 'multi_select',
      options: ['construction', 'cooking', 'driving', 'mentoring', 'fundraising', 'organizing', 'tech'],
      required: false,
      visible_in_directory: true,
      position: 4,
    },
  ],
  pages: [
    { slug: 'about', title: 'About The Eagles', content: ABOUT_HTML, requires_auth: false, show_in_nav: true, nav_position: 1, published: true },
    { slug: 'volunteer', title: 'Volunteer With Us', content: VOLUNTEER_HTML, requires_auth: false, show_in_nav: true, nav_position: 2, published: true },
  ],
  sections: [
    // --- Header chrome (global) ---
    {
      page_slug: '*',
      zone: 'header',
      scope: 'global',
      section_type: 'brand_header',
      config: { name: 'The Eagles — Good Samaritans of Wichita', logo_url: '/assets/logo.png', href: '/' },
      position: 1,
    },
    {
      page_slug: '*',
      zone: 'header',
      scope: 'global',
      section_type: 'nav',
      config: { items: EAGLES_NAV },
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
        heading: 'Lifting Wichita, One Neighbor at a Time',
        subheading:
          'The Eagles are 200+ volunteers dedicated to food drives, habitat builds, youth mentoring, and community outreach across Sedgwick County.',
        cta_text: 'Join The Eagles',
        cta_href: '/join.html',
        bg_image: '/assets/hero.jpg',
      },
      position: 1,
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'features',
      config: {
        columns: 1,
        items: [
          {
            icon: 'heart',
            title: 'Volunteer',
            desc: 'Join food drives, habitat builds, park cleanups, and community meals. Every pair of hands makes a difference.',
          },
          {
            icon: 'trending-up',
            title: 'Community Impact',
            desc: '5,000+ neighbors helped, 15,000+ volunteer hours logged, and 350 holiday food baskets delivered last year alone.',
          },
          {
            icon: 'users',
            title: 'Join Us',
            desc: 'Sign up for free, attend an orientation, and start making an impact this weekend. No experience necessary.',
          },
        ],
      },
      position: 2,
      // column-span-rows: features card stack on the left at 2/3
      // shares a row with the stats badges on the right at 1/3.
      column_span: '2/3',
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'stats',
      config: {
        items: [
          { value: '12', label: 'Years Serving Wichita' },
          { value: '5,000+', label: 'Neighbors Helped' },
          { value: '15,000+', label: 'Volunteer Hours' },
        ],
      },
      position: 3,
      column_span: '1/3',
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'cta',
      config: {
        heading: 'Ready to make a difference?',
        text: 'Join The Eagles today and become part of something bigger. Whether you have an hour or a hundred, there is a place for you.',
        cta_text: 'Get Started',
        cta_href: '/join.html',
      },
      position: 4,
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'announcements_feed',
      config: { heading: 'Announcements', limit: 20 },
      position: 5,
      // column-span-rows: pair the announcements feed with the activity feed
      // sidebar — news on the left at 2/3, recent activity on the right at 1/3.
      column_span: '2/3',
    },
    {
      page_slug: 'index',
      zone: 'main',
      scope: 'page',
      section_type: 'activity_feed',
      config: { heading: 'Recent Activity', limit: 15 },
      position: 6,
      column_span: '1/3',
    },
    // --- Footer chrome (global) ---
    // column-span-rows: address + copyright share a row at half width;
    // attribution sits below at full width.
    {
      page_slug: '*',
      zone: 'footer',
      scope: 'global',
      section_type: 'footer_address',
      config: {
        name: 'The Eagles — Good Samaritans of Wichita',
        address_lines: ['Wichita, Kansas 67202'],
        phone: '316-555-0100',
        email: 'volunteer@eagleswichita.org',
        hours: 'Office: Tue–Sat, 9am–5pm',
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
        org_name: 'The Eagles — Good Samaritans of Wichita',
        admin_contact_label: 'Contact us',
        admin_contact_href: 'mailto:volunteer@eagleswichita.org',
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
  extraSqlFile: 'demo/eagles/seed.sql',
};
