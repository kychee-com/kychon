# UI CSS Collision Report

Generated: 2026-05-16T03:44:38.338Z

This report tracks legacy unprefixed classes that collide with Tailwind utilities or shadcn/Kychon component names. New UI code should not add fresh usages of these classes unless it is explicitly part of the compatibility layer.

| Class | Definitions | Usages | Decision |
|---|---:|---:|---|
| `.hidden` | 0 | 3 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.flex` | 0 | 186 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.flex-col` | 0 | 46 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.gap-1` | 0 | 9 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.mt-1` | 0 | 7 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.mt-2` | 0 | 5 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.mb-1` | 0 | 1 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.mb-2` | 0 | 2 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.items-center` | 0 | 118 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.justify-between` | 0 | 14 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.text-sm` | 0 | 138 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.text-center` | 0 | 33 | Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities. |
| `.text-muted` | 0 | 0 | Retired as a Kychon helper; use Tailwind/shadcn semantic text utilities in generated markup and React code. |
| `.container` | 0 | 0 | Retired as a Kychon layout class; use Tailwind layout utilities with `data-layout-container` for Kychon chrome/block layout and reserve `.container` for Tailwind if needed. |
| `.btn` | 0 | 0 | Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead. |
| `.card` | 0 | 0 | Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead. |
| `.badge` | 0 | 0 | Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead. |
| `.toast` | 0 | 0 | Retired as a Kychon public component class; use the Sonner-backed Kychon `Toaster`/`toast` helpers instead. |
| `.form-input` | 0 | 0 | Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead. |
| `.form-select` | 0 | 0 | Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead. |
| `.form-textarea` | 0 | 0 | Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead. |

## Hit Details

### .hidden

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminZoneAddButton.tsx:13` className="mx-auto my-2 hidden w-fit border-dashed bg-background/90 text-muted-foreground shadow-sm hover:text-primary [[data-admin=true]_&]:!flex"
- `src/components/kychon/DemoBannerIsland.tsx:265` className="hidden h-7 bg-amber-400 px-3 text-xs text-slate-950 hover:bg-amber-500 md:inline-flex"
- `src/components/kychon/ProfilePageApp.tsx:306` className="hidden"

### .flex

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/AuthModalIsland.tsx:214` <div className="flex items-center gap-3 text-xs text-muted-foreground">
- `src/components/AuthModalIsland.tsx:222` <div className="flex items-center gap-3 text-xs text-muted-foreground">
- `src/components/AuthModalIsland.tsx:249` <div className="flex flex-col gap-2">
- `src/components/kychon/ActivityFeedIsland.tsx:133` <CardContent className="flex items-start gap-3 p-4">
- `src/components/kychon/AdminActionPromptIsland.tsx:56` <CardContent className="flex items-center gap-2 p-2 text-sm">
- `src/components/kychon/AdminDashboardApp.tsx:431` <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:456` <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
- `src/components/kychon/AdminDashboardApp.tsx:470` <div className="mb-3 flex items-start gap-3">
- `src/components/kychon/AdminDashboardApp.tsx:492` <div className="mb-3 flex items-start gap-3">
- `src/components/kychon/AdminDashboardApp.tsx:512` <div className="mb-3 flex items-start gap-3">
- `src/components/kychon/AdminDashboardApp.tsx:551` <div className="flex items-end">
- `src/components/kychon/AdminDashboardApp.tsx:580` <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
- `src/components/kychon/AdminDashboardApp.tsx:649` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:659` className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center"
- `src/components/kychon/AdminDashboardApp.tsx:662` <div className="flex flex-wrap items-center gap-2">
- `src/components/kychon/AdminDashboardApp.tsx:670` <div className="flex gap-2">
- `src/components/kychon/AdminDashboardApp.tsx:700` <CardContent className="flex flex-wrap gap-2">
- `src/components/kychon/AdminDashboardApp.tsx:719` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:728` <div key={`${item.created_at || 'activity'}-${index}`} className="flex flex-wrap items-center gap-2 py-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1012` <div className="flex items-end gap-1">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1048` <div className="flex flex-wrap gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1286` className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50"
- `src/components/kychon/AdminEditorControlsIsland.tsx:1355` <div className="flex flex-wrap items-center justify-between gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1357` <div className="flex gap-1">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1544` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1553` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1606` <div className="flex items-center gap-2 text-sm font-medium">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1731` <div className="flex flex-wrap gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1756` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1801` <DialogTitle className="flex items-center gap-2">
- ... 156 more usages

### .flex-col

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/AuthModalIsland.tsx:249` <div className="flex flex-col gap-2">
- `src/components/kychon/AdminDashboardApp.tsx:456` <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
- `src/components/kychon/AdminDashboardApp.tsx:580` <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
- `src/components/kychon/AdminDashboardApp.tsx:659` className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center"
- `src/components/kychon/AdminMembersApp.tsx:218` <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
- `src/components/kychon/AdminSettingsApp.tsx:740` <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
- `src/components/kychon/AdminSettingsApp.tsx:953` <div className="flex flex-col gap-2 sm:flex-row">
- `src/components/kychon/AnnouncementsFeedIsland.tsx:297` <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
- `src/components/kychon/AnnouncementsFeedIsland.tsx:335` <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
- `src/components/kychon/AnnouncementsFeedIsland.tsx:356` <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
- `src/components/kychon/CalendarPageApp.tsx:148` <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
- `src/components/kychon/CalendarPageApp.tsx:283` <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
- `src/components/kychon/CalendarPageApp.tsx:309` <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
- `src/components/kychon/CommitteesPageApp.tsx:89` <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
- `src/components/kychon/CommitteesPageApp.tsx:166` <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
- `src/components/kychon/DirectoryPageApp.tsx:156` <div className="flex flex-col gap-2 sm:flex-row">
- `src/components/kychon/EventDetailPageApp.tsx:210` <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
- `src/components/kychon/EventDetailPageApp.tsx:270` <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
- `src/components/kychon/EventDetailPageApp.tsx:319` <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
- `src/components/kychon/EventDetailPageApp.tsx:447` <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
- `src/components/kychon/EventDetailPageApp.tsx:577` <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
- `src/components/kychon/EventsCalendarBlockView.tsx:213` <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
- `src/components/kychon/EventsCalendarBlockView.tsx:440` <div className="flex flex-col gap-4" data-events-calendar-agenda>
- `src/components/kychon/EventsCalendarBlockView.tsx:451` <div className="flex flex-col gap-2">
- `src/components/kychon/EventsCalendarBlockView.tsx:474` <CardContent className="flex flex-col gap-1.5 p-2">
- `src/components/kychon/EventsCalendarBlockView.tsx:515` <ul className="m-0 flex list-none flex-col gap-3 p-0">
- `src/components/kychon/EventsListIsland.tsx:201` <div className="flex w-24 shrink-0 flex-col rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
- `src/components/kychon/EventsPageApp.tsx:326` <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
- `src/components/kychon/EventsPageApp.tsx:331` <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
- `src/components/kychon/ForumPageApp.tsx:259` <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
- ... 16 more usages

### .gap-1

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminEditorControlsIsland.tsx:1012` <div className="flex items-end gap-1">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1357` <div className="flex gap-1">
- `src/components/kychon/CalendarPageApp.tsx:115` <span className="inline-flex items-center gap-1">
- `src/components/kychon/CalendarPageApp.tsx:120` <span className="inline-flex min-w-0 items-center gap-1">
- `src/components/kychon/DirectoryPageApp.tsx:239` <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
- `src/components/kychon/EventsListIsland.tsx:211` <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
- `src/components/kychon/EventsListIsland.tsx:217` <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
- `src/components/kychon/NavBlockView.tsx:175` <MenuButton active={item.active} className="inline-flex items-center gap-1" controls={menuId} parentTrigger>
- `src/components/kychon/ResourcesPageApp.tsx:300` <div className="flex flex-wrap gap-1">

### .mt-1

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/ActivityFeedIsland.tsx:142` <p className="mt-1 text-xs text-muted-foreground">{formatActivityTime(entry.created_at)}</p>
- `src/components/kychon/AdminSettingsApp.tsx:1038` <p className="mt-1 text-sm text-muted-foreground">
- `src/components/kychon/AdminSettingsApp.tsx:1078` <p className="mt-1 text-sm text-muted-foreground">{field.field_name}</p>
- `src/components/kychon/DirectoryPageApp.tsx:239` <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
- `src/components/kychon/EventsListIsland.tsx:211` <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
- `src/components/kychon/EventsListIsland.tsx:217` <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
- `src/components/kychon/ForumPageApp.tsx:822` {category?.description ? <p className="mt-1 break-words text-sm text-muted-foreground">{category.description}</p> : null}

### .mt-2

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminEditorControlsIsland.tsx:1907` <div className="mt-2 flex gap-2">
- `src/components/kychon/EventCountdownIsland.tsx:121` <div className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
- `src/components/kychon/EventsCalendarBlockView.tsx:535` <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
- `src/components/kychon/EventsCalendarBlockView.tsx:539` <div className="mt-2">
- `src/components/kychon/ForumPageApp.tsx:712` <div className="mt-2 text-xs text-muted-foreground">Translated by AI</div>

### .mb-1

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminSettingsApp.tsx:1108` <h4 className="mb-1 font-medium text-foreground">AI Activity</h4>

### .mb-2

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/CalendarPageApp.tsx:285` <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/CommitteesPageApp.tsx:189` <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">

### .items-center

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/AuthModalIsland.tsx:214` <div className="flex items-center gap-3 text-xs text-muted-foreground">
- `src/components/AuthModalIsland.tsx:222` <div className="flex items-center gap-3 text-xs text-muted-foreground">
- `src/components/kychon/AdminAccessShellView.tsx:18` <CardHeader className="flex-row items-center gap-4 space-y-0">
- `src/components/kychon/AdminActionPromptIsland.tsx:56` <CardContent className="flex items-center gap-2 p-2 text-sm">
- `src/components/kychon/AdminDashboardApp.tsx:431` <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:649` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:662` <div className="flex flex-wrap items-center gap-2">
- `src/components/kychon/AdminDashboardApp.tsx:719` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:728` <div key={`${item.created_at || 'activity'}-${index}`} className="flex flex-wrap items-center gap-2 py-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1286` className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50"
- `src/components/kychon/AdminEditorControlsIsland.tsx:1355` <div className="flex flex-wrap items-center justify-between gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1544` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1553` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1570` <div className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1606` <div className="flex items-center gap-2 text-sm font-medium">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1756` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1801` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1809` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1861` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1869` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1949` <div className="flex items-center gap-2 text-sm">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1985` <DialogTitle className="flex items-center gap-2">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1993` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminMembersApp.tsx:208` <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
- `src/components/kychon/AdminMembersApp.tsx:318` <div className="flex items-center gap-3">
- `src/components/kychon/AdminMembersApp.tsx:327` <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
- `src/components/kychon/AdminMembersApp.tsx:344` <div className="flex flex-wrap items-center gap-2">
- `src/components/kychon/AdminSettingsApp.tsx:372` <div className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50">
- `src/components/kychon/AdminSettingsApp.tsx:853` <label key={key} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
- `src/components/kychon/AdminSettingsApp.tsx:1018` <CardHeader className="flex-row items-center justify-between gap-3">
- ... 88 more usages

### .justify-between

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminEditorControlsIsland.tsx:1355` <div className="flex flex-wrap items-center justify-between gap-2">
- `src/components/kychon/AdminSettingsApp.tsx:1018` <CardHeader className="flex-row items-center justify-between gap-3">
- `src/components/kychon/AdminSettingsApp.tsx:1032` <div key={tier.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
- `src/components/kychon/AdminSettingsApp.tsx:1056` <CardHeader className="flex-row items-center justify-between gap-3">
- `src/components/kychon/AdminSettingsApp.tsx:1070` <div key={field.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
- `src/components/kychon/AnnouncementsFeedIsland.tsx:216` <div className="flex items-center justify-between gap-3">
- `src/components/kychon/CalendarPageApp.tsx:198` <div className="flex items-center justify-between gap-2">
- `src/components/kychon/CalendarPageApp.tsx:341` <div className="flex items-center justify-between gap-3">
- `src/components/kychon/EventsCalendarBlockView.tsx:535` <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
- `src/components/kychon/ForumPageApp.tsx:353` <div className="flex min-w-0 items-center justify-between gap-3">
- `src/components/kychon/ForumPageApp.tsx:620` <div className="flex items-center justify-between gap-3">
- `src/components/kychon/PollsBlockIsland.tsx:114` <div className="flex min-w-0 items-center justify-between gap-3">
- `src/components/kychon/PollsPageApp.tsx:149` <div className="flex min-w-0 items-center justify-between gap-3">
- `src/components/kychon/PollsPageApp.tsx:442` <div className="flex items-center justify-between gap-3">

### .text-sm

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/ActivityFeedIsland.tsx:113` return <p className="text-sm text-muted-foreground">Sign in as a member to see recent activity.</p>;
- `src/components/kychon/ActivityFeedIsland.tsx:117` return <p className="text-sm text-muted-foreground">No recent activity yet.</p>;
- `src/components/kychon/ActivityFeedIsland.tsx:121` return <p className="text-sm text-muted-foreground">Could not load activity.</p>;
- `src/components/kychon/ActivityFeedIsland.tsx:141` <p className="text-sm leading-5 text-foreground">{text}</p>
- `src/components/kychon/AdminActionPromptIsland.tsx:56` <CardContent className="flex items-center gap-2 p-2 text-sm">
- `src/components/kychon/AdminDashboardApp.tsx:125` <div className="text-sm text-muted-foreground">{stat.label}</div>
- `src/components/kychon/AdminDashboardApp.tsx:132` return <p className="text-sm text-muted-foreground">{children}</p>;
- `src/components/kychon/AdminDashboardApp.tsx:431` <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:474` <div className="text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:496` <div className="text-sm text-muted-foreground">{passkeyStatusLabel(accountSecurity)}</div>
- `src/components/kychon/AdminDashboardApp.tsx:516` <div className="text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:595` <div className="text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:618` <div className="text-sm text-muted-foreground">{item.description}</div>
- `src/components/kychon/AdminDashboardApp.tsx:649` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:664` <span className="truncate text-sm">{item.preview}</span>
- `src/components/kychon/AdminDashboardApp.tsx:666` <div className="text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:719` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminDashboardApp.tsx:731` <span className="ml-auto text-sm text-muted-foreground">{formatDate(item.created_at)}</span>
- `src/components/kychon/AdminEditorControlsIsland.tsx:1286` className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50"
- `src/components/kychon/AdminEditorControlsIsland.tsx:1347` <h3 className="text-sm font-medium">{title}</h3>
- `src/components/kychon/AdminEditorControlsIsland.tsx:1356` <h4 className="text-sm font-medium">{title}</h4>
- `src/components/kychon/AdminEditorControlsIsland.tsx:1553` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1568` <div className="text-sm font-medium">Width</div>
- `src/components/kychon/AdminEditorControlsIsland.tsx:1570` <div className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1597` <div className="text-sm font-medium">Scope</div>
- `src/components/kychon/AdminEditorControlsIsland.tsx:1606` <div className="flex items-center gap-2 text-sm font-medium">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1809` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1825` <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1869` <div className="flex items-center gap-2 text-sm text-muted-foreground">
- `src/components/kychon/AdminEditorControlsIsland.tsx:1936` <p className="text-sm text-muted-foreground">No provider params.</p>
- ... 108 more usages

### .text-center

Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.

Usages:
- `src/components/kychon/AdminMembersApp.tsx:310` <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
- `src/components/kychon/AnnouncementsFeedIsland.tsx:531` <CardContent className="py-8 text-center text-sm text-muted-foreground">{state.message}</CardContent>
- `src/components/kychon/AnnouncementsFeedIsland.tsx:537` <CardContent className="py-8 text-center text-sm text-muted-foreground" data-announcements-empty>
- `src/components/kychon/AuthGateIsland.tsx:49` <Card className="w-full max-w-lg text-center" role="status" aria-live="polite">
- `src/components/kychon/CalendarPageApp.tsx:184` <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
- `src/components/kychon/CalendarPageApp.tsx:355` <CardContent className="py-8 text-center text-sm text-muted-foreground">No events match this filter.</CardContent>
- `src/components/kychon/CommitteesPageApp.tsx:89` <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
- `src/components/kychon/CommitteesPageApp.tsx:181` <CardContent className="py-8 text-center text-sm text-muted-foreground">No committees yet.</CardContent>
- `src/components/kychon/CommitteesPageApp.tsx:260` <CardContent className="py-8 text-center text-sm text-muted-foreground">No members assigned.</CardContent>
- `src/components/kychon/CustomPageApp.tsx:100` <CardContent className="py-8 text-center text-sm text-muted-foreground">Page not found.</CardContent>
- `src/components/kychon/DirectoryPageApp.tsx:132` <Card className="mx-auto max-w-lg text-center" role="status" aria-live="polite">
- `src/components/kychon/DirectoryPageApp.tsx:209` <CardContent className="p-6 text-center text-sm text-muted-foreground">No members found.</CardContent>
- `src/components/kychon/DirectoryPageApp.tsx:254` <DialogHeader className="items-center text-center">
- `src/components/kychon/EventCountdownIsland.tsx:74` <div className="mx-auto max-w-3xl text-center" data-event-countdown>
- `src/components/kychon/EventsCalendarBlockView.tsx:180` <CardContent className="p-8 text-center text-sm text-muted-foreground">{message}</CardContent>
- `src/components/kychon/EventsCalendarBlockView.tsx:389` <div className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground" key={`${weekday}-${index}`} role="columnheader">
- `src/components/kychon/EventsPageApp.tsx:364` <CardContent className="py-8 text-center text-sm text-muted-foreground">No events yet.</CardContent>
- `src/components/kychon/ForumPageApp.tsx:259` <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
- `src/components/kychon/ForumPageApp.tsx:753` <CardContent className="py-8 text-center text-sm text-muted-foreground">No categories yet.</CardContent>
- `src/components/kychon/ForumPageApp.tsx:827` <CardContent className="py-8 text-center text-sm text-muted-foreground">No topics yet. Be the first to start a discussion.</CardContent>
- `src/components/kychon/ForumPageApp.tsx:908` <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
- `src/components/kychon/ForumPageApp.tsx:1089` <CardContent className="py-8 text-center text-sm text-muted-foreground">No replies yet.</CardContent>
- `src/components/kychon/ForumPageApp.tsx:1125` <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
- `src/components/kychon/ImageAccordionBlockView.tsx:171` <CardContent className="py-6 text-center text-sm text-muted-foreground">
- `src/components/kychon/MarketingBlocksView.tsx:238` <MarketingContainer className="max-w-4xl text-center">
- `src/components/kychon/MarketingBlocksView.tsx:467` className="relative z-10 w-full max-w-6xl px-4 py-8 text-center text-xl font-semibold tracking-normal drop-shadow [&_a]:text-inherit [&_a]:underline"
- `src/components/kychon/PollsBlockIsland.tsx:341` <CardContent className="py-8 text-center text-sm text-muted-foreground" data-polls-empty>
- `src/components/kychon/PollsPageApp.tsx:683` <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
- `src/components/kychon/PollsPageApp.tsx:717` <CardContent className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</CardContent>
- `src/components/kychon/ProfilePageApp.tsx:294` <div className="flex flex-col items-center gap-3 text-center">
- ... 3 more usages

### .text-muted

Retired as a Kychon helper; use Tailwind/shadcn semantic text utilities in generated markup and React code.

### .container

Retired as a Kychon layout class; use Tailwind layout utilities with `data-layout-container` for Kychon chrome/block layout and reserve `.container` for Tailwind if needed.

### .btn

Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead.

### .card

Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead.

### .badge

Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead.

### .toast

Retired as a Kychon public component class; use the Sonner-backed Kychon `Toaster`/`toast` helpers instead.

### .form-input

Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead.

### .form-select

Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead.

### .form-textarea

Retired as a Kychon public component class; use shadcn/Kychon UI components and semantic `data-*` hooks instead.
