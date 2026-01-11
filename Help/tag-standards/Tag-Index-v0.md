# Tag Index (Canonical Vocabulary) — v0

## How to read this
- **Subject tags (no prefix):** broad umbrella topics (low-fidelity, stable)
- **Facet tags:** `#f/<dimension>/<value>` (for cross-cutting combinations in reports)
- **Experience tags:** `#x/<experience>` (how it felt / how it went)
- **Workflow cue tags:** `#w/<cue>` (high-fidelity review/action signals)

## Global formatting rules
- lowercase only
- hyphens for multiword values (e.g., `lesson-learned`, `san-diego`)
- `/` only for namespaces and facet dimensions (do not invent other hierarchies)
- avoid people names, project codenames, or dates in tags (this project is tags-only and topical)

---

## A) Subject tags (umbrella topics)
Use these as the primary "what is this about?" labels. Prefer 1 subject tag per note (0–2 max).

- #vacation
  - Use when: leisure trips and time off (umbrella for beach/roadtrip/Disneyland, etc.)
  - Avoid when: strictly business travel → consider `#travel` + facets

- #travel
  - Use when: travel logistics, trips generally (especially business travel)
  - Related: `#vacation`

- #family
  - Use when: family life, parenting, family decisions, family events

- #relationships
  - Use when: relationship dynamics, friendship/partner themes, communication patterns

- #health
  - Use when: medical, wellbeing, mental/physical health

- #fitness
  - Use when: workouts, training, exercise routines, performance goals

- #finance
  - Use when: budgeting, spending, saving, taxes, big purchases

- #home
  - Use when: house, chores, home projects, household logistics

- #work
  - Use when: general work themes that aren't better captured by a facet domain

- #learning
  - Use when: studying, skill-building, reading-for-skill, courses

- #productivity
  - Use when: systems, habits, time management, process improvement

(You will add more subject tags only when necessary; keep subjects broad.)

---

## B) Facet dimensions (choose from these first)
Facets are the "filters" that make combination reports powerful. Prefer 1–3 facets per note.

### #f/context/<value>
- #f/context/personal
- #f/context/business

### #f/domain/<value>  (use for business themes without exploding subject tags)
Suggested values:
- sales, marketing, operations, finance, product, engineering, hiring, legal, strategy, customer-success

### #f/activity/<value>
Suggested values (extend as needed):
- planning, meeting, writing, exercise, cooking, cleaning, travel, hiking, beach, roadtrip, researching, brainstorming, presenting

### #f/place/<value>
- Cities/regions/venues as needed (slugged): `#f/place/san-diego`, `#f/place/disneyland`

### #f/with/<value>  (groups/roles only; no individuals)
Suggested values:
- solo, family, spouse, kids, friends, team, client

### #f/channel/<value>
Suggested values:
- in-person, call, video-call, email, chat, text

### #f/outcome/<value>  (more "objective" than experience)
Suggested values:
- improved, resolved, stalled, escalated, completed, delayed, exceeded-expectations, underwhelming

(If you feel you need a new facet *dimension*, propose it explicitly; otherwise add a new *value* under an existing dimension.)

---

## C) Experience tags (reusable across business + personal)
Use 0–2 per note.

- #x/joy
- #x/excitement
- #x/calm
- #x/gratitude
- #x/connection
- #x/confidence
- #x/relief

- #x/stress
- #x/anxiety
- #x/overwhelm
- #x/fatigue
- #x/frustration
- #x/disappointment
- #x/regret
- #x/uncertainty

Guideline: choose the smallest number of experience tags that capture the "tone."

---

## D) Workflow cue tags (high-fidelity signals)
Use when present; 0–2 typical (sometimes more for planning/review notes).

- #w/decision
- #w/follow-up
- #w/open-loop
- #w/lesson-learned
- #w/idea-to-try
- #w/question
- #w/risk
- #w/blocker
- #w/next-step
- #w/recap

Guideline: if the note contains something you'd want to revisit later, add the relevant `#w/` tag.

---

## E) Synonyms / redirects (anti-duplication rules)
When you see a near-duplicate, do NOT create a new tag—map it here.

Format: `alias -> canonical`

Examples (starter rules):
- holiday -> #vacation
- summer-vacation -> #vacation
- trip (leisure) -> #vacation
- trip (business) -> #travel
- followup -> #w/follow-up
- lessons-learned -> #w/lesson-learned
- idea -> #w/idea-to-try
- stressed -> #x/stress
- frustrating -> #x/frustration

(Add to this list as you go.)
