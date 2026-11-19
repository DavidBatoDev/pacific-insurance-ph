---
name: Pacific Insurance PH
description: The operations desk for a two-person insurance brokerage, calm enough to work in all day.
colors:
  policy-green: "#059669"
  policy-green-deep: "#047857"
  policy-green-press: "#036549"
  policy-green-wash: "#ecfdf5"
  policy-green-wash-strong: "#d6f5e6"
  morning-desk: "#f4f6f5"
  card-white: "#ffffff"
  surface-quiet: "#fafbfa"
  surface-recessed: "#f1f3f2"
  surface-hover: "#f5f7f6"
  line: "#e6e9e7"
  line-strong: "#d6dad8"
  line-soft: "#eef1ef"
  ink: "#14211b"
  ink-muted: "#5d6a63"
  ink-subtle: "#66716a"
  ink-faint: "#68736c"
  alert-red: "#dc2626"
  alert-red-wash: "#fef2f2"
  caution-amber: "#c2700a"
  caution-amber-wash: "#fff8eb"
  info-blue: "#2563eb"
  info-blue-wash: "#eff5ff"
  stage-violet: "#7c3aed"
  stage-violet-wash: "#f6f3ff"
  neutral-slate: "#475569"
  neutral-slate-wash: "#f1f5f9"
typography:
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  stat:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.05em"
  reference:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "7px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "18px"
components:
  button-primary:
    backgroundColor: "{colors.policy-green}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.policy-green-deep}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-recessed}"
    textColor: "{colors.ink-subtle}"
  button-default:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-default-hover:
    backgroundColor: "{colors.surface-hover}"
  button-small:
    rounded: "{rounded.sm}"
    height: "30px"
    padding: "0 10px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
  status-pill:
    rounded: "{rounded.full}"
    height: "22px"
    padding: "0 10px"
  nav-item-active:
    backgroundColor: "{colors.policy-green-wash}"
    textColor: "{colors.policy-green-deep}"
    rounded: "{rounded.sm}"
    height: "37px"
---

# Design System: Pacific Insurance PH

## Overview

**Creative North Star: "The Quiet Back Office"**

This is the room the brokerage works in from opening to close. A green-tinted grey desk (Morning Desk) holds white cards that each carry one job, set in Hanken Grotesk at a dense 12–14px so a full queue fits without scrolling past the point of comfort. The system stays quiet so that the few things that need attention are unmistakable: an overdue renewal in red, a waiting document in amber, a proposal in violet. Policy Green is the one voice of action.

Quiet is not timid. Controls are tactile and confident: the primary button is a solid green fill with a small lift of shadow and a clear hover, inputs show a green ring when focused, and a blocked action drops its colour entirely rather than fading. The goal is the feeling that everything is going according to plan and every person and record is accounted for.

It must not read as a generic CRM: no stock dashboard of identical metric tiles, no decoration standing in for information, no colour that doesn't carry a status. Both a light and a dark theme ship, with the same roles.

**Key Characteristics:**
- One accent (Policy Green) for action and the current place; status colours only for status.
- White cards with hairline borders and a small ambient shadow on a tinted desk.
- Dense, legible type: 14px body, 11.5px uppercase labels, tabular figures for money and counts.
- Gently rounded corners (7 / 10 / 14px); pills only for small status chips.
- Every interactive control has visible hover, focus and disabled states.

## Colors

A cool, green-leaning neutral world with a single emerald accent and six tinted status families.

### Primary
- **Policy Green** (`policy-green`): the primary button fill, focus rings, the current-page icon, progress fills and positive status. It means "act here" or "this is done".
- **Policy Green Deep** (`policy-green-deep`): primary hover, link text, and the active navigation label.
- **Policy Green Press** (`policy-green-press`): pressed state of a primary control.
- **Policy Green Wash** (`policy-green-wash`, `policy-green-wash-strong`): the active navigation background, selected rows and page-title icon tiles; the strong wash is also the text-selection colour.

### Neutral
- **Morning Desk** (`morning-desk`): the page background behind every card.
- **Card White** (`card-white`): cards, inputs, popovers and the sidebar.
- **Quiet and Recessed Surfaces** (`surface-quiet`, `surface-recessed`): group headers inside cards, count pills, disabled fills and secondary panels.
- **Hover** (`surface-hover`): row and button hover.
- **Lines** (`line`, `line-strong`, `line-soft`): card borders, input borders, and dividers inside cards, in that order of weight.
- **Ink** (`ink`): primary text. **Ink Muted** (`ink-muted`): secondary text and inactive navigation. **Ink Subtle / Faint** (`ink-subtle`, `ink-faint`): field labels, hints, captions and placeholders.

### Status families
Each family is a base colour for text and dots, a wash for the background, and a border between them: **Alert Red** (overdue, missing, rejected), **Caution Amber** (due soon, awaiting, draft), **Info Blue** (received, under review, new), **Stage Violet** (requested, in progress), **Policy Green** doubles as success, and **Neutral Slate** (pending, closed, not started).

### Named Rules
**The One Voice Rule.** Policy Green is the only accent. It marks action and the current place; it is never decoration.

**The Status Means Status Rule.** Red, amber, blue and violet appear only to report a record's state. A colour that doesn't map to a status doesn't belong.

**The Readable Grey Rule.** Every grey used for text clears 4.5:1 against cards and the desk. Hierarchy between secondary text levels comes from size and weight, not from fading.

## Typography

**Body Font:** Hanken Grotesk (with system-ui fallback)
**Label/Mono Font:** JetBrains Mono for reference numbers, policy numbers and figures in tables

**Character:** A plain, slightly warm grotesque used at small sizes with careful weight steps; the mono face appears only where a value is an identifier or a measurement.

### Hierarchy
- **Headline** (700, 23px, 1.2, -0.025em): the screen title in the page header.
- **Stat** (760, 22px, 1, tabular): headline numbers in the stat strip.
- **Title** (650, 14.5px, -0.01em): card and section headings.
- **Body** (400, 14px, 1.45): base text; most UI text runs at 12.5–13.5px with weights of 550–650 for emphasis.
- **Label** (700, 11.5px, 0.05em, uppercase): form field labels and group headers.
- **Reference** (JetBrains Mono, 12px): reference numbers, policy numbers, amounts in dense tables.

### Named Rules
**The Tabular Money Rule.** Amounts, counts and dates in lists use tabular figures so columns line up.

**The Small But Weighted Rule.** At 12–13px, emphasis comes from weight steps (550, 650, 700), not from size jumps or colour.

## Layout

A fixed left sidebar (262px drawer on small screens, collapsible to an icon rail) beside a scrolling content column on the Morning Desk. Screens open with a page header (icon tile, title, one-line subtitle, actions on the right), an optional stat strip, then cards. Contact profiles and records use a main column of cards with a narrower side column for tracking cards.

Spacing is tight inside a card and generous between cards: cards pad 18px horizontally with 14–15px vertical rhythm, sibling controls sit 8–12px apart, and cards and header blocks are separated by 12–18px. The layout steps down at 1200px, 900px (sidebar becomes a drawer, four-up strips become two-up) and 640px.

## Elevation & Depth

Layered. Surfaces sit on the desk with a hairline border and a small ambient shadow at rest; only floating layers (menus, popovers, modals, the mobile drawer) take the deep pop shadow. Shadows are tinted with the ink colour, not pure black, in light mode; dark mode uses deeper black shadows and leans on its lighter surfaces for separation.

### Shadow Vocabulary
- **Resting card** (`shadow-sm`): every card and stat tile.
- **Lift** (`shadow-md`): hovered or raised elements that stay in the page.
- **Overlay** (`shadow-pop`): menus, popovers, dialogs, the mobile drawer.
- **Primary press** (`0 1px 2px rgba(4,120,87,0.25)`): the small green-tinted lift under the primary button.

### Named Rules
**The Rest Then Float Rule.** In-page surfaces only ever take the resting shadow. The deep shadow is reserved for things that float above the page.

## Shapes

Gently rounded throughout: 14px for cards and dialogs, 10px for buttons and inputs, 7px for small buttons, navigation items and icon tiles, and full pills only for status chips, count pills and badges. Borders are always a full 1px line; there are no one-sided accent bars.

## Components

### Buttons
Tactile and confident: a clear fill, a clear hover, and a disabled state that cannot be mistaken for available.
- **Shape:** gently rounded (10px); the small size (30px tall) uses 7px.
- **Primary:** Policy Green fill with white text, 36px tall, 14px side padding, a faint green lift shadow. Hover deepens to Policy Green Deep.
- **Default:** white fill, strong line border, ink text; hover takes the hover surface.
- **Ghost:** no border or fill until hover.
- **Focus:** a 3px soft Policy Green ring on keyboard focus.
- **Disabled primary:** drops the green entirely to a recessed grey fill with subtle text, so a blocked "Create" next to a "Still needed" list reads as off.

### Chips (status pills)
- **Style:** full pill, 22px (20px dense), tinted wash background, matching border, base-colour text at weight 650, optional leading dot.
- **State:** one tone per status, assigned centrally so the same status always reads the same colour.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Card White on the Morning Desk.
- **Shadow Strategy:** resting shadow (see Elevation & Depth).
- **Border:** 1px line; the heading row is divided from the body by a soft line.
- **Internal Padding:** 18px sides; 15px heading row, 14px body.

### Inputs / Fields
- **Style:** 36px tall, white, strong line border, 10px corners, 13.5px text, with an uppercase 11.5px label above and an optional faint hint below.
- **Focus:** border turns Policy Green with a 3px soft green ring.
- **Error / Disabled:** errors are stated in red text under the field; disabled controls dim.

### Navigation
- **Style:** 37px rows with an 18px icon and 13.5px label at weight 550, 7px corners.
- **Active:** Policy Green Wash background, Policy Green Deep label, Policy Green icon, and `aria-current="page"`.
- **Hover:** hover surface with ink text. Counts sit in small pills on the right; on the collapsed rail they shrink to a dot.

### Page header
An icon tile (34px, 9px corners, Policy Green Wash with a deep-green icon) beside the 23px headline and a one-line muted subtitle, with actions aligned to the right.

## Do's and Don'ts

### Do:
- **Do** use Policy Green for the single primary action on a surface and for the current place; nothing else.
- **Do** report record state with the status pill tones, assigned centrally, never ad hoc.
- **Do** keep every text grey at 4.5:1 or better on cards and the desk, in both themes.
- **Do** use tabular figures and the mono face for amounts, counts and reference numbers in lists.
- **Do** give every control visible hover, keyboard focus and disabled states.

### Don't:
- **Don't** make it look like a generic CRM: no grid of identical icon-plus-number tiles as a page structure, no decorative charts standing in for real status.
- **Don't** add a second accent colour or use status colours as decoration.
- **Don't** dim a blocked primary action; remove its fill.
- **Don't** put the deep overlay shadow on in-page cards, or stack a wide shadow under a bordered card.
- **Don't** use one-sided coloured bars on cards or rows; use a full border, a tint or a status pill.
