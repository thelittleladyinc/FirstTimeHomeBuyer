# owninnoco.com

Static site for the Northern Colorado Homeownership Score quiz (Christine Gwinnup, The Little
Lady Sells Homes, LPT Realty). Netlify publishes the repository root from `main`; there is no
build step. Standing rules for this repo live in [CLAUDE.md](CLAUDE.md).

## The quiz

The quiz is in `index.html` (`#quiz`). It posts to the command-center receiver
(`bold-collective-command-center.onrender.com/api/quiz-lead`), which saves the lead and files
it in Lofty. After a successful submit the results screen shows **Programs you may qualify
for**, matched to the visitor's own answers.

| File | What it is |
|---|---|
| `data/dpa-programs.json` | Program list: name, administrator, who it's for, key rules, income-limit source and as-of date, credit minimum, homebuyer-education requirement, maximum assistance, official URL, sources, `last_verified` |
| `assets/dpa-match.js` | Matching rules (browser and Node) |
| `scripts/dpa-programs.mjs` | Validate the data file and mark programs re-verified |
| `scripts/dpa-match.test.mjs` | Tests for the matcher and the data file |

The names of the matched programs go to the command center in the `matched_programs` form field
(semicolon-separated), along with the two optional answers `targetArea` and `occupation`. The
receiver ignores fields it does not know, so those three are sent but not stored.

For the command center's lender-intro card (`lib/lender-handoff.js`), the quiz also sends
`preApproved` (`yes` / `no` / `unsure`; `no` is what marks a lead "not pre-approved yet") and
`area` (the target-area answer as a town name, e.g. "Fort Collins"). The quiz has no budget
question, so no `priceRange` is sent.

### Matching rules (conservative on purpose)

- Everything is worded "you may qualify, confirm with a lender". A program is hidden only when
  an answer clearly rules it out: a credit band entirely below the program minimum, a
  first-time-only program for a current owner, a veteran-only loan for a non-veteran, or a local
  program for a different area.
- Nothing matches on a protected characteristic. Programs whose eligibility depends on one
  (disability, housing-voucher/source of income, race) are not matched. Employment-based
  programs (CHFA Schools To Home, HUD Good Neighbor Next Door) match only on the optional
  "Work in one of these fields?" answer, because the programs themselves are employment-based.
- The quiz does not ask about income or household size, so income limits are shown as a rule
  with a link to the official limits and are never used to include or hide a program.

## Updating the program list

1. Open `data/dpa-programs.json` and edit the program. Every figure must come from the
   program's **official** page (the administrator's own site). If you can't confirm a figure
   there, remove it and leave the link. Never estimate.
2. Put the page(s) you used in `sources`. For income limits, set `income_limit.source` and
   `income_limit.as_of` (the effective date printed on the limits).
3. Record the check:
   ```bash
   node scripts/dpa-programs.mjs verified chfa-dpa-grant chac-dpa   # the ids you re-checked
   ```
4. Validate and test:
   ```bash
   node scripts/dpa-programs.mjs check
   node --test scripts/*.test.mjs
   ```
5. To add a city or town, add it to `areas` in the JSON **and** as an `<option>` in the
   `targetArea` select in `index.html` (same key).
6. Programs that were checked and deliberately left out, with the reason, are in `not_listed`.
   Look there before adding something back.

## Monthly reminder: re-verify the programs

**On the 1st of every month**, run `node scripts/dpa-programs.mjs check`. It lists every
program whose `last_verified` is more than 31 days old, with the official links to re-check.
Open each link and confirm the amounts, credit minimum, first-time rule and income-limit date
still match. Fix anything that changed, then mark it verified (step 3 above) and open a PR.
CHFA usually publishes new income limits once a year; when the effective date on its income-limit
PDF changes, update every `income_limit.as_of` that points to it.

Last full review: 2026-09-27.

## Tests

No build step and no dependencies. With Node 18+:

```bash
node --test tests/*.test.js scripts/*.test.mjs
```

## Funnel events and partial capture

| Moment | What happens |
|---|---|
| Visitor first touches the quiz | Meta `ViewContent` (`content_name: NoCo Quiz`), Google `quiz_start` |
| A valid email or phone has been typed | Meta custom `QuizStarted`, Google `quiz_contact_entered` |
| "Are you pre-approved?" = **Not yet** (`no`) | Meta custom `NotPreApproved`, Google `not_pre_approved` |
| They leave the page, or do nothing for 60 s, without submitting (and a valid email/phone is in) | `assets/quiz-capture.js` sends what they typed (name, email, phone, the answers they changed, page, UTM tags) with `navigator.sendBeacon` to `/api/quiz-lead/partial`. The Command Center creates **one** Lofty lead tagged `Source – NoCo Quiz` + `Quiz – Started` — never the SMS consent tag. |
| Full submit, confirmed by the Command Center | Meta `Lead`, Google `generate_lead`. If a partial was sent earlier, the same Lofty lead is updated (`Quiz – Started` → `Quiz – Completed`). |

- The text-message consent box is **unticked by default**. Leaving it unticked still creates
  the lead in Lofty (call/email only); only a ticked box adds `Consent – SMS Opt-In`.
- Visitors see "We save your answers as you go so you don't lose your progress." under the
  email field; the Privacy Policy explains it.
- **No personal data goes to Meta or Google.** No event carries a name, email, phone, answer
  text or a hash of any of them, and the pixel has no Advanced Matching. Keep it that way.
- The Meta pixel is `785995940287531` only. Never `1292637128972060` (hacked account).

## Audiences to create

Housing ads fall under Meta's **Housing Special Ad Category** and Google's **housing
personalized-ads** rules. Build these audiences from **site behaviour only** — the events
above. Do not add age, gender, ZIP code or other demographic/location narrowing on top of
them, and do not build lookalike audiences from them. Meta and Google change these rules;
Ads Manager will refuse a combination that is not allowed, so follow what it says.

### Meta (Events Manager → Audiences → Create a Custom Audience → Website, pixel 785995940287531)

| Audience name | Include | Exclude | Retention | Use for |
|---|---|---|---|---|
| OwnInNoCo – Visited, didn't finish | All website visitors (or `ViewContent`) | `Lead` | 30 days | Remarketing: "Your 60-second score is waiting" |
| OwnInNoCo – Started quiz | `QuizStarted` | `Lead` | 14 days | Remarketing: finish your roadmap |
| OwnInNoCo – Finished quiz | `Lead` | — | 180 days | Exclude from quiz ads; next-step content (seminar, booking) |
| OwnInNoCo – Needs a lender | `NotPreApproved` | — | 60 days | Pre-approval education content |

Custom events (`QuizStarted`, `NotPreApproved`) appear in Events Manager after they first fire;
pick them under "Events" when creating the audience.

### Google (GA4 property G-76NN5P55H2 → Admin → Audiences; linked to Google Ads AW-16452139344)

| Audience name | Condition | Exclude | Membership |
|---|---|---|---|
| OwnInNoCo – Visited, didn't finish | event `quiz_start` (or all users) | event `generate_lead` | 30 days |
| OwnInNoCo – Started quiz | event `quiz_contact_entered` | event `generate_lead` | 14 days |
| OwnInNoCo – Finished quiz | event `generate_lead` | — | 180 days |
| OwnInNoCo – Needs a lender | event `not_pre_approved` | — | 60 days |

Also mark `generate_lead` as a **key event** in GA4, and make sure GA4 is linked to Google Ads
(Admin → Product links) so the audiences can be used in campaigns. The same events also reach
the Google Ads tag directly.
