# OwnInNoCo (owninnoco.com)

Static site on Netlify. The homepage quiz (`#quiz` in `index.html`) posts to the
Command Center (`https://bold-collective-command-center.onrender.com/api/quiz-lead`),
which files the lead in Lofty. See `CLAUDE.md` for the standing rules.

## Tests

No build step and no dependencies. With Node 18+:

```bash
node --test tests/*.test.js
```

## The quiz: what is captured and when

| Moment | What happens |
|---|---|
| Visitor first touches the quiz | Meta `ViewContent` (`content_name: NoCo Quiz`), Google `quiz_start` |
| A valid email or phone has been typed | Meta custom `QuizStarted`, Google `quiz_contact_entered` |
| "Are you pre-approved?" = **Not yet** | Meta custom `NotPreApproved`, Google `not_pre_approved` |
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
