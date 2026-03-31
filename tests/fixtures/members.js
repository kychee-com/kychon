// Test fixtures: member objects

export const adminMember = {
  id: 1,
  user_id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@test.com',
  display_name: 'Admin User',
  avatar_url: null,
  bio: 'Site administrator',
  tier_id: 1,
  role: 'admin',
  status: 'active',
  custom_fields: {},
  joined_at: '2026-01-01T00:00:00Z',
  expires_at: null,
};

export const activeMember = {
  id: 2,
  user_id: '00000000-0000-0000-0000-000000000002',
  email: 'member@test.com',
  display_name: 'Jane Member',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'A regular member',
  tier_id: 1,
  role: 'member',
  status: 'active',
  custom_fields: { company: 'Acme Corp' },
  joined_at: '2026-02-01T00:00:00Z',
  expires_at: '2027-02-01T00:00:00Z',
};

export const pendingMember = {
  id: 3,
  user_id: '00000000-0000-0000-0000-000000000003',
  email: 'pending@test.com',
  display_name: 'Pending Person',
  avatar_url: null,
  bio: null,
  tier_id: 1,
  role: 'member',
  status: 'pending',
  custom_fields: {},
  joined_at: '2026-03-01T00:00:00Z',
  expires_at: null,
};

export const suspendedMember = {
  id: 4,
  user_id: '00000000-0000-0000-0000-000000000004',
  email: 'suspended@test.com',
  display_name: 'Suspended User',
  avatar_url: null,
  bio: null,
  tier_id: 2,
  role: 'member',
  status: 'suspended',
  custom_fields: {},
  joined_at: '2026-01-15T00:00:00Z',
  expires_at: null,
};

export const allMembers = [adminMember, activeMember, pendingMember, suspendedMember];

export const defaultTiers = [
  {
    id: 1,
    name: 'Member',
    description: 'Standard',
    benefits: ['Directory', 'Events'],
    price_label: 'Free',
    position: 1,
    is_default: true,
  },
  {
    id: 2,
    name: 'Premium',
    description: 'Premium access',
    benefits: ['Directory', 'Events', 'Resources', 'Forum'],
    price_label: '$50/year',
    position: 2,
    is_default: false,
  },
];

export const sampleAnnouncements = [
  {
    id: 1,
    title: 'Welcome!',
    body: '<p>Welcome to our community.</p>',
    is_pinned: true,
    author_id: 1,
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Upcoming Event',
    body: '<p>Join us next week.</p>',
    is_pinned: false,
    author_id: 1,
    created_at: '2026-03-15T00:00:00Z',
  },
];

export const sampleActivity = [
  {
    id: 1,
    member_id: 1,
    action: 'signup',
    metadata: { role: 'admin', is_first: true },
    created_at: '2026-01-01T00:00:00Z',
    members: { display_name: 'Admin User' },
  },
  {
    id: 2,
    member_id: 2,
    action: 'signup',
    metadata: {},
    created_at: '2026-02-01T00:00:00Z',
    members: { display_name: 'Jane Member' },
  },
  {
    id: 3,
    member_id: 1,
    action: 'announcement',
    metadata: { title: 'Welcome!' },
    created_at: '2026-03-01T00:00:00Z',
    members: { display_name: 'Admin User' },
  },
];
