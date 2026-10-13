# NPS Finance — Frontend Demo

Clickable frontend demo ng dalawang module ng NPS accounting, base sa
[`docs/legacy-accounting-analysis.md`](docs/legacy-accounting-analysis.md).

Lahat ng data ay **mock** at naka-save lang sa `localStorage` ng browser.

## Paano patakbuhin

Buksan lang ang `index.html` sa browser — walang build step, walang npm.

Mas maganda via local server (para sigurado ang paths):

```bash
# kahit alin:
python -m http.server 8777      # tapos buksan http://127.0.0.1:8777
npx serve .
```

> Kailangan ng internet para sa Tailwind CDN (styling lang). Gagana pa rin ang
> logic kahit walang net, pangit lang ang itsura.

## Ano ang kasama

**A · Collections (pera papasok)**
- **Cashier** — hanapin ang student, tingnan ang ledger/balance, tanggapin ang
  bayad (amount tendered + change), i-print ang **Official Receipt**. May OR
  numbering control at Statement of Account.
- **Add Charges** — magdagdag ng singil sa ledger ng estudyante.
- **Collection Reports** — **Detailed** at **Summary**, at **Post to Books →**
  (dito dumadaloy ang collections papuntang CRB).

**B · Books (pera palabas / records)**
- **Cash Disbursement (CDB)** — voucher form na may **Debit = Credit validation**
  (bawal mag-save kung hindi balanse), auto **amount-in-words**, print voucher.
- **Cash Receipts (CRB)** — awtomatikong napupunan ng posted collections.
- **Journal Voucher (JVB)** — non-cash adjustments (balanced din).
- **Chart of Accounts** at **Payees** — foundation/master data.

## Reset

Sidebar → **↻ Reset demo data** — babalik sa original seed.

## Stack

Static HTML + Tailwind (CDN) + vanilla JS. Walang framework para madaling buksan
at i-demo; pwede itong i-port sa React/Vite kapag production na.

- `index.html` — shell
- `data.js` — seed data + localStorage state
- `app.js` — views, actions, print documents
- `styles.css` — print styles + polish

> Verified headlessly (jsdom): 28/28 na smoke checks pasado — lahat ng view
> nagre-render, at gumagana ang cashier→OR→CRB at voucher balance flows.
