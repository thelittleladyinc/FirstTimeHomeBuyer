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
