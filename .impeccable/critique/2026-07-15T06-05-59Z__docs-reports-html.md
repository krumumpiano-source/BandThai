---
target: docs/reports.html
total_score: 28
p0_count: 0
p1_count: 1
timestamp: 2026-07-15T06-05-59Z
slug: docs-reports-html
---
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Clear loading states, but relies heavily on text over visual feedback. |
| 2 | Match System / Real World | 4 | Excellent use of natural Thai terminology. |
| 3 | User Control and Freedom | 3 | Easy tab switching, but no obvious "reset filters" button. |
| 4 | Consistency and Standards | 3 | UI follows generic dashboard standards, though slightly repetitive. |
| 5 | Error Prevention | 3 | Read-only report, so user errors are minimal. |
| 6 | Recognition Rather Than Recall | 4 | All necessary summary info is visible without needing to memorize. |
| 7 | Flexibility and Efficiency | 3 | Date toggles are clear, but lacks keyboard shortcuts for switching views. |
| 8 | Aesthetic and Minimalist Design | 2 | Cluttered tables on mobile; overly relies on "hero-metric" SaaS templates. |
| 9 | Error Recovery | 2 | API failures may just show "ไม่มีข้อมูล" (No data) without context. |
| 10 | Help and Documentation | 1 | No inline tooltips explaining payroll implications for leave types. |
| **Total** | | **28/40** | **Good** |

#### Anti-Patterns Verdict
**LLM assessment**: The design falls heavily into the "AI/SaaS Dashboard" trap. It relies on the "hero-metric template" (big numbers with small labels in identical cards with colored top-borders) and identical card grids. While functional, it lacks a distinct brand identity. The tables use horizontal scrolling which degrades the mobile experience.

**Deterministic scan**: The CLI detector found 0 slop patterns in the markup itself, meaning the implementation is technically clean, but the architectural choices (card grids) are where the UX suffers.

#### Overall Impression
A solid, functional reporting dashboard that gets the job done but sacrifices mobile usability (due to wide tables) and brand personality (relying on generic SaaS card layouts). 

#### What's Working
1. **Clear Navigation**: The main tabs (Work vs Setlist) and period tabs (Week, Month, Year) are logically grouped.
2. **Information Density**: The summary cards successfully surface the most critical metrics immediately.

#### Priority Issues
- **[P1] Mobile Table Overflow**: The `report-table` uses `overflow-x: auto`. On phones, users must constantly swipe sideways to see earnings, losing context of the member name.
  - *Why it matters*: Reports are often checked on the go. Side-scrolling tables break the thumb-driven reading experience.
  - *Fix*: Adapt the table into a stacked card layout for mobile viewports, or freeze the first column.
  - *Suggested command*: `$impeccable adapt`
- **[P2] The "Hero-Metric" Cliché**: The overview cards (`.ov-card`) are standard SaaS boilerplate. 
  - *Why it matters*: It feels generic and misses an opportunity to reflect the band's actual identity.
  - *Fix*: Replace the identical card grid with a more editorial or uniquely structured summary section.
  - *Suggested command*: `$impeccable bolder`

#### Persona Red Flags
**Casey (Distracted Mobile User)**: 
- The horizontal scrolling table for daily details forces Casey to scroll right to see earnings, and then they can't see the date/day anymore. Will lead to misreading data on a phone.

**Alex (Power User)**:
- Must manually click through weeks/months. No keyboard shortcuts (like arrow keys) to quickly cycle through previous months' data.

#### Minor Observations
- The "shield-banner" provides a nice summarized text, but uses hardcoded colors (`#38a169`, `#d97706`) instead of pulling from the CSS variables.

#### Questions to Consider
- Does the manager really need to see all 7 columns on a mobile device, or could we hide "Breaks" on small screens to fit "Earnings" better?
- What if the overview wasn't cards, but a single clear sentence like "This month, you worked **12 days** (85% attendance) and earned **฿15,000**"?
