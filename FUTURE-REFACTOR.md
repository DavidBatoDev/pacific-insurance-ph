# Future Refactor Notes

Findings from a codebase health check first run on 2026-08-18, **deepened and partly corrected on
2026-08-19** by a full end-to-end audit of every sidebar route, the four oversized files, the
duplication surface, and the data layer.

**Not urgent.** The project is feature-complete-for-v1 and currently blocked on external client
input (see `TO-BE-UPDATE-PLAN.md` — D1 needs Eman's spreadsheet, D3 needs distribution clearance,
C2b needs Edzen's formula). That block is a reasonable window to pick this up, but none of it
should interrupt active feature/bugfix work.

Every claim below carries a `file:line`. Anything I could not confirm is marked **UNVERIFIED**.

---

## Corrections to the first pass

Two items from the 2026-08-18 list were wrong or incomplete. Recording them so they don't get
actioned as written.

- **`drafts/` is NOT imported by 8 live files.** There is **zero** `import`/`require` of anything
  under `drafts/` anywhere in the repository — verified by grepping every `.ts/.tsx/.js/.mjs` file
  for a module specifier containing `drafts`. The eight "importers" are **comment references**
  ("Ported from `drafts/src/screens.jsx` for prototype review") in
  `prospect-data.ts:3`, `screens/list-screens.tsx:5`, `screens/reports.tsx:5`,
  `screens/list-screen.tsx:5`, `screens/prospects.tsx:5`, `screens/workspace.tsx:5`,
  `icons.ts:60`, `screens/settings.tsx:5`. `drafts/**` is also explicitly eslint-ignored
  (`eslint.config.mjs:15`) and its `.jsx` files are outside the `tsconfig.json` `include` globs.
  It is 42 tracked files / 1.7 MB of **fully inert reference material**, not a live dependency.
  This changes its priority from "blocked behind items 1–2" to "delete whenever, zero risk".

- **Four dead screens, not two.** `settings.tsx` (75) and `prospects.tsx` (539) were correctly
  identified, but `workspace.tsx` (155) and `list-screens.tsx` (363) are equally importerless, and
  `prospect-data.ts` (211) is dead transitively (its only importer is dead `prospects.tsx:19`).
  **1,343 dead lines**, not 614. Conversely `list-screen.tsx` — grouped with them in the first pass
  — is **live and load-bearing** (see below), so it must not be swept up in the deletion.

---

## A. Fabricated data on live surfaces (correctness, not cleanliness)

I traced all 17 sidebar entries (`shell.tsx`) through `SCREEN_PATH` to their
`app/(app)/*/page.tsx` and on to the rendering component. **16 of 17 routes are genuinely
repository-backed.** As of 2026-08-25, the fabricated notification, sidebar and Intake Forms
surfaces below are removed or live-backed; `/reports` remains the one intentionally labelled mock
route.

### A1. `/reports` — the whole screen (as previously found, with detail)

`shell.tsx:66` → `app/(app)/reports/page.tsx:1` → `components/hub/screens/reports.tsx`, self-labelled
`DRAFT — mock UI only` (`reports.tsx:4-7`). Every number is a module constant:
`BARS` (12 months of premium revenue, `:12-16`), `MIX` (product mix percentages, `:17-22`),
`STATS` (`₱34.2M Premiums YTD`, `+18.4% vs last year`, `1,248 Active clients`, `94.2% Renewal
rate` — `:23-28`). The `YTD / Quarter / Month` segmented control (`:30-47`) has no `onClick` and
the `Export` button (`:60`) has no handler — both are inert.

**Mitigating detail the first pass missed:** `reports.tsx:53-63` omits `draft={false}`, and
`PageHead`'s `draft` prop defaults to `true` (`primitives.tsx:345`), so the page *does* render an
amber `Draft · mock data` pill (`primitives.tsx:325-335`). I checked every other `<PageHead>` call
site — **`/reports` is the only live route still showing that badge**; all 15 other `PageHead`
consumers pass `draft={false}`, and `ListScreen` forwards it (`list-screen.tsx:145`) with all seven
live callers passing `false`. So the situation is "clearly-labelled prototype left in production
navigation", not "silently lying screen". Still the right thing to fix first, but the fix can
honestly be **unlist it** rather than **build it**.

### A2. The notification bell — RESOLVED 2026-08-25

The invented entries, unread indicator and inert `Mark all read` affordance were removed. The bell
now opens an honest empty state until a notification data model exists.

`components/hub/data.ts` is a 249-line mock-data module from the prototype. I checked what each of
its 17 exports is actually used for across live code:

| Export | Live use |
| :--- | :--- |
| `peso`, `pesoShort`, `initials`, `avColor`, `Tone`, `Tier` | Real helpers/types — 100+ references, keep |
| `ALERTS`, `KPIS`, `REVENUE`, `APPLICATIONS`, `RENEWALS`, `CLAIMS`, `TRAVEL`, `TASKS`, `ACTIVITY`, `RELATIONSHIPS`, `CLIENTS`, `STAFF`, `StaffId` | **Zero live references** — dead mock records |
| `NOTIFICATIONS` (`data.ts:218-224`) | **Live in `shell.tsx`** |

`shell.tsx:10` imports `NOTIFICATIONS`; `shell.tsx:352` derives the unread count from it and
`shell.tsx:454-475` renders the dropdown. Because `Topbar` is part of the app shell, **every
authenticated page** shows a red unread dot and, on click, five invented notifications naming
invented clients and amounts — *"Payment received — ₱156,000 from Liza Gomez (APP-2026-000126)"*,
*"New claim submitted — CLM-2026-00782 by Roberto Pascual"*. Unlike `/reports` there is **no draft
badge here**. `Mark all read` (`shell.tsx:451`) is a `<span>`, not a button, so the dot can never
be cleared. This is the single most visible fabricated-data surface in the app and, in my view,
outranks `/reports` for user impact — a staff member has no cue that these aren't real.

The other ~190 lines of `data.ts` (all the dead record arrays) can go with it; the ~40 lines of
formatters and the `Tone`/`Tier` types should be kept, ideally renamed to something like
`lib/format.ts` + `components/hub/tone.ts` so nothing else grows back into a "data" module.

### A3. Sidebar badge counts and the close-out card — RESOLVED 2026-08-25

The authenticated server layout now supplies lightweight, nullable live counts for Leads, Clients,
Applications, Renewals, Claims, Travel and Tasks. Positive counts become badges; unavailable and
zero values are omitted. The dated close-out card is now a live Current workload summary over open
Applications and Renewals and disappears if either count cannot be resolved.

`shell.tsx:48-64` hardcodes nav badges as string literals: Leads `"42"`, Clients `"1.2k"`,
Applications `"41"`, Renewals `"8"` (with `alert: true`, so it renders red), Claims `"18"`,
Travel `"15"`, Tasks `"6"`. None is derived from anything; they render on every page.

`shell.tsx:201-211` renders a *"June close-out — 23 renewals and 14 applications still awaiting
payment this cycle"* card with a **Review queue** link. The numbers are prose, and the month is
hardcoded to June (today is August 2026).

Both are cheap to fix properly rather than delete: `getDashboardStats()` (`lib/queries/dashboard.ts`,
already consumed by `/dashboard`) computes most of these, and `app/(app)/layout.tsx` is a server
component that could pass real counts into the shell.

### A4. The `Intake forms` widget on the live `/prospects` board — RESOLVED 2026-08-25

The entire static widget and its invented respondent names were removed. No replacement was added
because no intake-form workflow or data model exists.

`prospects-live.tsx:473` renders `<IntakeForms />`, defined at `prospects-live.tsx:976-1042`, inside
the otherwise fully-wired Lead Lifecycle board. Its comment is explicit — *"DRAFT: no intake-form
data model exists yet"* (`:978-979`) — and the figures are literals: `sent = 28`, `completed = 19`,
`awaiting = 9` (`:982-984`) plus three invented respondents *Carla Mendez / Tonio Reyes / Liza Park*
(`:985-989`). It does carry a `DraftBadge` in its card head (`:998`), so it is labelled.

Note the name collision hazard: `Carla Mendez` and `Tonio Reyes` are also **real seeded test lead
names** used in the Phase D audit (`TO-BE-UPDATE-PLAN.md` rows for `Carla Mendez`/`Tonio Reyes`), so
this widget can be mistaken for live data by exactly the people testing the board.

Its three sibling widgets are all real — `ProposalTracking` (`:820`), `FollowUpQueue` (`:900`),
`ProductInterest` (`:941`) all derive from the `leads` prop. Removing `IntakeForms` is a two-line
change (delete `:473`, delete `:976-1042`).

### A5. Stale `DRAFT` banners on live code (NEW — documentation lie, not fabricated data)

`components/hub/screens/list-screen.tsx:3-7` opens with
`DRAFT — mock UI only … renders placeholder data with no real data layer or actions.`
It is in fact **the shared list/table screen behind seven live routes** — imported by
`operations.tsx:18` (Applications, Policies, Renewals, Claims, Travel), `payments-live.tsx:20` and
`commissions-live.tsx:16`. The banner is simply out of date and actively misleads anyone auditing
the tree (it is why the first pass grouped it with the dead screens). `nav.ts:7-9` has the same
problem — *"Lets the (still mock) screens keep their `setScreen(id)` call sites"* — while being
imported by seven live screens.

---

## B. Dead code (safe deletion)

| File | Lines | Evidence |
| :--- | ---: | :--- |
| `components/hub/screens/prospects.tsx` | 539 | No importer; real screen is `prospects-live.tsx` |
| `components/hub/screens/list-screens.tsx` | 363 | No importer; real screens are `operations.tsx` + `clients-list.tsx` + `documents/page.tsx` |
| `components/hub/prospect-data.ts` | 211 | Only importer is dead `prospects.tsx:19` |
| `components/hub/screens/workspace.tsx` | 155 | No importer; real screens are `tasks-board.tsx` + `relationship-live.tsx` |
| `components/hub/screens/settings.tsx` | 75 | No importer; real screen is `settings-live.tsx` |
| `components/hub/data.ts` (partial) | ~190 lines | Every remaining record array has zero live references after A2 removed `NOTIFICATIONS` |
| `drafts/` | 42 files / 1.7 MB | Zero imports; eslint-ignored; outside tsconfig `include` |

Method: for each module I grepped for every plausible specifier form
(`"./x"`, `"../x"`, `"@/components/hub/screens/x"`) across `app/`, `components/`, `lib/`, then
cross-checked each named export. **Do not include `list-screen.tsx` (singular) in this sweep** — see
A5.

One trivial extra: `screens/templates.tsx:13` imports `CountPill` and never uses it (the only
`no-unused-vars` warning in the repo).

---

## C. Duplication — concrete blocks and where the extraction belongs

`components/hub/primitives.tsx` (373 lines) is the existing shared-component home and is the right
destination for most of this. It is currently *under*-populated relative to what the screens
actually re-type.

### C1. Four byte-identical `INPUT` constants and four byte-identical `AREA` constants

Verified character-for-character identical:

- `INPUT` = `"h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13.5px] outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/20"`
  — `client-picker.tsx:106` (exported as `DRAWER_INPUT`), `contact-profile.tsx:77`,
  `add-task.tsx:234`, `new-lead.tsx:28`.
- `AREA` = `"w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand"`
  — `contact-profile.tsx:79`, `log-call.tsx:28`, `wizard/steps-1.tsx:29`, `wizard/steps-2.tsx:25`.

Plus two already-**drifted** variants of `INPUT` that are presumably unintentional:
`settings-live.tsx:119` (dropped the focus ring, added `disabled:` styles) and
`carrier-library-tab.tsx:15` (`text-[13px]` not `text-[13.5px]`, no focus ring, no transition).
And two `SEL` variants differing only in height: `products-live.tsx:414` (`h-9`/`text-[12.5px]`)
vs `prospects-live.tsx:815` (`h-8`/`text-[12.5px]`).

**Boundary:** move `INPUT`/`AREA`/`SEL` into `primitives.tsx` as exported constants (they are just
strings — no client boundary implication). `DRAWER_INPUT` in `client-picker.tsx` is already the
de-facto canonical copy and is already imported cross-module, so the cheapest honest fix is to
re-home it to `primitives.tsx` and re-export it from `client-picker.tsx` for one release.

### C2. Five field-label wrappers, three of them the same component

- `client-picker.tsx:109-131` `DrawerField` — `{label, required, hint, children, className}`.
- `new-lead.tsx:193-215` `Field` — **identical props, identical markup** to `DrawerField`.
- `contact-profile.tsx:1052-1071` `ComposerField` — `DrawerField` minus `hint`.
- `screens/templates.tsx:300-317` `Field` — `DrawerField` minus `required` and `hint`.
- `components/clients/client-form.tsx:68-83` `Field` — **genuinely different design** (label wraps
  the input, `text-[12.5px] font-semibold text-muted-foreground` instead of the uppercase
  `text-[11.5px] font-bold tracking-[0.05em]` used everywhere else).

`TO-BE-UPDATE-PLAN.md` already recorded the `ComposerField`-vs-`Field` overlap during the email
consolidation and fixed it *for the email form only*; the wrappers themselves survived.

**Boundary:** `DrawerField` → `primitives.tsx` as `Field`, delete the three clones. The
`client-form.tsx` one is a **real design divergence, not duplication** — it needs a product
decision (which field style wins on `/clients/new` and `/clients/[id]/edit`), not a mechanical
merge. Do not silently unify it.

### C3. The tone-pill markup, re-typed inline in eight live places

`StatusBadge` (`primitives.tsx:128-141`) already renders exactly the shape everyone wants, but it
derives its tone from the fixed `STATUS_TONE` lookup and **cannot accept an explicit tone**. So
every screen that needs a differently-derived tone re-types the class string by hand:

`group-accounts-list.tsx:115`, `products-live.tsx:183`, `products-live.tsx:382`,
`settings-live.tsx:230`, `contact-profile.tsx:351`, `contact-profile.tsx:354`,
`prospects-live.tsx:81`, `prospects-live.tsx:86`, `prospects-live.tsx:873`,
`documents-list.tsx:87` — all some variation of
`"inline-flex h-[22px] items-center gap-1.5 [whitespace-nowrap] rounded-full border px-2.5 text-[11.5px] font-[650]"` + `TONE_BADGE[…]`.

**Boundary:** add a ~10-line `<Pill tone={…} dot?>` to `primitives.tsx` and re-express
`StatusBadge`/`TierBadge` on top of it. That is one new primitive deleting ten inline copies, and it
also lets `prospects-live.tsx:80-90`'s `StageBadge`/`StatusChip` collapse to two one-liners.

### C4. The four-up stat strip, three copies

`list-screen.tsx:160-174`, `clients-list.tsx:70-80`, `reports.tsx:65-74` — identical
`grid grid-cols-4 gap-3 max-[900px]:grid-cols-2` card with
`text-[22px] font-[760] leading-none tracking-[-0.02em] tabular-nums`.
`ListScreen` already models it as a `Stat[]` prop (`list-screen.tsx:28-32`).

**Boundary:** lift `Stat` + `<StatStrip stats={…}/>` out of `list-screen.tsx` into
`primitives.tsx`; `ListScreen` and `clients-list.tsx` both consume it. (The `reports.tsx` copy dies
with A1.)

### C5. The four dashboard queue cards

`dashboard.tsx:222-258` `ApplicationsCard`, `:260-299` `RenewalsCard`, `:300-333` `ClaimsCard`,
`:334-367` `TravelCard` — four ~38-line functions with an identical skeleton
(`rows.slice(0, 6)` → `useSort(top, …)` → `useRecordNav()` → `Card` + `CardHead` + `CardLink` →
`Table`/`Th`×5/`Row`/`Td`), differing only in row type, the five column definitions, the default
sort key, and the title/icon/target screen.

**Boundary:** one generic `<QueueCard<T> …>` in a new `components/hub/dashboard/queue-card.tsx`,
parameterised by `{title, icon, screen, columns, defaultSort, renderRow}` — the same shape
`ListScreen` already proves works. Not `primitives.tsx`: it depends on `useRecordNav` and
`ScreenId`, which would pull routing concerns into the presentational module.

### C6. Two `Sparkline` implementations, one of them buggy

`primitives.tsx:182-234` `Sparkline` uses `useId()` for a collision-safe gradient id
(`:195`). `dashboard.tsx:55-78` is a near-verbatim copy whose gradient id is instead a **hash of the
data values**: `const gid = "sg" + Math.abs(data.reduce((a, v, i) => a + v * (i + 7), 0))`
(`dashboard.tsx:64`). `dashboard.tsx` already imports from `./primitives` (`:23`).

This is not just duplication. `KpiRow` (`dashboard.tsx:119-165`) renders six sparklines side by
side from `stats.trends.*.spark`. Any two KPIs whose spark arrays are equal produce the **same
`gid`**, the duplicate `<linearGradient id>` is ignored by the browser, and one card's fill silently
renders with the other's gradient. On a freshly-imported database (D1) several trends will be
all-zero arrays, which is exactly the collision case.

**Boundary:** delete `dashboard.tsx:55-78`, import `Sparkline` from `./primitives`. ~5 minutes,
fixes a latent rendering bug. Do this one first among the duplication items.

### C7. The collapsible "list + hidden add-form" card, twice in one file

`contact-profile.tsx:533-593` (Dependents) and `contact-profile.tsx:925-1044` (Documents) share an
exact skeleton: `Card` → `CardHead` with a `+`-that-rotates-45° toggle button → empty-state
`<p className="px-[18px] py-3 text-[12.5px] text-subtle">` → row list
`<div className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-2.5 last:border-0">`
→ a form panel that is `hidden` rather than unmounted (both carry a comment explaining why).

**Boundary:** `<CollapsibleListCard title icon count emptyText rows form>` — local to a new
`components/hub/screens/contact-profile/` folder rather than `primitives.tsx`, since only this
screen uses it today.

---

## D. Extraction plans for the four oversized files

These are the actual seams, not "split it up". All four are one-way structural moves with no
behaviour change; each should be verified with `npx tsc --noEmit` + `npx eslint .` (see §F for the
current baseline) and an OrcaCLI pass on the affected route.

### D1. `components/hub/screens/contact-profile.tsx` — 1,071 lines

The problem is not the file, it is that **lines 90–1051 are a single component**. `ContactProfile`
holds 18 `useState` calls (`:105-152`, `:201`), five server-action callbacks, and the entire
three-column layout. Comment density is 1%.

Seams, in dependency order (easiest → hardest):

1. **Pure helpers → `lib/`** (zero risk, do first): `fmtDate` (`:84-85`) is a
   `toLocaleDateString("en-PH", …)` wrapper duplicated in spirit across several screens; the
   `FILTERS` timeline-filter table (`:213-222`) and `TL_META` icon/tone map (`:228-237`) are
   constant data rebuilt on every render. Move to `components/hub/screens/contact-profile/config.ts`
   (or `lib/format.ts` for `fmtDate`).
2. **`<ProfileHeader>`** — `:274-444`. Owns the ⋮ menu (`menuOpen`), the identity row, the action
   cluster, and the nurture chips. Needs `client`, `origin`, `isLead`, `convertReady`, and callbacks
   for the five modals + `focusEmail`/`focusCall`. Extracting it also moves the `NURTURE` array
   (`:239-257`) — which is where the `react-hooks/refs` lint error lives (§F1), so this extraction
   is the natural place to fix it.
3. **`<ProposalCard>`** — `:770-854`. The single densest block: nine mutually-exclusive
   `client.leadStage === "Proposal" && client.proposalStatus === "…"` branches plus the
   out-of-stage explanatory note. It already delegates its copy to
   `proposalStatusLine()` (`lead-config.ts:262`), so it lifts cleanly with props
   `{client, pacificCrossPortalUrl, pending, proposalMarking, onMark, onGenerate, onRequest, onLogEmail}`.
4. **`<CollapsibleListCard>` ×2** — `:533-593` and `:925-1044`, per C7.
5. **`<ContactComposer>`** — `:598-699`. The five-tab composer. `Email` and `Log Call` already
   delegate to shared components (`EmailForm`, `LogCallForm`); only the `Log Message` (`:633-660`)
   and `Note` (`:681-698`) tabs still hold local state (`msgChannel`/`msgAt`/`msgText`/`note`), so
   this extraction moves four `useState`s out with it.
6. **`<ContactTimeline>`** — `:702-764`, owns `timelineFilter` + `FILTERS` + `TL_META`.
7. **`<AssociatedRecords>`** — `:857-878` and the `assoc` array (`:259-265`).
8. Leave the overlay block (`:980-1050`) and the remaining action callbacks in the parent — that is
   the legitimate coordination the component should keep.

Realistic end state: a `contact-profile/` folder with the parent around 250 lines.

### D2. `components/hub/screens/prospects-live.tsx` — 1,042 lines

`ProspectsLive` spans `:220-813` and builds **all three views eagerly** as local consts before the
single `return`:

- state + derived data `:224-317` (`productOptions` `:234`, `filteredLeads` `:242`,
  `statusCounts` `:266`, `kpis` `:272`, drag handlers `:306-317`)
- `const board = ( … )` `:319-494`
- `const [ownerF, setOwnerF] = useState("All")` **`:497`** ← a hook declared *after* 175 lines of
  JSX, plus `monthBucket` `:500-513`
- `const list = ( … )` `:515-601`
- forecast derivations `:606-628`, `const forecast = ( … )` `:630-~730`
- the actual `return` `:732-813`, ending in `{view === "Board" && board}` `:800-802`

Two concrete problems beyond length:

- **All three view trees are constructed on every render.** `board`, `list` and `forecast` are
  eagerly-evaluated expressions, so `React.createElement` runs for the kanban's per-stage
  `leads.map()`, the full list-table rows, *and* the forecast buckets — even though only one is
  mounted. Converting them to `<BoardView/>`, `<ListView/>`, `<ForecastView/>` rendered
  conditionally makes only one tree get built. This is the single best perf/structure win in the
  file and it *is* the extraction.
- **`useState` at `:497` sits between two JSX blobs.** It works today only because nothing returns
  early above it; any future guard clause added in `:319-496` silently breaks the Rules of Hooks.

Seams: three view components in `components/hub/screens/prospects/` (`board-view.tsx`,
`list-view.tsx`, `forecast-view.tsx`), each owning its own local state (`ownerF` belongs to
`list-view`, `drillStage`/`drillMonth` to `forecast-view`, `dragId`/`overCol` to `board-view`); the
four sub-cards `:820-1042` move to `prospects/widgets.tsx` (minus `IntakeForms`, deleted per A4);
`LeadFilters` `:92-219` — already a standalone 128-line component — becomes `prospects/filters.tsx`;
and the pure helpers `followDays` `:58-63`, `toggleFilterValue` `:52-53`,
`isIndividualProposalProduct` `:55-56` move to `lead-config.ts`, which is already the shared home
for exactly this kind of thing (see F2 — `isIndividualProposalProduct` needs fixing anyway).

### D3. `app/(app)/applications/wizard-actions.ts` — 807 lines

The file has good comment density (11%) and reasonable top-level helpers. The whole problem is
**one 466-line function**: `createFromWizardAction` (`:342-807`). It is already
self-documented with numbered section banners, which are the extraction plan:

| Section | Lines | Extract to |
| :--- | :--- | :--- |
| `0. carrier-attachment pre-flight` | `:376-395` | already thin; keep inline (it must run before the `try`) |
| `1. resolve the contact record` | `:396-526` | `resolveWizardContact(form, actor)` → `{clientId, clientName, isNew}` |
| `1b. lead stage / applicant hand-off` | `:527-629` | `applyLeadHandoff(clientId, form, mode, actor)` |
| `2. create the operational record` | `:630-760` | **three** functions — the block is an if/else-if chain on `form.category`: HMO/group `:631-659`, Travel `:660-713`, plain application `:714-760`. `persistHealthWorkflow` (`:233`) already exists as the precedent for exactly this shape |
| `3. follow-up task` | `:761-772` | `createFollowUpTask(...)` |
| `4. initial email` | `:773-807` | `logWizardEmail(...)` |

Watch the invariant while doing this: everything from §1 to §4 runs inside one `try` and shares a
mutable `result` accumulator plus `resolvedClientId`/`resumingDraft`. The extraction must thread
those explicitly (a small `WizardCreateContext` object) rather than reaching for module state, or
the error-handling contract changes. The §0 pre-flight must stay **before** the `try` — the comment
at `:377-379` explains why (a rejected email must not leave a half-built application behind).

The rest of the file (`:62-341`) is already sensibly factored and can stay.

### D4. `components/hub/dashboard.tsx` — 694 lines

**This one is the least urgent of the four and should be re-scoped.** Unlike the other three it is
already decomposed into 14 named components; the largest is `TasksWidget` at 89 lines
(`:369-457`). Splitting it is a filing exercise, not untangling. The two things actually worth
doing here are surgical:

1. Delete the duplicate `Sparkline` (`:55-78`) — see C6. **Real bug fix, 5 minutes.**
2. Collapse the four queue cards into one generic (`:222-367`) — see C5. Removes ~110 lines.

Only after those two, if the file still bothers anyone, move the groups into
`components/hub/dashboard/`: `alert-bar.tsx` (`:81-117`), `kpi-row.tsx` (`:119-165`),
`revenue-widget.tsx` (`:168-219`), `queue-card.tsx` (C5), `rail-widgets.tsx` (`:369-556`),
`export-menu.tsx` (`:559-633`), leaving the assembly (`:635-694`) in place.

**Also worth noting:** three files not on the original oversized list are in the same range and
would benefit from the same treatment — `overlays/wizard/steps-2.tsx` (653),
`screens/settings-live.tsx` (630), `overlays/wizard/new-application.tsx` (518). `shell.tsx` (574) is
mostly the `Topbar`, which would shrink substantially once A2/A3 are resolved.

---

## E. Hardcoded data in live paths that can drift from the database

The DB expresses all of these as raw `text` + `CHECK (col in (…))` constraints, and
`lib/supabase/types.ts` accordingly types the columns as `string | null` (e.g. `:570-571`,
`:579`) — **no generated union types**. So TypeScript provides *zero* protection against any of the
drift below; a mismatch surfaces only as a runtime Postgres `23514` check violation.

### E1. `preferred_channel` — three independent copies

`'Gmail','Phone','Viber','WhatsApp','iMessage','In-Person','Other'` is written out in full in:
`supabase/migrations/0002_identity.sql:57-58` (the authority),
`components/clients/client-form.tsx:23` (`CHANNELS`), and
`app/(app)/applications/wizard-actions.ts:66` (`clientChannels`).

Related: `wizard-actions.ts:65-70` maintains a `"Gmail" ↔ "Email"` translation because the wizard
uses a vocabulary (`"Email"`) that exists in **neither** check constraint. That mapping is load-
bearing glue, so it should be commented as such or the wizard's vocabulary aligned.

### E2. `communications.channel` — a fourth, hand-narrowed copy

`supabase/migrations/0007_work.sql:43-44` allows eight values. `contact-profile.tsx:638` hardcodes a
five-value subset **inline in JSX** — `["WhatsApp", "Viber", "iMessage", "SMS", "Other"]` — for the
Log Message tab. That subset may well be deliberate (you don't log an inbound "In-Person" message),
but it is undocumented and unreachable from anywhere else.

### E3. `client_type` — two copies

`components/clients/client-form.tsx:16-22` vs `supabase/migrations/0002_identity.sql:59-60`.

### E4. Lead enums vs `0013_lead_lifecycle.sql`

`lead-config.ts` is the app-side authority and is well documented, but the correspondence is
manual:

- `LEAD_STAGES` (`lead-config.ts:9-16`) has **six** values; the DB check
  (`0013_lead_lifecycle.sql:8-9`) allows **eight** (adds `Converted`, `Lost`). This is deliberate —
  `LEAD_STAGES` is the *board spine*, and `STAGE_TONE` (`:158-167`) / `STAGE_META` (`:148-156`) do
  cover all eight — but the constant's name doesn't say so. Rename to `LEAD_BOARD_STAGES` or add a
  `LEAD_STAGES_ALL` beside it.
- `LEAD_STATUSES` (`:170-177`) matches `0013:11` exactly. `PROPOSAL_STATUSES` (`:233`) matches
  `0013:13` exactly. Both fine today.

### E5. Product names hardcoded in business logic — the highest-drift-risk item here

`prospects-live.tsx:55-56`:

```ts
const isIndividualProposalProduct = (product: string | null) =>
  ["select", "blue royale"].includes(product?.trim().toLowerCase() ?? "");
```

This is not cosmetic — it is the **C2a product-routing rule** ("HMO → Request Proposal;
Select / Blue Royale → Generate Proposal") encoded as two lowercase string literals. Products are a
first-class DB table with full CRUD at `/products` (`products-live.tsx`, 524 lines, backed by
`getProductsRepository()`), so an admin renaming "Select" to "Select 2027" in the UI silently flips
those leads onto the wrong proposal workflow with no error anywhere. The same predicate is used in
`contact-profile.tsx` for the nurture chip label and the proposal card buttons.

**Fix:** this belongs as a column on `products` (e.g. `proposal_mode text check (… in
('Generate','Request'))`) or at minimum a documented constant in `lead-config.ts` next to the other
product data. Flag to Matt/Eman before D1's real-client import — imported products will not match
these literals.

`PRODUCT_COLORS` (`lead-config.ts:290-299`) has the same shape of problem with far lower stakes: it
maps eight product-name literals to hex colours and falls back to grey
(`prospects-live.tsx:186`, `:398`, `:565`, `:927`, `:948`), so a new or renamed product just loses
its colour coding. Acceptable as-is; worth a comment.

### E6. `STATUS_TONE` — 45 status strings across five tables in one map

`primitives.tsx:82-126` maps status strings from `applications`, `policies`, `renewals`, `claims`,
`travel_requests`, `payments` and the C5 completeness column into tones, with an `?? "slate"`
fallback (`:129`). The comment at `:97` honestly flags where the DB half comes from. Because of the
fallback this degrades gracefully, so it is **low priority** — but it is the single place a new
workflow status will silently render grey.

### E7. Fallback data that pretends to be config

`overlays/payment-links.tsx:38-41` `PAY_CHANNELS` hardcodes two plausible-looking channels
(*"Pacific GCash for Business — 0917 888 2100"*, *"BPI Corporate Current — 1234-5678-90"*) as a
*"Fallback until the Official Payment Channels store loads"*. The real store is
`payment_channels` (`0019_discovery_payment_channels.sql:11-22`), managed in Settings. A fallback
that renders **fabricated bank details** into a payment-instruction composer is a bad failure mode —
it should render an empty/blocked state instead. Low effort, meaningful.

---

## F. Efficiency and correctness findings

### F1. `npx eslint .` — 16 errors, 2 warnings, and they cluster into three patterns

(`npx tsc --noEmit` is **clean**.) The counts differ from the `TO-BE-UPDATE-PLAN.md:48-51` audit
note (18/5) because several were fixed since. All 16 errors come from
`eslint-plugin-react-hooks` v7 (via `eslint-config-next@16.2.9`):

- **8 × `set-state-in-effect`** — `add-task.tsx:66`, `add-task.tsx:277`, `client-picker.tsx:35`,
  `command-palette.tsx:53`, `command-palette.tsx:69`, `file-claim.tsx:28`,
  `search-dropdown.tsx:56`, `search-dropdown.tsx:148`, `search-dropdown.tsx:151`,
  `send-email.tsx:84`. This is **one recurring anti-pattern**, not eight bugs: a
  `useEffect` that synchronously mirrors a prop into local state. It has a single idiomatic fix
  (derive during render, or remount with a `key` — a pattern this codebase already uses well, see
  `contact-profile.tsx:119-121`'s `callFormKey`/`emailFormKey`).
- **4 × `refs`** — all from `contact-profile.tsx:252`/`:430`: the `NURTURE` array is built at
  `:239-250` and then **mutated with `.splice()` during render** at `:252-256`, and its entries
  close over `composerRef`. Fix falls out of the D1 `<ProfileHeader>` extraction (build the array
  conditionally instead of splicing it).
- **1 × `purity`** — `group-live.tsx:66` calls `Date.now()` during render, so the value differs
  between server and client. Compare `prospects-live.tsx:229`, which does the same thing correctly
  with `useState(() => Date.now())`. Two-line fix; removes a hydration-mismatch class of bug.
- **1 × `preserve-manual-memoization`** — `advance-lead.tsx:163`, reported as
  *"Compilation Skipped: Existing memoization could not be preserved"*.

**Why this matters more than a lint tidy-up:** I checked the bundled Next docs
(`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactCompiler.md`
and `…/02-guides/upgrading/version-16.md:408-412`). React Compiler support is **stable in Next 16
but not on by default**, and this project has neither `reactCompiler` in `next.config.ts` nor
`babel-plugin-react-compiler` in `package.json` — so the compiler is **not running** and none of
these errors costs anything today. What they represent is the **complete list of blockers to
turning it on**, which is a one-line config change plus one devDependency for automatic
memoization across a 61-client-component app that currently has 33 `useMemo`, 8 `useCallback` and
zero `React.memo`. Clearing 16 errors to unlock that trade is a good deal. Sequence it *after* the
extractions in §D, since those touch the same components.

### F2. Redundant queries on every Contact Profile load

`lib/queries/client-summary.ts:20-29` fires **seven** parallel `count`/`head` queries.
`contact-profile.tsx:260-264` reads only five of them (`applications`, `policies`, `renewals`,
`claims`, `travelRequests`). `counts.dependents` and `counts.documents` have **zero references
anywhere in the repository** — and the full rows they count are fetched in the *same*
`Promise.all` (`app/(app)/clients/[id]/page.tsx:36-37`), so the component already has
`dependents.length` / `documents.length` and uses those (`contact-profile.tsx:536`, `:930`).
`counts.applications` is likewise derivable from the `applications` fetch at `:42`.

Three of seven round-trips per page load are pure waste. Deleting two fields from the interface is
a ~10-minute change.

Also on that page: `getUsersRepository().list({ limit: 50 })` (`:40`) pulls up to 50 user rows to
build a name map from which `contact-profile.tsx:108` reads exactly **one** key
(`client.assignedUserId`). (On `/prospects` the same call is genuinely needed for many leads.)

### F3. Two real N+1 write loops in server actions

- `app/(app)/payments/actions.ts:154-168` `sendPaymentLinksAction` — a **serial** `for` loop over
  `input.paymentIds`, each iteration doing `repo.findById(id)` (1 read) + `logOutboundEmail` +
  `recordActivity` (≥2 writes). This is the *batch* drawer, so N is by design plural.
  `findByIds` + batched inserts would collapse it to ~3 round-trips.
- `app/(app)/relationship/actions.ts:38-48` `sendCampaignAction` — same shape, serial, 2 writes per
  recipient, and a campaign is by definition many recipients.
- Lower priority, bounded-N: `app/(app)/clients/actions.ts:233-235` deletes draft applications one
  at a time before deleting a client.

Note the loops are also **not transactional** — a mid-loop failure leaves a partial batch and
returns the caught error, with the already-logged rows kept. Worth a deliberate decision when
touched.

### F4. `primitives.tsx` forces a client boundary on four server pages

`primitives.tsx:1` is `"use client"`, but nearly all of it is inert: the five `TONE_*` maps
(`:11-54`), `Avatar` (`:57-79`), `StatusBadge` (`:128-141`), `TierBadge` (`:146-157`),
`DueCell` (`:160-179`), `Card` (`:237-243`), `CountPill` (`:245-251`), `CardHead` (`:253-277`),
`DraftBadge` (`:325-335`) and `PageHead` (`:339-373`) have **no state, no effects and no event
handlers**. Only `Btn` (`:297-321`), `CardLink` (`:279-291`) and `Sparkline` (`useId()` at `:195`)
need the client.

Four server components import from it — `app/(app)/documents/page.tsx:3`,
`app/(app)/clients/new/page.tsx`, `app/(app)/clients/[id]/edit/page.tsx:2`,
`app/(app)/search/page.tsx:4` — and are therefore shipping presentational markup to the browser
that could render entirely on the server. Splitting into `primitives.tsx` (server-safe) +
`primitives-interactive.tsx` (`"use client"`, three components) is mechanical and measurable.

I checked the broader "unnecessary `use client`" question separately and it comes back clean — see
below — so this is the *only* client-boundary finding.

### F5. `listAwaitingPaymentsAction` filters in JS what SQL should filter

`app/(app)/payments/actions.ts:136-137` fetches the payments list (capped at
`DEFAULT_LIST_LIMIT = 200`, `lib/repositories/types.ts:51`) and then filters to
`status === "Awaiting" || "Overdue"` in memory. The repository layer already supports pushed-down
status filtering elsewhere (`statusNotIn`, used throughout `app/(app)/dashboard/page.tsx:19-22`).
Because the 200-row cap is applied **before** the filter, this can also silently under-report once
there are more than 200 payment rows.

---

## G. Checked and came back clean

Extended from the first pass. These were investigated and are genuinely fine — listed so nobody
re-audits them:

- **Zero** `var` in live code. **Zero** `console.log`/`console.debug`. **Zero** `: any`.
- Only 8 of 226 TS/TSX files use `@ts-ignore` or `eslint-disable`.
- `npx tsc --noEmit` is **clean**.
- **16 of 17 sidebar routes are repository-backed.** Every `app/(app)/*/page.tsx` except
  `reports/page.tsx` awaits a real repository or `lib/queries/*` call. `/leads` is a deliberate
  `permanentRedirect` to `/prospects` (`app/(app)/leads/page.tsx:4`).
- **`"use client"` usage is disciplined.** 61 of 89 `.tsx` files carry it; I checked every one for
  hooks / event handlers / context and found exactly **two** that need neither — `reports.tsx` and
  `list-screens.tsx`, both already on the deletion list. There is no general over-clienting problem.
  (The one real finding is `primitives.tsx`, F4 — a module-granularity issue, not misuse.)
- **The server-side data layer is careful.** `getClientRelatedCounts` (7 parallel head-counts),
  `getContactTimeline` (2 parallel, both `.limit()`ed, `contact-timeline.ts:52-67`), the Contact
  Profile page (8-way `Promise.all`), the Dashboard page (7-way `Promise.all` with pushed-down
  `statusNotIn` + `limit`) are all parallel and bounded. `withInferredLeadStatuses`
  (`lib/queries/lead-status-inference.ts:80-99`) is **explicitly** written as a batched `.in()`
  query with a comment saying "instead of N+1". `DEFAULT_LIST_LIMIT = 200` applies to every
  repository `list()`, so the apparently-unbounded `.list()` calls in the route handlers are not
  actually unbounded.
- **The overlay layer is well-factored.** 30 files in `components/hub/overlays/`, all sharing
  `modal.tsx` / `drawer.tsx` shells; the only four that use neither (`command-palette`,
  `library-attachment-picker`, `search-dropdown`, `toast`) are legitimately not modals. The email
  and call-logging consolidations recorded in `TO-BE-UPDATE-PLAN.md` Phase D have held.
- **`operations.tsx` is the model to copy.** Five live route screens (Applications, Policies,
  Renewals, Claims, Travel) in 438 lines, each ~60-100 lines of declarative config over the shared
  `ListScreen`. This is the shape the four oversized files should be refactored *towards*.
- **Comment density is fine** — 1% in `contact-profile.tsx` / `prospects-live.tsx`, 3% in
  `dashboard.tsx`, 11% in `wizard-actions.ts`. Not bloated; if anything the two 1% files are the
  ones that would benefit from section comments as they're split.
- **`drafts/` is inert** — no imports, eslint-ignored, outside tsconfig `include`. It is not
  shipping any code.
- Migration hygiene: every enum-ish column is guarded by a DB `CHECK`. The gap is on the TypeScript
  side (§E), not the schema side.

---

## Recommended order

Sequenced by **risk and dependency**, not by size. Effort estimates assume one focused session each
and include verification (`tsc --noEmit`, `eslint .`, an OrcaCLI pass on the affected route).

**Tier 1 — user-facing correctness. Do these first, in this order.**

| # | Item | Ref | Effort |
| :-- | :--- | :--- | :--- |
| 1 | ~~**Topbar notifications**~~ — **DONE 2026-08-25.** Mock entries removed; honest empty state retained. | A2 | Done |
| 2 | **`/reports`** — unlist from `NAV_SYS` (`shell.tsx:66`) and delete the route, or keep the route and build it. Unlisting is the honest cheap option; the screen already carries a Draft badge, so this is deliberate scope removal, not a bug fix. | A1 | S (unlist) / L (build) |
| 3 | ~~**`IntakeForms` widget**~~ — **DONE 2026-08-25.** Static widget removed. | A4 | Done |
| 4 | ~~**Sidebar badges + "June close-out" card**~~ — **DONE 2026-08-25.** Dedicated head-count query now backs the badges and Current workload card. | A3 | Done |
| 5 | **`PAY_CHANNELS` fallback** — fabricated bank details in a payment composer; render a blocked state instead. | E7 | S |
| 6 | **Duplicate `Sparkline`** — delete `dashboard.tsx:55-78`, import from `primitives`. Fixes a latent SVG-id collision that will bite on the freshly-imported D1 dataset. | C6 | XS |

**Tier 2 — safe deletions. No dependencies on Tier 1; can run in parallel.**

| # | Item | Ref | Effort |
| :-- | :--- | :--- | :--- |
| 7 | Delete the four dead screens + `prospect-data.ts` (1,343 lines). **Explicitly exclude `list-screen.tsx`.** | B | S |
| 8 | Delete `drafts/` (42 files, 1.7 MB) — no longer blocked on anything. | Corrections | XS |
| 9 | Prune `data.ts` to its formatters + `Tone`/`Tier`; rename to something that isn't "data". Depends on #1 (`NOTIFICATIONS`). | A2, B | S |
| 10 | Fix the stale `DRAFT` banners on `list-screen.tsx:3-7` and `nav.ts:7-9`. | A5 | XS |

**Tier 3 — shared primitives. Do before the big extractions, so the extractions consume them.**

| # | Item | Ref | Effort |
| :-- | :--- | :--- | :--- |
| 11 | Re-home `INPUT`/`AREA`/`SEL` to `primitives.tsx`; delete the 8 copies and reconcile the 2 drifted variants. | C1 | S |
| 12 | One `Field` in `primitives.tsx`; delete the 3 clones. **Leave `client-form.tsx`'s alone** — that's a design decision, not duplication. | C2 | S |
| 13 | Add `<Pill tone>`; rebase `StatusBadge`/`TierBadge` on it; delete ~10 inline copies. | C3 | S |
| 14 | Lift `<StatStrip>` out of `list-screen.tsx` into `primitives.tsx`. | C4 | XS |
| 15 | Split `primitives.tsx` into server-safe + `"use client"` halves. Do it **after** 11–14 so the split happens once. | F4 | S |

**Tier 4 — structural extractions. Opportunistic; take one per session, on next touch.**

| # | Item | Ref | Effort |
| :-- | :--- | :--- | :--- |
| 16 | `prospects-live.tsx` → three view components. Highest payoff: also stops all three view trees being built every render, and fixes the mid-body hook at `:497`. | D2 | L |
| 17 | `contact-profile.tsx` → `contact-profile/` folder, 7 seams. Fixes 4 of the 16 lint errors en route. | D1 | L |
| 18 | `createFromWizardAction` → 6 helpers along its own section banners. Server-side, no UI risk, but thread the shared context explicitly. | D3 | M–L |
| 19 | `dashboard.tsx` — **only** the generic `<QueueCard>` (#6 already did the Sparkline). Full split is optional and low value. | D4, C5 | M |

**Tier 5 — enum/config drift. Needs a product decision, so it can't be scheduled purely by us.**

| # | Item | Ref | Effort |
| :-- | :--- | :--- | :--- |
| 20 | **`isIndividualProposalProduct`** — move the Generate-vs-Request routing off two hardcoded product-name literals onto a `products` column. **Raise before D1's client import**, since imported product names will not match. | E5 | M (+ migration) |
| 21 | Single-source `preferred_channel`, `client_type`, `communications.channel` — one shared constants module, ideally asserted against the DB in a test. | E1–E3 | S–M |
| 22 | Rename `LEAD_STAGES` → `LEAD_BOARD_STAGES` (it is 6 of the DB's 8). | E4 | XS |

**Tier 6 — performance. Do last; #24 depends on the Tier 4 extractions being finished.**

| # | Item | Ref | Effort |
| :-- | :--- | :--- | :--- |
| 23 | Drop the 2–3 unused count queries per Contact Profile load. | F2 | XS |
| 24 | Clear the 16 `react-hooks` errors (8 are the same `set-state-in-effect` pattern), then enable `reactCompiler: true`. Sequence after #16–#19, which touch the same components. | F1 | M, then XS |
| 25 | Batch the two N+1 write loops in `sendPaymentLinksAction` / `sendCampaignAction`; decide the partial-failure semantics deliberately. | F3 | M |
| 26 | Push the status filter in `listAwaitingPaymentsAction` down to SQL (also fixes an under-report past 200 rows). | F5 | XS |
