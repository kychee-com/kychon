import { describe, expect, it } from 'vitest';

const { EventSchema, EventRSVPSchema } = await import('../../src/schemas/event.ts');
const { MemberSchema, MemberTierSchema } = await import('../../src/schemas/member.ts');
const { SiteConfigRowSchema, NavItemSchema } = await import('../../src/schemas/config.ts');
const { AnnouncementSchema, ResourceSchema, PageSchema, ReactionSchema } = await import('../../src/schemas/content.ts');
const { ForumCategorySchema, ForumTopicSchema } = await import('../../src/schemas/forum.ts');
const { CommitteeSchema, CommitteeMemberSchema } = await import('../../src/schemas/committee.ts');
const { PollSchema, PollOptionSchema, PollVoteSchema } = await import('../../src/schemas/poll.ts');

describe('Zod schemas', () => {
  describe('EventSchema', () => {
    const validEvent = {
      id: 1,
      title: 'Town Hall',
      description: 'Monthly meeting',
      location: 'Room 5',
      starts_at: '2026-04-15T18:00:00Z',
      ends_at: '2026-04-15T19:00:00Z',
      capacity: 50,
      image_url: null,
      is_members_only: false,
      created_by: 1,
      created_at: '2026-04-01T00:00:00Z',
    };

    it('parses valid event', () => {
      expect(EventSchema.parse(validEvent)).toEqual(validEvent);
    });

    it('rejects event missing title', () => {
      const { title, ...noTitle } = validEvent;
      expect(() => EventSchema.parse(noTitle)).toThrow();
    });

    it('accepts nullable fields as null', () => {
      const event = {
        ...validEvent,
        description: null,
        location: null,
        ends_at: null,
        capacity: null,
        image_url: null,
        created_by: null,
      };
      expect(EventSchema.parse(event)).toBeTruthy();
    });
  });

  describe('EventRSVPSchema', () => {
    it('parses valid RSVP', () => {
      const rsvp = { id: 1, event_id: 1, member_id: 2, status: 'going', created_at: '2026-04-01T00:00:00Z' };
      expect(EventRSVPSchema.parse(rsvp)).toEqual(rsvp);
    });
  });

  describe('MemberSchema', () => {
    const validMember = {
      id: 1,
      user_id: 'abc-123',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: null,
      bio: null,
      tier_id: null,
      role: 'member',
      status: 'active',
      custom_fields: {},
      joined_at: '2026-01-01T00:00:00Z',
      expires_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('parses valid member', () => {
      expect(MemberSchema.parse(validMember)).toEqual(validMember);
    });

    it('rejects member missing email', () => {
      const { email, ...noEmail } = validMember;
      expect(() => MemberSchema.parse(noEmail)).toThrow();
    });
  });

  describe('MemberTierSchema', () => {
    it('parses valid tier', () => {
      const tier = {
        id: 1,
        name: 'Gold',
        description: 'Premium',
        benefits: ['Parking'],
        price_label: '$50/yr',
        position: 1,
        is_default: false,
      };
      expect(MemberTierSchema.parse(tier)).toEqual(tier);
    });
  });

  describe('SiteConfigRowSchema', () => {
    it('parses config row', () => {
      expect(SiteConfigRowSchema.parse({ key: 'site_name', value: 'Test', category: 'general' })).toBeTruthy();
    });

    it('accepts any value type', () => {
      expect(SiteConfigRowSchema.parse({ key: 'theme', value: { primary: '#000' }, category: 'theme' })).toBeTruthy();
    });
  });

  describe('NavItemSchema', () => {
    it('parses nav item with optional fields', () => {
      expect(NavItemSchema.parse({ label: 'Home', href: '/' })).toBeTruthy();
      expect(
        NavItemSchema.parse({ label: 'Admin', href: '/admin', admin: true, auth: true, feature: 'feature_admin' }),
      ).toBeTruthy();
    });
  });

  describe('AnnouncementSchema', () => {
    it('parses valid announcement', () => {
      const ann = {
        id: 1,
        title: 'Welcome',
        body: '<p>Hello</p>',
        is_pinned: true,
        author_id: 1,
        created_at: '2026-04-01T00:00:00Z',
      };
      expect(AnnouncementSchema.parse(ann)).toEqual(ann);
    });
  });

  describe('ResourceSchema', () => {
    it('parses valid resource', () => {
      const res = {
        id: 1,
        title: 'Guide',
        description: null,
        category: 'docs',
        file_url: '/files/guide.pdf',
        file_type: 'pdf',
        is_members_only: true,
        uploaded_by: 1,
        created_at: '2026-04-01T00:00:00Z',
      };
      expect(ResourceSchema.parse(res)).toEqual(res);
    });
  });

  describe('ForumCategorySchema', () => {
    it('parses valid category', () => {
      expect(
        ForumCategorySchema.parse({
          id: 1,
          name: 'General',
          description: 'Talk about anything',
          position: 1,
          color: '#6366f1',
        }),
      ).toBeTruthy();
    });
  });

  describe('ForumTopicSchema', () => {
    it('parses valid topic', () => {
      const topic = {
        id: 1,
        category_id: 1,
        title: 'Hello',
        body: 'World',
        author_id: 1,
        author_name: 'Test',
        is_pinned: false,
        reply_count: 0,
        last_reply_at: null,
        created_at: '2026-04-01T00:00:00Z',
      };
      expect(ForumTopicSchema.parse(topic)).toEqual(topic);
    });

    it('accepts optional hidden/locked', () => {
      const topic = {
        id: 1,
        category_id: 1,
        title: 'Hello',
        body: 'World',
        author_id: 1,
        author_name: null,
        is_pinned: false,
        reply_count: 5,
        last_reply_at: null,
        hidden: true,
        locked: true,
        created_at: '2026-04-01T00:00:00Z',
      };
      expect(ForumTopicSchema.parse(topic)).toBeTruthy();
    });
  });

  describe('PageSchema', () => {
    it('parses valid page', () => {
      const page = {
        id: 1,
        slug: 'about',
        title: 'About Us',
        content: '<p>We are great</p>',
        requires_auth: false,
        show_in_nav: true,
        nav_position: 5,
        published: true,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      };
      expect(PageSchema.parse(page)).toEqual(page);
    });
  });

  describe('CommitteeSchema', () => {
    it('parses valid committee', () => {
      expect(
        CommitteeSchema.parse({
          id: 1,
          name: 'Finance',
          description: 'Handles budget',
          created_at: '2026-04-01T00:00:00Z',
        }),
      ).toBeTruthy();
    });
  });

  describe('CommitteeMemberSchema', () => {
    it('parses valid committee member', () => {
      expect(
        CommitteeMemberSchema.parse({
          id: 1,
          committee_id: 1,
          member_id: 2,
          role: 'chair',
          joined_at: '2026-04-01T00:00:00Z',
        }),
      ).toBeTruthy();
    });
  });

  describe('ReactionSchema', () => {
    it('parses valid reaction', () => {
      expect(
        ReactionSchema.parse({
          id: 1,
          content_type: 'announcement',
          content_id: 1,
          member_id: 2,
          emoji: 'like',
          created_at: '2026-04-01T00:00:00Z',
        }),
      ).toBeTruthy();
    });
  });

  describe('PollSchema', () => {
    const validPoll = {
      id: 1,
      question: 'What should our next event be?',
      description: 'Vote for your preference',
      poll_type: 'single',
      is_anonymous: false,
      results_visible: 'after_vote',
      is_open: true,
      closes_at: null,
      attached_to: null,
      attached_id: null,
      created_by: 1,
      created_at: '2026-04-01T00:00:00Z',
    };

    it('parses valid poll', () => {
      expect(PollSchema.parse(validPoll)).toEqual(validPoll);
    });

    it('rejects poll missing question', () => {
      const { question, ...noQuestion } = validPoll;
      expect(() => PollSchema.parse(noQuestion)).toThrow();
    });

    it('accepts nullable fields as null', () => {
      const poll = {
        ...validPoll,
        description: null,
        closes_at: null,
        attached_to: null,
        attached_id: null,
        created_by: null,
      };
      expect(PollSchema.parse(poll)).toBeTruthy();
    });

    it('parses attached poll', () => {
      const poll = { ...validPoll, attached_to: 'announcement', attached_id: 5 };
      expect(PollSchema.parse(poll)).toEqual(poll);
    });
  });

  describe('PollOptionSchema', () => {
    it('parses valid option', () => {
      const option = { id: 1, poll_id: 1, label: 'Workshop', position: 0 };
      expect(PollOptionSchema.parse(option)).toEqual(option);
    });

    it('rejects option missing label', () => {
      expect(() => PollOptionSchema.parse({ id: 1, poll_id: 1, position: 0 })).toThrow();
    });
  });

  describe('PollVoteSchema', () => {
    it('parses valid vote', () => {
      const vote = { id: 1, poll_id: 1, option_id: 2, member_id: 3, created_at: '2026-04-01T00:00:00Z' };
      expect(PollVoteSchema.parse(vote)).toEqual(vote);
    });

    it('accepts nullable member_id', () => {
      const vote = { id: 1, poll_id: 1, option_id: 2, member_id: null, created_at: '2026-04-01T00:00:00Z' };
      expect(PollVoteSchema.parse(vote)).toBeTruthy();
    });
  });
});
