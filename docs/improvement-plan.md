# NPS Finance — Improvement Plan

> **Layunin:** gawing production-grade ang kasalukuyang **frontend demo** ng NPS
> Finance — mula clickable prototype → tunay na gamit-araw-araw na system,
> naka-align sa NPS Registrar v2 (parehong brand, stack, at style).

- **Petsa:** 2026-10-13
- **Kasalukuyang estado:** clickable demo (static HTML + vanilla JS), 2 module
  (Collections/Cashier at Disbursement/Books), mock data sa `localStorage`.
- **Reference:** [`legacy-accounting-analysis.md`](legacy-accounting-analysis.md)
- **Audience:** dev team + owner

---

## Guiding Principles (huwag kalimutan)

1. **Cashier ang pilot.** Dito ang araw-araw na trabaho — ito ang unang gawing matatag.
2. **Debit = Credit, sagrado.** Bawal makapag-save ng hindi balanse. Palawakin pa.
3. **Less is better.** Automation ng *umiiral* na feature muna bago mag-imbento ng bago.
   I-verify sa luma (F1–F6) bago magdagdag.
4. **Isang sistema.** Tularan ang Registrar v2 (palette, fonts, logo, auth, stack)
   para pwede silang pagsamahin balang-araw.
5. **Audit-ready.** Pera ang hawak — kailangan ng trail, void controls, at tamang numbering.

---

## Phase 0 — Polish & Fixes (quick wins)

| # | Item | Status |
|---|---|---|
| 0.1 | **Sidebar hover contrast bug** (hover pill halos invisible) | ✅ Fixed |
| 0.2 | Accessibility pass — focus-visible rings, ARIA (nav/dialog/live), skip link, landmarks, reduced-motion | ✅ Done |
| 0.3 | Empty states + saving feedback (toast now `role=status` / `aria-live`) | ✅ Done |
| 0.4 | Keyboard shortcuts sa Cashier (Enter in search = pili first match; Enter in amount = receive; Esc = close) | ✅ Done |
| 0.5 | Number input guards (`min=0`, clamp negatibo/NaN, reject negative lines) | ✅ Done |
| 0.6 | Confirm dialog bago ang irreversible na **Post to Books** (+ Reset) | ✅ Done |

> **Note (contrast):** `ink-muted` (#8a8478) small text ay malapit lang sa AA — ginagamit
> lang sa maliliit na caption, hindi sa kritikal na info. Full WCAG AA re-tune ng palette
> ay hiwalay na task kung kailanganin (nakatali sa registrar brand).

---

## Phase 1 — Cashier Hardening (Module A)

Palawakin ang cashier papuntang tunay na operasyon. Marami ditong galing sa
**feature inventory ng luma** na kailangang i-verify muna (tingnan ang open questions).

| # | Feature | Mula sa luma | Status sa demo |
|---|---|---|---|
| 1.1 | OR numbering control (Set OR, gap detection, no reuse) | ✅ screen | Partial (Set OR lang) |
| 1.2 | Installments + due-date tracking (Load Due / Load Balance) | ✅ screen | Partial |
| 1.3 | Partial payments + allocation rules (oldest-first/manual) | — | ✅ oldest-first |
| 1.4 | **Void / correct OR** (with reason + audit trail) | ❓ | ⬜ |
| 1.5 | **Promis** — promissory note (print + tracking) | ❓ verify | ⬜ |
| 1.6 | **Grant / LM** — scholarship/discount application | ❓ verify | ⬜ |
| 1.7 | **OLD** — back accounts / old students | ❓ verify | ⬜ |
| 1.8 | **Summer** — summer-term billing | ❓ verify | ⬜ |
| 1.9 | Statement of Account (print) | ✅ | ✅ (demo) |
| 1.10 | Payment methods bukod sa cash (check, bank, GCash) | ❓ | ⬜ cash only |
| 1.11 | Daily Collection Report (DCR) + cashier Z-reading / shift close | — | Partial (reports) |

---

## Phase 2 — Books Depth (Module B)

| # | Feature | Status |
|---|---|---|
| 2.1 | Chart of Accounts **CRUD** (idagdag/i-edit, per-type, active/inactive) | ⬜ (view only) |
| 2.2 | Payee **CRUD** | ⬜ (view only) |
| 2.3 | CDB voucher — approval workflow (Prepared → Approved → Released) | ⬜ |
| 2.4 | Check printing — tamang template/alignment per bank | Partial (doc) |
| 2.5 | JVB — recurring/templated adjustments (depreciation, accruals) | ⬜ |
| 2.6 | **Subsidiary ledgers** (per account, per payee) | ⬜ |
| 2.7 | **General Ledger** + **Trial Balance** (dapat laging balanse) | ⬜ |
| 2.8 | Voucher series control (gaps, cancellation, per-year prefix) | Partial |

---

## Phase 3 — Integration & Reporting

| # | Item | Status |
|---|---|---|
| 3.1 | **Collections → CRB** auto-post na may kontrol (batch, lock after post) | ✅ demo (manual button) |
| 3.2 | I-verify kung **automatic o manual** dapat ang pagpasa (F3) | ❓ |
| 3.3 | Exports — CSV/Excel/PDF ng DCR, Summary, CRB/CDB/JVB | ⬜ |
| 3.4 | **Period close + year-end rollover** (carry forward balances) | ⬜ |
| 3.5 | Financial statements — Income Statement, Balance Sheet (basic) | ⬜ |
| 3.6 | Reconciliation — bank reco, cash count vs CRB | ⬜ |

---

## Phase 4 — Productionization (gawing tunay na app)

| # | Item | Bakit |
|---|---|---|
| 4.1 | Port sa **React + Vite + Tailwind** (gaya ng Registrar v2) | Para pareho + maintainable; magagamit muli ang shadcn UI ng registrar |
| 4.2 | Backend sa **Supabase/Postgres** | Multi-user, durable, hindi `localStorage` |
| 4.3 | **Auth + roles** — Cashier / Bookkeeper / Admin | Segregation of duties (pera) |
| 4.4 | **Audit log** — sino, kailan, anong binago (OR, voucher, COA) | Compliance + accountability |
| 4.5 | Backups + data export; print-server/PDF templates | Business continuity |
| 4.6 | PWA / offline-tolerant cashier (parang QUEBO POS) | Gumana kahit putol ang internet |

---

## Open Questions (i-verify sa luma bago mag-build)

Galing sa [`legacy-accounting-analysis.md`](legacy-accounting-analysis.md) §6:

- **F1** — Napalitan ba ang labels ng 2 screenshots? (Collections vs Disbursement)
- **F2** — Ano ang **Promis / Grant / LM / OLD** buttons?
- **F3** — Collections → Books: **automatic o manual** re-encode?
- **F4** — Paano/kailan ginagamit ang **JVB**?
- **F5** — Kailangan ba ang **kopya ng Chart of Accounts** mula sa luma?
- **F6** — Paano gumagana ang **Summer** tab?

---

## Inirerekomendang Unang Sprint (2 linggo)

1. **Phase 0** buo (polish + accessibility) — mabilis na pagandahin ang demo para sa owner walkthrough.
2. **Verify F1–F6** kasama ang owner (kailangan bago mag-build ng Phase 1 features).
3. **Kunin ang totoong Chart of Accounts + Payee list** mula sa luma (foundation data).
4. Pumili: mag-continue sa current vanilla demo para sa cashier pilot, **o** mag-port na agad sa React/Supabase (Phase 4.1–4.2) bago palawakin — **arkitektura decision na kritikal**, dapat desidido bago ang Phase 1.

> **Rekomendasyon:** gawin muna ang Phase 0 + verification habang pinag-uusapan ang
> stack. Kung sigurado nang production ang direksyon, mas mabuting mag-port na agad
> sa React/Supabase bago magdagdag ng features — para hindi dobleng trabaho.
