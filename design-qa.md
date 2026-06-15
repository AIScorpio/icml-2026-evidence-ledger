# ICML 2026 Evidence Ledger Design QA

## Visual Truth

- Selected source: `qa/source-mock.png`
- Final implementation: `qa/repaired-desktop-1280.jpg`
- Full-view comparison: `qa/repaired-comparison.jpg`
- Focused rail and comparison-workspace comparison: `qa/repaired-focused-comparison.jpg`
- Expanded evidence state: `qa/implementation-expanded.png`
- Comparison tray state: `qa/implementation-comparison-tray.png`
- Mobile state: `qa/implementation-mobile.png`
- Mobile filter state: `qa/implementation-mobile-filter.png`

## Viewports And States

- Desktop source: 1487 x 1058.
- Desktop implementation: 1280 x 720 production preview; standalone behavior checked separately.
- Mobile implementation: 390 x 844.
- States checked: default ledger, desktop rail open/closed, search result, method filter, ascending/descending sort, expanded evidence lineage, comparison open/closed, empty comparison guidance, detail drawer, saved queue persistence, methodology dialog, and mobile filter drawer.

## Comparison Findings

- Layout and hierarchy: passed after repair. The taxonomy rail now matches the source's narrow proportion, the evidence rows use the source's denser rhythm, and the comparison workspace remains visible at the bottom of the viewport.
- Typography: passed. Serif paper titles and compact sans-serif controls reproduce the editorial research-ledger hierarchy without sacrificing scanability.
- Color and surfaces: passed. Cobalt links and controls, copper banking-transfer signals, green evidence indicators, pale ruled surfaces, and restrained borders match the selected direction.
- Content fidelity: passed. Illustrative paper names, counts, and evidence claims were replaced with official ICML catalogue records and explicitly labelled deterministic classification evidence.
- Icons: passed. Font Awesome is used consistently; visible icon-only controls have accessible labels.
- Responsiveness: passed. Desktop and 390-pixel mobile views avoid overlap and clipping; the filter rail becomes an accessible drawer.
- Interaction coverage: passed. `Filters` now collapses the desktop rail and opens a scrim-backed mobile drawer. `Compare` now shows or hides the fixed comparison workspace, supports one to three row selections, and explains the selection workflow when empty. Sort direction now changes the actual ordering.
- Accessibility: passed. Semantic controls, labels, focus states, practical mobile targets, and reduced-motion styling are present.

## Patches Made During QA

- P1: constrained the topic-flow canvas and grid so it could not expand the document height.
- P1: exposed the mobile Filters control and implemented the mobile filter drawer.
- P1: fixed standalone bundling where script terminators in paper text could prematurely close the inline module.
- P1: fixed JavaScript replacement-token corruption during asset inlining.
- P2: separated direct banking evidence from high-priority transfer relevance in both the classification record and UI labels.
- P2: added accessible names to filter, methodology, and paper-detail close controls.
- P1: repaired the previously inert `Compare` toolbar control and added an explicit empty-selection state.
- P1: repaired the previously ineffective desktop `Filters` control and synchronized drawer state across viewport changes.
- P1: moved the comparison workspace to the viewport bottom and seeded it with the two highest-priority papers, matching the selected mock's initial state.
- P2: narrowed the taxonomy rail, shortened display labels, reduced table row height, and added selected-row treatment to match the source density.
- P2: made the visible sort-direction control functional.

## Residual Notes

- The standalone file is intentionally about 21 MB because all 6,631 abstracts and classifications are embedded for offline use.
- Banking relevance is a triage hypothesis, not a paper-quality score or production-readiness assessment.
- The final implementation uses verified catalogue data rather than reproducing unsupported mock metrics or source-code claims.

final result: passed
