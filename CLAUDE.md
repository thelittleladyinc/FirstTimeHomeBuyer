# CLAUDE.md — FirstTimeHomeBuyer (OwnInNoCo)
> Read this entire file before writing a single line of code. These are standing rules that apply to every session, every task, every file.

---

## WHO YOU ARE WORKING FOR
- **Christine Gwinnup** — The Little Lady Sells Homes, REALTOR®, LPT Realty
- **Email:** thelittleladyinc@gmail.com | **Phone:** 303-709-4262
- **Kendra Bajcar** — Co-lead, Signature Property Collection | 970-571-0525
- **Weston Gilmore** — Preferred lender | 720-605-4757 | NMLS #2053641

---

## THIS REPO
**thelittleladyinc/FirstTimeHomeBuyer** — The OwnInNoCo website
- Live on Netlify at owninnoco.com
- Purpose: Rent-to-own funnel + first-time homebuyer lead capture for Northern Colorado
- Audience: People who can't qualify for a mortgage yet but want to own a home
- Feeds leads into: Lofty CRM → rent-to-own pipeline

---

## ACTIVE BRANCHES — READ BEFORE TOUCHING ANYTHING
| Branch | Purpose | Status |
|--------|---------|--------|
| `claude/migrate-domain-remove-30k-aBt0g` | AEO schema + domain migration | **DEFAULT BRANCH — merge priority** |
| `claude/nice-cerf-3o0ds` | JotForm quiz integration | PR open |

**Action required:** Merge `claude/migrate-domain-remove-30k-aBt0g` into main. Do not create new branches until this is resolved.

---

## JOTFORM — DO NOT REBUILD
- **Form ID:** 260648335652057
- **Form name:** "Colorado Rent-to-Own Options"
- This form is already built by Christine. Do NOT suggest replacing it, rebuilding it, or switching to a different form tool.
- Integration path: JotForm → Zapier → Lofty CRM → Rent-to-Own Pipeline

---

## TRACKING CODES
| Type | ID |
|------|----|
| GA4 | G-76NN5P55H2 |
| Meta Pixel | 785995940287531 |
| Google Ads Remarketing | AW-16452139344 (NOT YET INSTALLED — priority) |

**NEVER USE META PIXEL 1292637128972060 — HACKED ACCOUNT**

---

## THE 4 WEBSITES (Context — Don't Confuse)
| Site | Abbrev | Platform | Purpose |
|------|--------|----------|---------|
| thelittleladysellshomes.com | TLLSH | iHouseweb | Christine's primary brand |
| signaturepropertycollection.com | Signature | AgentFire | Luxury (Christine + Kendra) |
| boldcollectivehomes.com | Bold | Lofty | Team / first-time buyers |
| owninnoco.com | OwnInNoCo | Lofty widget | **THIS REPO** — Rent-to-own funnel |

---

## IDX RULE FOR THIS SITE
- OwnInNoCo uses a **Lofty search widget embed** — NOT full IDX
- Do not attempt to install a full IDX solution here
- The widget is embedded on search/listings pages only

---

## CROSS-LINKING RULES
- OwnInNoCo → Bold: **primary CTA on every page** — this is the top cross-link priority
- OwnInNoCo → TLLSH: contextual only, never on hot-lead-capture pages
- Never link OwnInNoCo → Signature (different audience entirely)

---

## NAP — USE EXACTLY, NEVER MODIFY
```
Name:    Christine Gwinnup – The Little Lady Sells Homes, REALTOR®, LPT Realty
Address: 2411 Glade Rd, Loveland, CO 80538
Phone:   303-709-4262
Email:   thelittleladyinc@gmail.com
```

---

## BRAND COLORS
```
#0A0A0A  — Black
#F5F0E8  — Cream
#B86F7A  — Mauve
#DEB3A5  — Rose Beige
#A7A9AC  — Platinum
```

---

## PLATFORM RULES
- **signaturepropertycollection.com = .com** — NEVER .co
- **Signature website platform = AgentFire** — never Lofty for Signature
- **StreetText is paid** — only issue is hacked pixel, not billing
- **Social cadence = minimum once per week per platform**

---

## STANDING INSTRUCTIONS — FOLLOW EVERY SESSION
1. Never use Meta Pixel 1292637128972060 — hacked
2. JotForm form 260648335652057 is already built — do not rebuild
3. Merge `claude/migrate-domain-remove-30k-aBt0g` before any other branch work
4. OwnInNoCo IDX = Lofty widget embed only, not full IDX
5. OwnInNoCo → Bold is the primary cross-link CTA on every page
6. Zero gaps policy — every deliverable fully optimized
7. Build it, then present — don't ask, just create

---

## PRIORITY FOR THIS REPO
1. Merge default branch PR
2. Install Google Ads remarketing tag AW-16452139344
3. JotForm → Zapier → Lofty connection
4. AEO schema implementation
5. Cross-link CTAs to boldcollectivehomes.com on every page

---

*Last updated: May 30, 2026*
