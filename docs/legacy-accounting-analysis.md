# NPS Finance — Buod ng Naintindihan sa Lumang Accounting System

> **Layunin ng dokumentong ito:** itala ang pagkakaintindi sa lumang NPS Accounting
> system (mula sa decompiled na `.exe` at mga screenshot) bilang pundasyon ng
> disenyo ng bagong **NPS Finance**. Hindi pa ito final spec — may mga bahaging
> kailangang i-verify muna (tingnan ang [Mga Dapat I-verify](#mga-dapat-i-verify)).

- **Petsa:** 2026-10-13
- **Scope:** Finance / Accounting lang (hiwalay sa Registrar)
- **Audience:** dev team na magtatayo ng bagong system

---

## 1. Dalawang Magkadugtong na Bahagi

Ang Accounting ng NPS ay may **dalawang module na magkabit**:

| Module | Tawag sa luma | Trabaho | Daloy ng pera |
|---|---|---|---|
| **A. Collections / Cashier** | `[Accounting]` module | enrollment, cashier, add charges, reports | **PAPASOK** ang pera |
| **B. Disbursement / Books** | `[Books]` module (CRB/CDB/JVB) | vouchers, checks, pormal na accounting records | **LALABAS** ang pera |

**Ang tulay sa pagitan nila:** ang *collection reports* (detailed at summary) ay
ipinapasa mula Collections papunta sa Disbursement/Books side. Dahil ganito ang
hati ng luma, malamang ganito rin ang hati ng bago.

> ⚠️ **Tama ang hati, ngunit baligtad ang label sa 2 screenshots** — tingnan ang
> [Mga Dapat I-verify](#mga-dapat-i-verify).

---

## 2. Big Picture: Daloy ng Pera

### Pera PAPASOK (Collections)

```
Parent/Student magbabayad
        │
        ▼
CASHIER screen
  • hanapin ang student
  • tingnan ang dues / balance
  • tanggapin ang bayad
  • i-print ang OR
        │
        ▼
COLLECTION REPORTS
  • Detailed : name, account, amount, date, invoice no.
  • Summary  : account, totals
        │
        ▼
  ipinapasa sa Disbursement / Books side  (paano? — i-verify)
```

### Pera PALABAS (Disbursement)

```
Gastos ng school (equipment, supplier, atbp.)
        │
        ▼
CASH DISBURSEMENT VOUCHER
  • Voucher No.
  • Pay To
  • account code
  • Debit / Credit  (dapat BALANSE)
        │
        ▼
PRINT: Voucher + Check
        │
        ▼
  naitala sa Books (CDB)
```

**Pangunahing tanong sa daloy:** paano *eksaktong* naipapasa ang collection reports
sa Books side — **automatic ba sa system o manual na re-encode?** (→ i-verify)

---

## 3. Module A — Collections / Cashier Side

> Mula sa notes: *"cashier, receive, add charge, enrollment… dito papasok ang pera."*
> Source: screenshot ng `[Accounting -2026-27]` module.

### Mga nakita sa screen

| Element | Kahulugan / gamit |
|---|---|
| Tabs: Student Enrollment, Cashier, Add Charges, Report, Summer, Student LM | sakop mula enrollment hanggang pagbabayad |
| **OR No.** field + **Set OR** button | kontrol sa OR numbering |
| Student No., Name, Grade, Section | hanapin muna ang estudyante bago tumanggap ng bayad |
| **Ledger** + **Add Charge** buttons | talaan ng singil/bayad; pwedeng magdagdag ng singil |
| Particulars / DueDate / Amount / Due columns + **Load Due** / **Load Balance** | installment / due-date tracking |
| **Amount Tendered** + **Change** | kino-compute ang sukli; cash ang pangunahing bayad |
| **Statement** button | naka-built-in ang pag-print ng Statement of Account |
| **School Year** selector (2026-27) | hiwalay ang data kada school year |

### Mga button/field na kailangang i-verify

- **Promis** — posibleng *promissory note*
- **Grant** / **LM** fields — posibleng *scholarship / grant*
- **OLD** button — posibleng *old students* o *back accounts*
- **Summer** tab — summer-term billing(?)

### Reports na galing sa Collections

- **Detailed report** — name, account, amount, date, invoice number
  *(parang Daily Collection Report, may bawat transaction)*
- **Summary report** — account + totals *(kabuuan kada account/category)*

---

## 4. Module B — Disbursement / Books Side

> Mula sa notes: *"Debit, Credit… Input: account, amount… Print: voucher, check."*
> Source: screenshot ng `[Books]` module.

### Mga nakita sa screen

| Element | Detalye |
|---|---|
| Tabs: **CRB, CDB, JVB**, Chart of Accounts, Payee, Report | ang pormal na accounting books |
| Cash Disbursement Voucher form | Voucher No. (hal. `26-029562`, year-prefixed series), Date, Check No., Check Date, Pay To Code / Pay To, Remarks |
| Entry lines | Code + Particulars + Type (D/C) + Debit + Credit |
| Sample entry | `589 EQUIPMENT` → Debit 50,000.00 · `3444 CIB-PNB` → Credit 50,000.00 |
| Amount-in-words (automatic) | "FIFTY THOUSAND PESOS…" para sa check/voucher printing |
| Total row | 50,000.00 = 50,000.00 — dapat **BALANSE** |

### Mga konseptong kailangang maintindihan ng team

| Termino | Kahulugan |
|---|---|
| **CRB** — Cash Receipts Book | talaan ng lahat ng **PUMAPASOK** na pera. Dito malamang pumupunta ang collections data. |
| **CDB** — Cash Disbursement Book | talaan ng lahat ng **LUMALABAS** na pera. Ang voucher sa screenshot ay entry dito. |
| **JVB** — Journal Voucher Book | mga entry na **hindi** cash in/out: adjustments, corrections. *(i-verify kung paano/kailan)* |
| **Chart of Accounts** | master list ng account codes (`589` = EQUIPMENT, `3444` = CIB-PNB = "Cash in Bank – PNB"). Lahat ng entries nakatali dito. **KUNIN ANG KOPYA.** |
| **Payee** | master list ng mga binabayaran (suppliers, atbp.) |
| **Debit / Credit** | dalawang panig ng bawat entry. **GOLDEN RULE: total Debit = total Credit, palagi.** Bawal makapag-save ng hindi balanse. |
| **Voucher** | dokumentong nag-a-authorize at nagre-record ng paglabas ng pera; may sariling numbering series. |

---

## 5. Implikasyon sa Disenyo ng Bagong System

- [ ] **Dalawang module**, gaya ng luma: (A) Cashiering/Student Accounts at (B) Books/Disbursement.
- [ ] **Module A ang pilot** — dito ang araw-araw na trabaho.
- [ ] **Pinaka-kritikal na integration point:** ang collections data ay dapat *dumaloy
      (o madaling ma-export)* papunta sa Books side — sa **detailed at summary** formats.
- [ ] **OR numbering** (Collections) at **voucher numbering series** (Books) — parehong
      tuloy-tuloy at may kontrol.
- [ ] **Chart of Accounts** bilang foundation data ng Books side.
- [ ] **Debit = Credit validation** — built-in; bawal mag-save ng hindi balanse.
- [ ] **Per-school-year na data** — isipin ang **year-end rollover**.
- [ ] **I-inventory isa-isa** ang mga feature ng lumang cashier screen (Promis, Grant,
      LM, OLD, Summer) bago magdesisyon sa v1 scope.

---

## 6. Mga Dapat I-verify

> ⚠️ **Posibleng nagkapalit ang label ng 2 screenshots:**
> - Ang naka-label na *"Collections UI"* ay nagpapakita ng **CASH DISBURSEMENT
>   VOUCHER** (paglabas ng pera → `[Books]` module).
> - Ang naka-label na *"Disbursement UI"* ay nagpapakita ng **CASHIER SCREEN**
>   (OR No., Student No., Amount Tendered, Change → pagpasok ng pera →
>   `[Accounting]` module).

| # | Tanong | Saan nakita |
|---|---|---|
| F1 | Napalitan ba talaga ang label ng 2 screenshots? | §1, §2 |
| F2 | Ano ang **Promis / Grant / LM / OLD** buttons sa cashier screen? | §3 |
| F3 | **Automatic ba o manual** ang pagpasa ng collection reports sa Books side? | §2 |
| F4 | Paano at kailan ginagamit ang **JVB**? | §4 |
| F5 | Kailangan bang makuha ang **kopya ng Chart of Accounts** mula sa luma? | §4 |
| F6 | Paano gumagana ang **Summer** tab / summer billing? | §3 |

---

## 7. Susunod na Hakbang

1. I-verify ang mga tanong sa §6 (lalo na F1 at F3 — kritikal sa arkitektura).
2. Kunin ang kopya ng **Chart of Accounts** at **Payee** list mula sa luma.
3. I-catalog nang detalyado ang cashier screen (Module A) — ito ang pilot.
4. Pagkatapos ng catalog, saka magdisenyo ng v1 scope.
