# UI CSS Collision Report

Generated: 2026-05-08T12:13:23.409Z

This report tracks legacy unprefixed classes that collide with Tailwind utilities or shadcn/Kychon component names. New UI code should not add fresh usages of these classes unless it is explicitly part of the compatibility layer.

| Class | Definitions | Usages | Decision |
|---|---:|---:|---|
| `.hidden` | 0 | 18 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.flex` | 0 | 49 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.flex-col` | 0 | 1 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.gap-1` | 0 | 27 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.mt-1` | 0 | 14 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.mt-2` | 0 | 20 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.mb-1` | 0 | 36 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.mb-2` | 0 | 30 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.items-center` | 0 | 29 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.justify-between` | 0 | 12 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.text-sm` | 0 | 33 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.text-center` | 0 | 6 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.text-muted` | 0 | 0 | Retired as a Kychon helper; use `.ky-text-muted` for public/static markup or Tailwind/shadcn semantic text utilities in React code. |
| `.container` | 0 | 0 | Retired as a Kychon layout class; use `.ky-container` for Kychon chrome/block layout and reserve `.container` for Tailwind if needed. |
| `.btn` | 6 | 98 | Owned public component class retained temporarily while call sites move to Kychon UI components. |
| `.card` | 3 | 39 | Owned public component class retained temporarily while call sites move to Kychon UI components. |
| `.badge` | 1 | 23 | Owned public component class retained temporarily while call sites move to Kychon UI components. |
| `.toast` | 2 | 0 | Owned public component class retained temporarily while call sites move to Kychon UI components. |
| `.form-input` | 2 | 41 | Owned public component class retained temporarily while call sites move to Kychon UI components. |
| `.form-select` | 2 | 12 | Owned public component class retained temporarily while call sites move to Kychon UI components. |
| `.form-textarea` | 3 | 9 | Owned public component class retained temporarily while call sites move to Kychon UI components. |

## Hit Details

### .hidden

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/DemoBanner.astro:5` <div id="demo-banner" class="demo-banner hidden" role="banner" aria-label="Demo mode" transition:persist>
- `src/components/DemoBanner.astro:14` <button class="demo-btn demo-btn-browse hidden" id="demo-browse">Just Browse</button>
- `src/components/DemoBanner.astro:21` <div class="demo-reset-overlay hidden" id="demo-reset-overlay">
- `src/lib/blocks.ts:864` `<div class="ky-container" data-block-hydrate="announcements_feed"><div class="block-content"><div id="announcement-create" class="hidden mb-2"></div>${heading}<div id="announcements-feed"><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></div><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div></div></div></div></div>`,
- `src/pages/admin.astro:10` <section class="card admin-checklist hidden mb-2" id="fresh-start-checklist" aria-labelledby="fresh-start-checklist-title">
- `src/pages/admin.astro:51` <div class="card mb-2 hidden" id="moderation-section">
- `src/pages/committees.astro:8` <button class="btn btn-primary hidden" id="committee-create-btn">Create Committee</button>
- `src/pages/committees.astro:13` <div class="auth-modal hidden" id="cm-form-modal">
- `src/pages/directory.astro:17` <div class="auth-modal hidden" id="member-modal">
- `src/pages/events.astro:10` <button class="btn btn-primary hidden" id="event-create-btn">Create Event</button>
- `src/pages/events.astro:19` <div class="auth-modal hidden" id="event-form-modal">
- `src/pages/join.astro:8` <div id="join-error" class="text-sm hidden" style="color:var(--color-danger);margin-bottom:1rem"></div>
- `src/pages/polls.astro:7` <div id="poll-create" class="hidden mb-2"></div>
- `src/pages/polls.astro:108` container.innerHTML = '<button class="btn btn-primary" id="poll-create-toggle">Create Poll</button><div id="poll-form-container" class="hidden"></div>';
- `src/pages/profile.astro:11` <input type="file" id="profile-avatar-upload" accept="image/*" class="hidden">
- `src/pages/resources.astro:8` <button class="btn btn-primary hidden" id="res-upload-btn">Upload Resource</button>
- `src/pages/resources.astro:19` <div class="auth-modal hidden" id="res-form-modal">
- `src/pages/resources.astro:36` <div class="form-group hidden" id="rf-url-group"><label class="form-label">URL</label><input class="form-input" id="rf-url" type="url" placeholder="https://..."></div>

### .flex

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/AuthModalIsland.tsx:150` <div className="flex items-center gap-3 text-xs text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:207` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:216` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:261` <div className="flex flex-wrap gap-2">
- `src/components/kychon/AdminSettingsApp.tsx:282` <label className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50">
- `src/components/kychon/AdminSettingsApp.tsx:637` <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
- `src/components/kychon/AdminSettingsApp.tsx:750` <label key={key} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
- `src/components/kychon/AdminSettingsApp.tsx:912` <div key={tier.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
- `src/components/kychon/AdminSettingsApp.tsx:914` <div className="flex flex-wrap items-center gap-2">
- `src/components/kychon/AdminSettingsApp.tsx:950` <div key={field.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
- `src/components/kychon/AdminSettingsApp.tsx:952` <div className="flex flex-wrap items-center gap-2">
- `src/components/kychon/AdminSettingsApp.tsx:1029` <div key={`${index}-${benefit}`} className="flex items-center gap-2">
- `src/lib/block-hydrators.ts:88` ${ctx.role === 'admin' ? `<div class="mt-1 flex gap-1"><button class="btn btn-sm btn-secondary ann-pin" data-id="${a.id}" data-pinned="${a.is_pinned}">${a.is_pinned ? 'Unpin' : 'Pin'}</button><button class="btn btn-sm btn-danger ann-delete" data-id="${a.id}">Delete</button></div>` : ''}
- `src/lib/poll-ui.ts:247` <div class="flex justify-between items-center mb-1">
- `src/lib/poll-ui.ts:258` <div class="poll-form-option-row flex gap-1 mb-half">
- `src/lib/poll-ui.ts:262` <div class="poll-form-option-row flex gap-1 mb-half">
- `src/lib/poll-ui.ts:270` <div class="flex gap-2 flex-wrap">
- `src/lib/poll-ui.ts:302` row.className = 'poll-form-option-row flex gap-1 mb-half';
- `src/pages/admin-members.astro:8` <div class="flex justify-between items-center mb-2">
- `src/pages/admin-members.astro:13` <div class="flex gap-1 mb-2" style="flex-wrap:wrap">
- `src/pages/admin-members.astro:104` <div class="flex items-center gap-1">
- `src/pages/admin-members.astro:121` <div class="flex gap-1" style="flex-wrap:wrap">
- `src/pages/admin.astro:58` <div class="flex gap-1" style="flex-wrap:wrap">
- `src/pages/admin.astro:231` <div class="flex items-center gap-1" style="padding:0.75rem 0;border-bottom:1px solid var(--color-border)">
- `src/pages/admin.astro:237` <div class="flex gap-1">
- `src/pages/admin.astro:319` <div class="flex items-center gap-1" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border)">
- `src/pages/committees.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/committees.astro:19` <div class="flex gap-1">
- `src/pages/committees.astro:129` <div class="flex gap-1">
- `src/pages/directory.astro:7` <div class="flex gap-1 mb-2" style="flex-wrap:wrap">
- ... 19 more usages

### .flex-col

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminSettingsApp.tsx:637` <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

### .gap-1

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/lib/block-hydrators.ts:88` ${ctx.role === 'admin' ? `<div class="mt-1 flex gap-1"><button class="btn btn-sm btn-secondary ann-pin" data-id="${a.id}" data-pinned="${a.is_pinned}">${a.is_pinned ? 'Unpin' : 'Pin'}</button><button class="btn btn-sm btn-danger ann-delete" data-id="${a.id}">Delete</button></div>` : ''}
- `src/lib/poll-ui.ts:258` <div class="poll-form-option-row flex gap-1 mb-half">
- `src/lib/poll-ui.ts:262` <div class="poll-form-option-row flex gap-1 mb-half">
- `src/lib/poll-ui.ts:302` row.className = 'poll-form-option-row flex gap-1 mb-half';
- `src/pages/admin-members.astro:13` <div class="flex gap-1 mb-2" style="flex-wrap:wrap">
- `src/pages/admin-members.astro:104` <div class="flex items-center gap-1">
- `src/pages/admin-members.astro:121` <div class="flex gap-1" style="flex-wrap:wrap">
- `src/pages/admin.astro:58` <div class="flex gap-1" style="flex-wrap:wrap">
- `src/pages/admin.astro:231` <div class="flex items-center gap-1" style="padding:0.75rem 0;border-bottom:1px solid var(--color-border)">
- `src/pages/admin.astro:237` <div class="flex gap-1">
- `src/pages/admin.astro:319` <div class="flex items-center gap-1" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border)">
- `src/pages/committees.astro:19` <div class="flex gap-1">
- `src/pages/committees.astro:129` <div class="flex gap-1">
- `src/pages/directory.astro:7` <div class="flex gap-1 mb-2" style="flex-wrap:wrap">
- `src/pages/event.astro:123` <div class="flex gap-1 mt-2" id="rsvp-buttons">
- `src/pages/event.astro:164` <div class="mt-2 flex gap-1">
- `src/pages/event.astro:276` <div class="flex gap-1">
- `src/pages/event.astro:277` <label class="flex items-center gap-1"><input type="checkbox" data-reg-field="reviewed" ${option.review_state === 'reviewed' ? 'checked' : ''}> Reviewed</label>
- `src/pages/event.astro:278` <label class="flex items-center gap-1"><input type="checkbox" data-reg-field="is_disabled" ${option.is_disabled ? 'checked' : ''}> Hidden/disabled</label>
- `src/pages/events.astro:8` <div class="flex gap-1 items-center">
- `src/pages/events.astro:31` <label class="flex items-center gap-1 mb-2"><input type="checkbox" id="ef-members-only"> Members only</label>
- `src/pages/events.astro:32` <div class="flex gap-1">
- `src/pages/polls.astro:56` html += `<div class="mt-1 flex gap-1">`;
- `src/pages/resources.astro:37` <label class="flex items-center gap-1 mb-2"><input type="checkbox" id="rf-members-only" checked> Members only</label>
- `src/pages/resources.astro:38` <div class="flex gap-1">
- `src/pages/resources.astro:164` <div class="flex items-center gap-1 mb-1">
- `src/pages/resources.astro:172` <div class="flex gap-1 mt-1">

### .mt-1

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/AdminEditor.astro:719` <button class="btn btn-secondary btn-sm mt-1" id="nav-editor-add">+ Add item</button>
- `src/components/kychon/AdminSettingsApp.tsx:918` <p className="mt-1 text-sm text-muted-foreground">
- `src/components/kychon/AdminSettingsApp.tsx:958` <p className="mt-1 text-sm text-muted-foreground">{field.field_name}</p>
- `src/lib/block-hydrators.ts:88` ${ctx.role === 'admin' ? `<div class="mt-1 flex gap-1"><button class="btn btn-sm btn-secondary ann-pin" data-id="${a.id}" data-pinned="${a.is_pinned}">${a.is_pinned ? 'Unpin' : 'Pin'}</button><button class="btn btn-sm btn-danger ann-delete" data-id="${a.id}">Delete</button></div>` : ''}
- `src/lib/blocks.ts:661` `<div class="ky-container"><h2${editableAttr(section, 'heading', ctx)}>${escHtml(cfg.heading)}</h2><p class="ky-text-muted mt-1"${editableAttr(section, 'text', ctx)}>${escHtml(cfg.text)}</p>${cta}</div>`,
- `src/lib/blocks.ts:734` `<details class="card mb-1" style="cursor:pointer"><summary style="font-weight:600"${editableAttr(section, `items.${i}.q`, ctx)}>${escHtml(f.q)}</summary><p class="ky-text-muted mt-1"${editableAttr(section, `items.${i}.a`, ctx)}>${escHtml(f.a)}</p></details>`,
- `src/lib/poll-ui.ts:269` <div class="poll-form-settings mt-1">
- `src/lib/poll-ui.ts:290` <div class="form-group mt-1">
- `src/pages/directory.astro:21` <h3 id="mm-name" class="mt-1"></h3>
- `src/pages/directory.astro:26` <div id="mm-custom-fields" class="mt-1"></div>
- `src/pages/event.astro:129` : '<p class="text-sm ky-text-muted mt-1">Sign in to RSVP</p>'
- `src/pages/polls.astro:56` html += `<div class="mt-1 flex gap-1">`;
- `src/pages/polls.astro:121` submitBtn.className = 'btn btn-primary mt-1';
- `src/pages/resources.astro:172` <div class="flex gap-1 mt-1">

### .mt-2

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/AdminEditor.astro:1858` <label class="admin-section-edit-label mt-2">Scope</label>
- `src/components/AdminEditor.astro:1862` <div class="mt-2">
- `src/lib/blocks.ts:656` ? `<a href="${escAttr(cfg.cta_href || '#')}" class="btn btn-primary btn-lg mt-2"${editableAttr(section, 'cta_text', ctx)}>${escHtml(cfg.cta_text)}</a>`
- `src/lib/event-registration.ts:148` <section class="card event-registration mt-2">
- `src/pages/committees.astro:101` <div class="mt-2">
- `src/pages/committees.astro:127` <div class="card mt-2">
- `src/pages/committees.astro:141` <div class="mt-2">
- `src/pages/directory.astro:27` <button class="btn btn-secondary mt-2" style="width:100%" id="member-modal-close">Close</button>
- `src/pages/event.astro:108` <div class="mt-2">${event.description || ''}</div>
- `src/pages/event.astro:112` <div class="card mt-2">
- `src/pages/event.astro:123` <div class="flex gap-1 mt-2" id="rsvp-buttons">
- `src/pages/event.astro:136` <div class="mt-2">
- `src/pages/event.astro:164` <div class="mt-2 flex gap-1">
- `src/pages/event.astro:167` <section class="card mt-2" id="event-timezone-admin">
- `src/pages/event.astro:192` <section class="card mt-2" id="event-registration-admin">
- `src/pages/forum.astro:533` html += '<p class="ky-text-muted mt-2">No replies yet.</p>';
- `src/pages/join.astro:29` <p class="text-sm ky-text-muted mt-2 text-center">
- `src/pages/page.astro:7` <div id="page-content" class="mt-2"></div>
- `src/pages/page.astro:9` <div id="sections" class="mt-2" data-sortable-group="page-sections" data-zone="main"></div>
- `src/seeds/silver-pines.ts:33` const DAILY_SCHEDULE_HTML = `<div style="max-width:60rem"><p style="font-size:1.25rem;color:var(--color-text-muted);margin-bottom:2rem">Drop in anytime! All classes and activities are free for members unless noted.</p><div class="table-wrap"><table><thead><tr><th>Time</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th></tr></thead><tbody><tr><td><strong>9:00-10:00</strong></td><td>Chair Yoga</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Tai Chi (George)</td><td>Chair Yoga</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Tai Chi (George)</td><td>Gentle Stretch</td></tr><tr><td><strong>10:00-12:00</strong></td><td>Open Craft Room</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Tech Help Desk</td><td>Open Craft Room</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Tech Help Desk</td><td>Open Craft Room</td></tr><tr><td><strong>11:30-12:30</strong></td><td>Lunch ($3)</td><td>—</td><td>Lunch ($3)</td><td>—</td><td>Lunch ($3)</td></tr><tr><td><strong>1:00-2:00</strong></td><td>Bridge &amp; Cards</td><td>Piano Basics (Mary)</td><td>Bridge &amp; Cards</td><td>Cooking Class (Nancy)</td><td>Bridge &amp; Cards</td></tr><tr><td><strong>2:00-4:00</strong></td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Garden Hours</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Garden Hours</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Watercolor (Margaret)</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Garden Hours</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Garden Hours</td></tr><tr><td><strong>3:00-4:30</strong></td><td>—</td><td>—</td><td>—</td><td>Book Club (Evelyn)</td><td>—</td></tr><tr style="border-top:2px solid var(--color-border)"><td><strong>6:30 PM</strong></td><td>—</td><td>—</td><td>—</td><td>—</td><td style="background:color-mix(in srgb, var(--color-primary) 8%, transparent)">Movie Night (2nd &amp; 4th Fri)</td></tr></tbody></table></div><div class="card mt-2" style="padding:1.5rem;border-left:4px solid var(--color-primary)"><p style="margin:0"><strong>Center hours:</strong> Mon-Fri 8am-5pm (6:30pm on Movie Fridays) &bull; <strong>Meal program:</strong> Mon/Wed/Fri 11:30am-12:30pm, $3 suggested donation &bull; <strong>Questions?</strong> Call 828-555-0100</p></div></div>`;

### .mb-1

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminSettingsApp.tsx:988` <h4 className="mb-1 font-medium text-foreground">AI Activity</h4>
- `src/lib/block-hydrators.ts:140` createEl.innerHTML = `<div class="card"><h4 class="mb-1">New Announcement</h4><div class="form-group"><input class="form-input" id="ann-title" placeholder="Title"></div><div class="form-group"><textarea class="form-textarea" id="ann-body" placeholder="Write your announcement..."></textarea></div>${pollsEnabled ? '<div id="ann-poll-form-container"></div><button class="btn btn-sm btn-secondary mb-1" id="ann-add-poll" type="button">+ Add Poll</button>' : ''}<button class="btn btn-primary" id="ann-post">Post</button></div>`;
- `src/lib/blocks.ts:734` `<details class="card mb-1" style="cursor:pointer"><summary style="font-weight:600"${editableAttr(section, `items.${i}.q`, ctx)}>${escHtml(f.q)}</summary><p class="ky-text-muted mt-1"${editableAttr(section, `items.${i}.a`, ctx)}>${escHtml(f.a)}</p></details>`,
- `src/lib/blocks.ts:754` `<div class="ky-container" data-block-hydrate="polls">${heading}<div class="polls-skeleton"><div class="skeleton skeleton-card mb-1"></div></div></div>`,
- `src/lib/blocks.ts:779` wrap.className = 'card mb-1';
- `src/lib/blocks.ts:864` `<div class="ky-container" data-block-hydrate="announcements_feed"><div class="block-content"><div id="announcement-create" class="hidden mb-2"></div>${heading}<div id="announcements-feed"><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></div><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div></div></div></div></div>`,
- `src/lib/event-registration.ts:149` <h3 class="mb-1">${escHtml(heading)}</h3>
- `src/lib/poll-ui.ts:247` <div class="flex justify-between items-center mb-1">
- `src/pages/admin.astro:52` <h3 class="mb-1">Moderation Queue</h3>
- `src/pages/admin.astro:57` <h3 class="mb-1">Quick Actions</h3>
- `src/pages/admin.astro:66` <h3 class="mb-1">Recent Activity</h3>
- `src/pages/committees.astro:15` <h3 class="mb-1">Create Committee</h3>
- `src/pages/committees.astro:97` <p class="mb-1"><a href="/committees.html">&larr; All Committees</a></p>
- `src/pages/committees.astro:102` <h3 class="mb-1">Members (${members.length})</h3>
- `src/pages/committees.astro:107` <div class="member-card card mb-1">
- `src/pages/committees.astro:128` <h4 class="mb-1">Add Member</h4>
- `src/pages/event.astro:106` ${event.is_members_only ? '<span class="badge badge-primary mb-1">Members Only</span>' : ''}
- `src/pages/event.astro:113` <div class="flex justify-between items-center mb-1">
- `src/pages/event.astro:117` ${visibleOptions.length ? `<p class="text-sm ky-text-muted mb-1">Source registration options are listed above. Use RSVP here only for Kychon attendance tracking.</p>` : ''}
- `src/pages/event.astro:137` <h3 class="mb-1">Attendees</h3>
- `src/pages/event.astro:168` <h3 class="mb-1">Event Timezone</h3>
- `src/pages/event.astro:193` <div class="flex justify-between items-center mb-1">
- `src/pages/event.astro:249` return '<p class="text-sm ky-text-muted mb-1">No structured registration options yet.</p>';
- `src/pages/event.astro:254` <fieldset class="mb-1" data-registration-editor="${option.id}" style="padding:1rem;border:1px solid var(--color-border);border-radius:var(--radius)">
- `src/pages/events.astro:21` <h3 class="mb-1">Create Event</h3>
- `src/pages/events.astro:81` html += '<h3 class="mb-1">Upcoming</h3><div class="card-grid mb-2">';
- `src/pages/events.astro:86` html += '<h3 class="mb-1 ky-text-muted">Past Events</h3><div class="card-grid">';
- `src/pages/forum.astro:347` <h3 class="mb-1">New Topic</h3>
- `src/pages/forum.astro:357` ${pollsEnabled && canCreatePoll ? '<div id="nt-poll-form-container"></div><button class="btn btn-sm btn-secondary mb-1" id="nt-add-poll" type="button">+ Add Poll</button>' : ''}
- `src/pages/forum.astro:542` <h3 class="mb-1">Reply</h3>
- ... 6 more usages

### .mb-2

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/lib/blocks.ts:737` return adminWrap(section, ctx, `<div class="ky-container"><h2 class="mb-2">FAQ</h2>${items}</div>`);
- `src/lib/blocks.ts:750` const heading = cfg.heading ? `<h2 class="mb-2">${escHtml(cfg.heading)}</h2>` : '';
- `src/lib/blocks.ts:806` const heading = cfg.heading ? `<h2 class="mb-2">${escHtml(cfg.heading)}</h2>` : '';
- `src/lib/blocks.ts:864` `<div class="ky-container" data-block-hydrate="announcements_feed"><div class="block-content"><div id="announcement-create" class="hidden mb-2"></div>${heading}<div id="announcements-feed"><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></div><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div></div></div></div></div>`,
- `src/pages/admin-members.astro:8` <div class="flex justify-between items-center mb-2">
- `src/pages/admin-members.astro:13` <div class="flex gap-1 mb-2" style="flex-wrap:wrap">
- `src/pages/admin.astro:8` <h2 class="mb-2">Dashboard</h2>
- `src/pages/admin.astro:10` <section class="card admin-checklist hidden mb-2" id="fresh-start-checklist" aria-labelledby="fresh-start-checklist-title">
- `src/pages/admin.astro:30` <div class="stats-grid mb-2">
- `src/pages/admin.astro:49` <div class="stats-grid mb-2" id="extra-stats"></div>
- `src/pages/admin.astro:51` <div class="card mb-2 hidden" id="moderation-section">
- `src/pages/admin.astro:56` <div class="card mb-2">
- `src/pages/committees.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/directory.astro:6` <h2 class="mb-2">Member Directory</h2>
- `src/pages/directory.astro:7` <div class="flex gap-1 mb-2" style="flex-wrap:wrap">
- `src/pages/directory.astro:19` <div class="text-center mb-2">
- `src/pages/event.astro:6` <p class="mb-2"><a href="/events.html">&larr; All Events</a></p>
- `src/pages/events.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/events.astro:31` <label class="flex items-center gap-1 mb-2"><input type="checkbox" id="ef-members-only"> Members only</label>
- `src/pages/events.astro:81` html += '<h3 class="mb-1">Upcoming</h3><div class="card-grid mb-2">';
- `src/pages/forum.astro:255` let html = '<h2 class="mb-2">Forum</h2>';
- `src/pages/forum.astro:308` <div class="flex justify-between items-center mb-2">
- `src/pages/polls.astro:6` <h2 class="mb-2">Polls</h2>
- `src/pages/polls.astro:7` <div id="poll-create" class="hidden mb-2"></div>
- `src/pages/profile.astro:6` <h2 class="mb-2">Your Profile</h2>
- `src/pages/profile.astro:8` <div class="text-center mb-2">
- `src/pages/resources.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/resources.astro:10` <div class="mb-2">
- `src/pages/resources.astro:37` <label class="flex items-center gap-1 mb-2"><input type="checkbox" id="rf-members-only" checked> Members only</label>
- `src/seeds/silver-pines.ts:31` const GETTING_HERE_HTML = `<div style="max-width:52rem"><p style="font-size:1.25rem;color:var(--color-text-muted);margin-bottom:2rem">142 Pine Street, Asheville, NC 28801 &bull; Open Mon-Fri 8am-5pm &bull; <strong>828-555-0100</strong></p><div class="mb-2" style="border-radius:var(--radius,8px);overflow:hidden"><iframe src="https://maps.google.com/maps?q=142+Pine+Street,+Asheville,+NC+28801&t=&z=15&ie=UTF8&iwloc=&output=embed" width="100%" height="300" style="border:0;display:block" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div><div class="card mb-2" style="padding:2rem"><h3 style="margin-bottom:1rem">By Car</h3><p>From <strong>I-240</strong>, take Exit 5A (Merrimon Ave). Go south 0.5 miles, turn right on Pine Street. The center is on the left.</p><p><strong>Parking:</strong> Free lot behind the building (enter from Pine Street). 4 accessible parking spaces by the front entrance.</p></div><div class="card mb-2" style="padding:2rem"><h3 style="margin-bottom:1rem">Silver Pines Shuttle</h3><p>Our <strong>free shuttle</strong> runs Monday-Friday with 3 routes covering North Asheville, West Asheville, and South Asheville.</p><ul style="margin:1rem 0 1rem 1.5rem"><li><strong>Route A (North):</strong> Montford, Merrimon Ave, North Asheville — Departs 8:15am, 10:15am, 1:15pm</li><li><strong>Route B (West):</strong> West Asheville, Candler, Leicester — Departs 8:30am, 10:30am, 1:30pm</li><li><strong>Route C (South):</strong> Biltmore, South Asheville, Arden — Departs 8:00am, 10:00am, 1:00pm</li></ul><p>Return trips depart the center at 12:00pm, 3:00pm, and 5:00pm. Call Frank at <strong>828-555-0106</strong> to arrange a ride or <a href='/resources.html'>download the full schedule</a>.</p></div><div class="card mb-2" style="padding:2rem"><h3 style="margin-bottom:1rem">Volunteer Driver Program</h3><p>Need a ride to a <strong>medical appointment</strong>? Our volunteer drivers are happy to help. Call the center at <strong>828-555-0100</strong> at least 24 hours in advance. Rides available within 15 miles of Asheville.</p></div><div class="card mb-2" style="padding:2rem"><h3 style="margin-bottom:1rem">Public Transit</h3><p><strong>ART Bus Route 170</strong> stops at Pine &amp; Merrimon (2 minute walk). Route runs every 30 minutes weekdays.</p></div><div class="card mb-2" style="padding:2rem;border-left:4px solid var(--color-primary)"><h3 style="margin-bottom:1rem">Accessibility</h3><p>Silver Pines is <strong>fully wheelchair accessible</strong>. We have:</p><ul style="margin:1rem 0 0 1.5rem"><li>Ramp at the main entrance</li><li>Wide doorways throughout</li><li>Accessible restrooms on both floors</li><li>Elevator to the second floor</li><li>Hearing loop in the Main Hall</li><li>Large-print materials available</li><li>Service animals welcome</li></ul></div></div>`;

### .items-center

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/AuthModalIsland.tsx:150` <div className="flex items-center gap-3 text-xs text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:207` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:216` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminSettingsApp.tsx:282` <label className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50">
- `src/components/kychon/AdminSettingsApp.tsx:750` <label key={key} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
- `src/components/kychon/AdminSettingsApp.tsx:898` <CardHeader className="flex-row items-center justify-between gap-3">
- `src/components/kychon/AdminSettingsApp.tsx:912` <div key={tier.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
- `src/components/kychon/AdminSettingsApp.tsx:914` <div className="flex flex-wrap items-center gap-2">
- `src/components/kychon/AdminSettingsApp.tsx:936` <CardHeader className="flex-row items-center justify-between gap-3">
- `src/components/kychon/AdminSettingsApp.tsx:950` <div key={field.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
- `src/components/kychon/AdminSettingsApp.tsx:952` <div className="flex flex-wrap items-center gap-2">
- `src/components/kychon/AdminSettingsApp.tsx:1029` <div key={`${index}-${benefit}`} className="flex items-center gap-2">
- `src/lib/poll-ui.ts:247` <div class="flex justify-between items-center mb-1">
- `src/pages/admin-members.astro:8` <div class="flex justify-between items-center mb-2">
- `src/pages/admin-members.astro:104` <div class="flex items-center gap-1">
- `src/pages/admin.astro:231` <div class="flex items-center gap-1" style="padding:0.75rem 0;border-bottom:1px solid var(--color-border)">
- `src/pages/admin.astro:319` <div class="flex items-center gap-1" style="padding:0.5rem 0;border-bottom:1px solid var(--color-border)">
- `src/pages/committees.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/event.astro:113` <div class="flex justify-between items-center mb-1">
- `src/pages/event.astro:193` <div class="flex justify-between items-center mb-1">
- `src/pages/event.astro:277` <label class="flex items-center gap-1"><input type="checkbox" data-reg-field="reviewed" ${option.review_state === 'reviewed' ? 'checked' : ''}> Reviewed</label>
- `src/pages/event.astro:278` <label class="flex items-center gap-1"><input type="checkbox" data-reg-field="is_disabled" ${option.is_disabled ? 'checked' : ''}> Hidden/disabled</label>
- `src/pages/events.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/events.astro:8` <div class="flex gap-1 items-center">
- `src/pages/events.astro:31` <label class="flex items-center gap-1 mb-2"><input type="checkbox" id="ef-members-only"> Members only</label>
- `src/pages/forum.astro:308` <div class="flex justify-between items-center mb-2">
- `src/pages/resources.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/resources.astro:37` <label class="flex items-center gap-1 mb-2"><input type="checkbox" id="rf-members-only" checked> Members only</label>
- `src/pages/resources.astro:164` <div class="flex items-center gap-1 mb-1">

### .justify-between

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminSettingsApp.tsx:898` <CardHeader className="flex-row items-center justify-between gap-3">
- `src/components/kychon/AdminSettingsApp.tsx:912` <div key={tier.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
- `src/components/kychon/AdminSettingsApp.tsx:936` <CardHeader className="flex-row items-center justify-between gap-3">
- `src/components/kychon/AdminSettingsApp.tsx:950` <div key={field.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
- `src/lib/poll-ui.ts:247` <div class="flex justify-between items-center mb-1">
- `src/pages/admin-members.astro:8` <div class="flex justify-between items-center mb-2">
- `src/pages/committees.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/event.astro:113` <div class="flex justify-between items-center mb-1">
- `src/pages/event.astro:193` <div class="flex justify-between items-center mb-1">
- `src/pages/events.astro:6` <div class="flex justify-between items-center mb-2">
- `src/pages/forum.astro:308` <div class="flex justify-between items-center mb-2">
- `src/pages/resources.astro:6` <div class="flex justify-between items-center mb-2">

### .text-sm

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/AdminEditor.astro:1087` <p class="ky-text-muted text-sm">The image is rendered as a CSS <code>background-image: cover</code> at fixed height. Use this for mood/decoration. Switch to Foreground for banners that must show their full content.</p>
- `src/components/kychon/AdminEditorControlsIsland.tsx:216` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:231` <div className="text-sm font-medium">Width</div>
- `src/components/kychon/AdminEditorControlsIsland.tsx:253` <div className="text-sm font-medium">Scope</div>
- `src/components/kychon/AdminSettingsApp.tsx:282` <label className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50">
- `src/components/kychon/AdminSettingsApp.tsx:750` <label key={key} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
- `src/components/kychon/AdminSettingsApp.tsx:892` <p className="text-sm text-muted-foreground">No feature flags yet.</p>
- `src/components/kychon/AdminSettingsApp.tsx:918` <p className="mt-1 text-sm text-muted-foreground">
- `src/components/kychon/AdminSettingsApp.tsx:930` <p className="text-sm text-muted-foreground">No membership tiers yet.</p>
- `src/components/kychon/AdminSettingsApp.tsx:958` <p className="mt-1 text-sm text-muted-foreground">{field.field_name}</p>
- `src/components/kychon/AdminSettingsApp.tsx:967` <p className="text-sm text-muted-foreground">No custom fields yet.</p>
- `src/components/kychon/AdminSettingsApp.tsx:987` <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
- `src/lib/event-registration.ts:140` ${option.description ? `<p class="text-sm">${escHtml(option.description)}</p>` : ''}
- `src/lib/event-registration.ts:141` ${option.guest_policy ? `<p class="text-sm ky-text-muted">${escHtml(option.guest_policy)}</p>` : ''}
- `src/lib/event-registration.ts:142` ${option.cancellation_note ? `<p class="text-sm ky-text-muted">${escHtml(option.cancellation_note)}</p>` : ''}
- `src/pages/admin-members.astro:112` <div class="text-sm ky-text-muted">${esc(m.email)}</div>
- `src/pages/admin-members.astro:119` <td class="text-sm ky-text-muted">${formatDate(m.joined_at)}</td>
- `src/pages/admin.astro:234` <span class="text-sm">${esc(i.preview)}</span>
- `src/pages/admin.astro:235` <div class="text-sm ky-text-muted">Reason: ${esc(i.reason)} (${Math.round(i.confidence * 100)}%)</div>
- `src/pages/admin.astro:322` <span class="ky-text-muted text-sm" style="margin-left:auto">${formatDate(a.created_at)}</span>
- `src/pages/committees.astro:62` <p class="text-sm ky-text-muted">${esc(c.description || '')}</p>
- `src/pages/directory.astro:23` <p class="text-sm ky-text-muted" id="mm-joined"></p>
- `src/pages/directory.astro:127` .map(([k, v]) => `<div class="text-sm"><strong>${esc(k)}:</strong> ${esc(v as string)}</div>`)
- `src/pages/event.astro:115` ${event.capacity ? `<span class="text-sm ky-text-muted">${spotsLeft} of ${event.capacity} spots left</span>` : ''}
- `src/pages/event.astro:117` ${visibleOptions.length ? `<p class="text-sm ky-text-muted mb-1">Source registration options are listed above. Use RSVP here only for Kychon attendance tracking.</p>` : ''}
- `src/pages/event.astro:129` : '<p class="text-sm ky-text-muted mt-1">Sign in to RSVP</p>'
- `src/pages/event.astro:249` return '<p class="text-sm ky-text-muted mb-1">No structured registration options yet.</p>';
- `src/pages/events.astro:107` <p class="text-sm ky-text-muted">${esc(dateTime.dateTimeLabel)}</p>
- `src/pages/events.astro:108` ${e.location ? `<p class="text-sm ky-text-muted">${esc(e.location)}</p>` : ''}
- `src/pages/join.astro:8` <div id="join-error" class="text-sm hidden" style="color:var(--color-danger);margin-bottom:1rem"></div>
- ... 3 more usages

### .text-center

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/pages/admin-members.astro:93` tbody.innerHTML = '<tr><td colspan="6" class="ky-text-muted text-center">No members found.</td></tr>';
- `src/pages/directory.astro:19` <div class="text-center mb-2">
- `src/pages/directory.astro:73` grid.innerHTML = '<p class="ky-text-muted text-center">No members found.</p>';
- `src/pages/join.astro:29` <p class="text-sm ky-text-muted mt-2 text-center">
- `src/pages/profile.astro:8` <div class="text-center mb-2">
- `src/pages/resources.astro:149` grid.innerHTML = `<div class="text-center ky-text-muted"><p class="mb-1">Sign in to view resources.</p><button class="btn btn-primary" id="res-signin-btn">Sign in</button></div>`;

### .text-muted

Retired as a Kychon helper; use `.ky-text-muted` for public/static markup or Tailwind/shadcn semantic text utilities in React code.

### .container

Retired as a Kychon layout class; use `.ky-container` for Kychon chrome/block layout and reserve `.container` for Tailwind if needed.

### .btn

Owned public component class retained temporarily while call sites move to Kychon UI components.

Definitions:
- `src/styles/public.css:329` .btn {
- `src/styles/public.css:349` .btn:hover {
- `src/styles/public.css:353` .btn:focus-visible {
- `src/styles/public.css:357` .btn:active {
- `src/styles/public.css:800` .section-hero[style*="background-image"] .btn {
- `src/styles/public.css:1101` .feature-card .btn {

Usages:
- `src/components/AdminEditor.astro:327` <button class="btn btn-sm btn-primary" type="button" data-move-to-wordmark>Move to wordmark</button>
- `src/components/AdminEditor.astro:635` <button class="btn btn-sm btn-primary" type="button" data-make-global="${sectionId}">Make global</button>
- `src/components/AdminEditor.astro:713` <button class="btn btn-secondary btn-sm" id="nav-editor-source-settings">Source settings</button>
- `src/components/AdminEditor.astro:714` <button class="btn btn-primary btn-sm" id="nav-editor-save">Save</button>
- `src/components/AdminEditor.astro:715` <button class="btn btn-secondary btn-sm" id="nav-editor-cancel">Cancel</button>
- `src/components/AdminEditor.astro:719` <button class="btn btn-secondary btn-sm mt-1" id="nav-editor-add">+ Add item</button>
- `src/components/AdminEditor.astro:789` <button class="btn btn-secondary btn-sm" data-add-child="${path}" title="Add child item">+ child</button>
- `src/components/AdminEditor.astro:1063` <button class="btn btn-primary btn-sm" data-action="save">Save</button>
- `src/components/AdminEditor.astro:1064` <button class="btn btn-secondary btn-sm" data-action="cancel">Cancel</button>
- `src/components/AdminEditor.astro:1594` <button type="button" class="btn btn-secondary btn-sm" id="embed-url-extract">Extract</button>
- `src/components/AdminEditor.astro:1622` <button class="btn btn-primary btn-sm" id="embed-save">Save</button>
- `src/components/AdminEditor.astro:1623` <button class="btn btn-secondary btn-sm" id="embed-cancel">Cancel</button>
- `src/components/AdminEditor.astro:1844` ? `<div class="hero-settings-link"><label class="admin-section-edit-label">Hero</label><button type="button" class="btn btn-secondary btn-sm" data-edit-hero-settings>Hero settings…</button></div>`
- `src/components/AdminEditor.astro:1847` ? `<div class="source-settings-link"><label class="admin-section-edit-label">Source fidelity</label><button type="button" class="btn btn-secondary btn-sm" data-edit-source-settings>Source settings...</button></div>`
- `src/components/AdminEditor.astro:1859` <button type="button" class="btn btn-secondary btn-sm" data-edit-scope-toggle data-edit-scope-next="${scopeNext}">${esc(scopeLabel)}</button>
- `src/components/AdminEditor.astro:1863` <button type="button" class="btn btn-secondary btn-sm danger" data-edit-remove>Remove block</button>
- `src/lib/admin/copied-theme-editor.ts:137` <button type="button" class="btn btn-secondary btn-sm" data-panel-move="${index}" data-direction="-1">Up</button>
- `src/lib/admin/copied-theme-editor.ts:138` <button type="button" class="btn btn-secondary btn-sm" data-panel-move="${index}" data-direction="1">Down</button>
- `src/lib/admin/copied-theme-editor.ts:139` <button type="button" class="btn btn-secondary btn-sm danger" data-panel-remove="${index}">Remove</button>
- `src/lib/admin/copied-theme-editor.ts:167` ${sectionHtml('Panels', `<div class="admin-copied-list">${panelHtml}</div><button type="button" class="btn btn-secondary btn-sm" data-panel-add>Add panel</button>`)}
- `src/lib/admin/copied-theme-editor.ts:179` <button type="button" class="btn btn-secondary btn-sm" data-layer-move="${index}" data-direction="-1">Up</button>
- `src/lib/admin/copied-theme-editor.ts:180` <button type="button" class="btn btn-secondary btn-sm" data-layer-move="${index}" data-direction="1">Down</button>
- `src/lib/admin/copied-theme-editor.ts:181` <button type="button" class="btn btn-secondary btn-sm danger" data-layer-remove="${index}">Remove</button>
- `src/lib/admin/copied-theme-editor.ts:206` ${sectionHtml('Fill layers', `<div class="admin-copied-list">${layerHtml}</div><button type="button" class="btn btn-secondary btn-sm" data-layer-add>Add layer</button>`)}
- `src/lib/admin/copied-theme-editor.ts:218` <button type="button" class="btn btn-secondary btn-sm" data-slide-move="${index}" data-direction="-1">Up</button>
- `src/lib/admin/copied-theme-editor.ts:219` <button type="button" class="btn btn-secondary btn-sm" data-slide-move="${index}" data-direction="1">Down</button>
- `src/lib/admin/copied-theme-editor.ts:220` <button type="button" class="btn btn-secondary btn-sm danger" data-slide-remove="${index}">Remove</button>
- `src/lib/admin/copied-theme-editor.ts:262` ${sectionHtml('Slides', `<div class="admin-copied-list">${slideHtml}</div><button type="button" class="btn btn-secondary btn-sm" data-slide-add>Add slide</button>`)}
- `src/lib/admin/copied-theme-editor.ts:505` <button class="btn btn-primary btn-sm" type="button" data-action="save">Save</button>
- `src/lib/admin/copied-theme-editor.ts:506` <button class="btn btn-secondary btn-sm" type="button" data-action="cancel">Cancel</button>
- ... 68 more usages

### .card

Owned public component class retained temporarily while call sites move to Kychon UI components.

Definitions:
- `src/styles/public.css:323` .card img {
- `src/styles/public.css:398` .card {
- `src/styles/public.css:413` .card:hover {

Usages:
- `src/components/AdminAccessShell.astro:8` <div class="card admin-access-check__card">
- `src/components/AdminEditor.astro:1390` <button class="card" type="button" style="cursor:pointer;text-align:center;padding:1rem" data-block-type="${type}">
- `src/lib/auth-gate.ts:62` <div class="auth-gate__card card" role="status" aria-live="polite">
- `src/lib/block-hydrators.ts:140` createEl.innerHTML = `<div class="card"><h4 class="mb-1">New Announcement</h4><div class="form-group"><input class="form-input" id="ann-title" placeholder="Title"></div><div class="form-group"><textarea class="form-textarea" id="ann-body" placeholder="Write your announcement..."></textarea></div>${pollsEnabled ? '<div id="ann-poll-form-container"></div><button class="btn btn-sm btn-secondary mb-1" id="ann-add-poll" type="button">+ Add Poll</button>' : ''}<button class="btn btn-primary" id="ann-post">Post</button></div>`;
- `src/lib/blocks.ts:713` `<figure class="card testimonial-card"><blockquote class="testimonial-quote"${editableAttr(section, `items.${i}.quote`, ctx)}>&ldquo;${escHtml(t.quote)}&rdquo;</blockquote><figcaption class="testimonial-author"${editableAttr(section, `items.${i}.name`, ctx)}>— ${escHtml(t.name)}${t.role ? `, ${escHtml(t.role)}` : ''}</figcaption></figure>`,
- `src/lib/blocks.ts:734` `<details class="card mb-1" style="cursor:pointer"><summary style="font-weight:600"${editableAttr(section, `items.${i}.q`, ctx)}>${escHtml(f.q)}</summary><p class="ky-text-muted mt-1"${editableAttr(section, `items.${i}.a`, ctx)}>${escHtml(f.a)}</p></details>`,
- `src/lib/blocks.ts:779` wrap.className = 'card mb-1';
- `src/lib/blocks.ts:840` container.innerHTML += `<div class="card"><h3>${escHtml(evt.title)}</h3><p data-countdown></p></div>`;
- `src/lib/blocks.ts:864` `<div class="ky-container" data-block-hydrate="announcements_feed"><div class="block-content"><div id="announcement-create" class="hidden mb-2"></div>${heading}<div id="announcements-feed"><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></div><div class="card mb-1"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text"></div></div></div></div></div>`,
- `src/lib/event-registration.ts:148` <section class="card event-registration mt-2">
- `src/lib/poll-ui.ts:246` <div class="poll-form card">
- `src/pages/admin-members.astro:27` <div class="card">
- `src/pages/admin.astro:10` <section class="card admin-checklist hidden mb-2" id="fresh-start-checklist" aria-labelledby="fresh-start-checklist-title">
- `src/pages/admin.astro:31` <div class="card stat-card">
- `src/pages/admin.astro:35` <div class="card stat-card">
- `src/pages/admin.astro:39` <div class="card stat-card">
- `src/pages/admin.astro:43` <div class="card stat-card">
- `src/pages/admin.astro:51` <div class="card mb-2 hidden" id="moderation-section">
- `src/pages/admin.astro:56` <div class="card mb-2">
- `src/pages/admin.astro:65` <div class="card">
- `src/pages/admin.astro:116` return `<div class="card stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
- `src/pages/committees.astro:60` <a href="/committees.html?id=${c.id}" class="card" style="text-decoration:none;color:inherit">
- `src/pages/committees.astro:107` <div class="member-card card mb-1">
- `src/pages/committees.astro:127` <div class="card mt-2">
- `src/pages/directory.astro:80` <div class="card member-card" data-member-id="${m.id}" style="cursor:pointer">
- `src/pages/event.astro:112` <div class="card mt-2">
- `src/pages/event.astro:167` <section class="card mt-2" id="event-timezone-admin">
- `src/pages/event.astro:192` <section class="card mt-2" id="event-registration-admin">
- `src/pages/events.astro:14` <div class="card-grid"><div class="card"><div class="skeleton skeleton-card"></div></div><div class="card"><div class="skeleton skeleton-card"></div></div><div class="card"><div class="skeleton skeleton-card"></div></div></div>
- `src/pages/events.astro:104` <div class="card" data-event-id="${e.id}">
- ... 9 more usages

### .badge

Owned public component class retained temporarily while call sites move to Kychon UI components.

Definitions:
- `src/styles/public.css:614` .badge {

Usages:
- `src/lib/block-hydrators.ts:87` <div class="announcement-meta">${a.is_pinned ? '<span class="badge badge-primary">Pinned</span> ' : ''}<span>${formatDate(a.created_at)}</span></div>
- `src/lib/event-registration.ts:128` ? `<span class="badge badge-secondary">${escHtml(option.review_state)}</span>`
- `src/lib/event-registration.ts:135` ${price ? `<span class="badge badge-primary">${escHtml(price)}</span>` : ''}
- `src/lib/event-registration.ts:136` ${availability ? `<span class="badge badge-warning${statusClass}">${escHtml(availability)}</span>` : ''}
- `src/pages/admin-members.astro:116` <td><span class="badge badge-${statusColor(m.status)}">${esc(m.status)}</span></td>
- `src/pages/admin.astro:13` <span class="badge badge-primary">First run</span>
- `src/pages/admin.astro:233` <span class="badge badge-danger">${esc(i.content_type)}</span>
- `src/pages/admin.astro:320` <span class="badge badge-primary">${esc(a.action)}</span>
- `src/pages/committees.astro:63` <span class="badge badge-primary">${countMap[c.id] || 0} members</span>
- `src/pages/directory.astro:22` <span class="badge badge-primary" id="mm-tier"></span>
- `src/pages/directory.astro:89` ${m.tier_name ? `<span class="badge badge-primary">${esc(m.tier_name)}</span> ` : ''}
- `src/pages/event.astro:106` ${event.is_members_only ? '<span class="badge badge-primary mb-1">Members Only</span>' : ''}
- `src/pages/events.astro:109` ${e.is_members_only ? '<span class="badge badge-primary">Members Only</span>' : ''}
- `src/pages/events.astro:110` ${e.capacity ? `<span class="badge badge-warning">${e.capacity} spots</span>` : ''}
- `src/pages/forum.astro:325` ${t.is_pinned ? '<span class="badge badge-primary">Pinned</span>' : ''}
- `src/pages/forum.astro:326` ${t.locked ? '<span class="badge badge-warning">Locked</span>' : ''}
- `src/pages/forum.astro:327` ${t.hidden ? '<span class="badge badge-danger">Hidden</span>' : ''}
- `src/pages/forum.astro:503` ${topic.is_pinned ? '<span class="badge badge-primary" style="margin-right:0.375rem">Pinned</span>' : ''}
- `src/pages/forum.astro:504` ${topic.locked ? '<span class="badge badge-warning" style="margin-right:0.375rem">Locked</span>' : ''}
- `src/pages/forum.astro:505` ${topic.hidden ? '<span class="badge badge-danger" style="margin-right:0.375rem">Hidden</span>' : ''}
- `src/pages/forum.astro:525` <span class="forum-post-date">${timeAgo(r.created_at)}${r.hidden ? ' <span class="badge badge-danger">Hidden</span>' : ''}</span>
- `src/pages/resources.astro:168` ${r.category ? `<span class="badge badge-primary">${esc(r.category)}</span>` : ''}
- `src/pages/resources.astro:174` ${r.is_members_only ? '<span class="badge badge-warning">Members Only</span>' : ''}

### .toast

Owned public component class retained temporarily while call sites move to Kychon UI components.

Definitions:
- `src/styles/public.css:1491` .toast {
- `src/styles/public.css:1506` .toast.dismissing {

### .form-input

Owned public component class retained temporarily while call sites move to Kychon UI components.

Definitions:
- `src/styles/public.css:440` .form-input,
- `src/styles/public.css:453` .form-input:focus,

Usages:
- `src/lib/block-hydrators.ts:140` createEl.innerHTML = `<div class="card"><h4 class="mb-1">New Announcement</h4><div class="form-group"><input class="form-input" id="ann-title" placeholder="Title"></div><div class="form-group"><textarea class="form-textarea" id="ann-body" placeholder="Write your announcement..."></textarea></div>${pollsEnabled ? '<div id="ann-poll-form-container"></div><button class="btn btn-sm btn-secondary mb-1" id="ann-add-poll" type="button">+ Add Poll</button>' : ''}<button class="btn btn-primary" id="ann-post">Post</button></div>`;
- `src/lib/poll-ui.ts:253` <input class="form-input poll-form-question" required placeholder="What do you want to ask?">
- `src/lib/poll-ui.ts:259` <input class="form-input poll-form-option-input" placeholder="Option 1" required>
- `src/lib/poll-ui.ts:263` <input class="form-input poll-form-option-input" placeholder="Option 2" required>
- `src/lib/poll-ui.ts:273` <select class="form-input poll-form-type" style="width:auto">
- `src/lib/poll-ui.ts:280` <select class="form-input poll-form-visibility" style="width:auto">
- `src/lib/poll-ui.ts:292` <input type="datetime-local" class="form-input poll-form-closes" style="width:auto">
- `src/lib/poll-ui.ts:304` <input class="form-input poll-form-option-input" placeholder="Option ${count + 1}" required>
- `src/pages/admin-members.astro:14` <input class="form-input" id="am-search" placeholder="Search members..." style="max-width:16rem">
- `src/pages/committees.astro:17` <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="cmf-name" required></div>
- `src/pages/directory.astro:8` <input class="form-input" id="dir-search" placeholder="Search members..." style="max-width:20rem">
- `src/pages/event.astro:172` <input class="form-input" id="event-source-timezone" placeholder="Australia/Sydney" value="${esc(event.source_timezone || '')}">
- `src/pages/event.astro:176` <input class="form-input" id="event-source-timezone-label" placeholder="AEST / AEDT" value="${esc(event.source_timezone_label || '')}">
- `src/pages/event.astro:187` <input class="form-input" id="event-import-review-state" placeholder="needs_review" value="${esc(event.import_review_state || '')}">
- `src/pages/event.astro:256` <div class="form-group"><label class="form-label">Order</label><input class="form-input" data-reg-field="position" type="number" value="${esc(option.position ?? 0)}"></div>
- `src/pages/event.astro:257` <div class="form-group"><label class="form-label">Label</label><input class="form-input" data-reg-field="label" value="${esc(option.label || '')}"></div>
- `src/pages/event.astro:258` <div class="form-group"><label class="form-label">Amount</label><input class="form-input" data-reg-field="price_amount" type="number" step="0.01" value="${esc(option.price_amount ?? '')}"></div>
- `src/pages/event.astro:259` <div class="form-group"><label class="form-label">Currency</label><input class="form-input" data-reg-field="currency" value="${esc(option.currency || '')}" placeholder="AUD"></div>
- `src/pages/event.astro:261` <div class="form-group"><label class="form-label">Raw price label</label><input class="form-input" data-reg-field="raw_price_label" value="${esc(option.raw_price_label || '')}"></div>
- `src/pages/event.astro:264` <div class="form-group"><label class="form-label">Guest policy</label><input class="form-input" data-reg-field="guest_policy" value="${esc(option.guest_policy || '')}"></div>
- `src/pages/event.astro:265` <div class="form-group"><label class="form-label">Capacity</label><input class="form-input" data-reg-field="capacity" type="number" value="${esc(option.capacity ?? '')}"></div>
- `src/pages/event.astro:266` <div class="form-group"><label class="form-label">Spaces left</label><input class="form-input" data-reg-field="spaces_left" type="number" value="${esc(option.spaces_left ?? '')}"></div>
- `src/pages/event.astro:274` <div class="form-group"><label class="form-label">Cancellation note</label><input class="form-input" data-reg-field="cancellation_note" value="${esc(option.cancellation_note || '')}"></div>
- `src/pages/event.astro:275` <div class="form-group"><label class="form-label">Source registration URL</label><input class="form-input" data-reg-field="source_registration_url" value="${esc(option.source_registration_url || '')}"></div>
- `src/pages/events.astro:23` <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="ef-title" required></div>
- `src/pages/events.astro:25` <div class="form-group"><label class="form-label">Location</label><input class="form-input" id="ef-location"></div>
- `src/pages/events.astro:27` <div class="form-group"><label class="form-label">Starts</label><input class="form-input" id="ef-starts" type="datetime-local" required></div>
- `src/pages/events.astro:28` <div class="form-group"><label class="form-label">Ends</label><input class="form-input" id="ef-ends" type="datetime-local"></div>
- `src/pages/events.astro:30` <div class="form-group"><label class="form-label">Capacity (0 = unlimited)</label><input class="form-input" id="ef-capacity" type="number" min="0" value="0"></div>
- `src/pages/forum.astro:351` <input class="form-input" id="nt-title" required maxlength="200">
- ... 11 more usages

### .form-select

Owned public component class retained temporarily while call sites move to Kychon UI components.

Definitions:
- `src/styles/public.css:441` .form-select,
- `src/styles/public.css:454` .form-select:focus,

Usages:
- `src/pages/admin-members.astro:15` <select class="form-select" id="am-status-filter" style="max-width:10rem">
- `src/pages/admin-members.astro:22` <select class="form-select" id="am-tier-filter" style="max-width:10rem">
- `src/pages/admin-members.astro:125` <select class="form-select btn-sm am-tier-change" data-id="${m.id}" style="width:auto;padding:0.2rem 0.4rem;font-size:0.8rem">
- `src/pages/admin-members.astro:129` <select class="form-select btn-sm am-role-change" data-id="${m.id}" style="width:auto;padding:0.2rem 0.4rem;font-size:0.8rem">
- `src/pages/committees.astro:130` <select class="form-select" id="cm-member-select" style="flex:1">
- `src/pages/committees.astro:134` <select class="form-select" id="cm-role-select" style="width:8rem">
- `src/pages/directory.astro:9` <select class="form-select" id="dir-tier-filter" style="max-width:12rem">
- `src/pages/event.astro:180` <select class="form-select" id="event-time-display-mode">
- `src/pages/event.astro:269` <select class="form-select" data-reg-field="availability_status">
- `src/pages/profile.astro:62` <select class="form-select" data-custom-field="${esc(f.field_name)}"><option value="">—</option>${opts}</select>
- `src/pages/resources.astro:11` <select class="form-select" id="res-category-filter" style="max-width:12rem">
- `src/pages/resources.astro:28` <select class="form-select" id="rf-type">

### .form-textarea

Owned public component class retained temporarily while call sites move to Kychon UI components.

Definitions:
- `src/styles/public.css:442` .form-textarea {
- `src/styles/public.css:455` .form-textarea:focus {
- `src/styles/public.css:460` .form-textarea {

Usages:
- `src/lib/block-hydrators.ts:140` createEl.innerHTML = `<div class="card"><h4 class="mb-1">New Announcement</h4><div class="form-group"><input class="form-input" id="ann-title" placeholder="Title"></div><div class="form-group"><textarea class="form-textarea" id="ann-body" placeholder="Write your announcement..."></textarea></div>${pollsEnabled ? '<div id="ann-poll-form-container"></div><button class="btn btn-sm btn-secondary mb-1" id="ann-add-poll" type="button">+ Add Poll</button>' : ''}<button class="btn btn-primary" id="ann-post">Post</button></div>`;
- `src/pages/committees.astro:18` <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="cmf-description" rows="2"></textarea></div>
- `src/pages/event.astro:262` <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" data-reg-field="description" rows="2">${esc(option.description || '')}</textarea></div>
- `src/pages/events.astro:24` <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="ef-description"></textarea></div>
- `src/pages/forum.astro:355` <textarea class="form-textarea" id="nt-body" required></textarea>
- `src/pages/forum.astro:545` <textarea class="form-textarea" id="rf-body" required placeholder="Write your reply..."></textarea>
- `src/pages/profile.astro:21` <textarea class="form-textarea" id="profile-bio" rows="3"></textarea>
- `src/pages/profile.astro:54` <textarea class="form-textarea" data-custom-field="${esc(f.field_name)}">${esc(val)}</textarea>
- `src/pages/resources.astro:24` <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="rf-description" rows="2"></textarea></div>
