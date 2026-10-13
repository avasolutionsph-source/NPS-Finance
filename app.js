/* ============================================================================
 * NPS Finance — demo app (vanilla JS)
 *
 * Two modules, exactly as in docs/legacy-accounting-analysis.md:
 *   A. COLLECTIONS / CASHIER  — money IN  (cashier, add charges, reports)
 *   B. DISBURSEMENT / BOOKS   — money OUT (CDB voucher, CRB, JVB, COA, payees)
 * The bridge: posted collections flow into the CRB (Cash Receipts Book).
 * ========================================================================== */

/* ----------------------------- transient UI state ------------------------- */
const ui = {
  cashierStudentNo: null,
  cashierSearch: '',
  reportTab: 'detailed',
  voucher: null, // draft, built lazily
  jv: null,      // draft, built lazily
};

/* ------------------------------- helpers ---------------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function num2(n) {
  return Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function peso(n) { return '₱' + num2(n); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] || '';
  return `${mon} ${d}, ${y}`;
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* number -> words (for voucher / check / OR printing) */
function numToWords(n) {
  const ones = ['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];
  const tens = ['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];
  const below1000 = (x) => {
    let s = '';
    if (x >= 100) { s += ones[Math.floor(x / 100)] + ' HUNDRED'; x %= 100; if (x) s += ' '; }
    if (x >= 20) { s += tens[Math.floor(x / 10)]; x %= 10; if (x) s += '-' + ones[x]; }
    else if (x > 0) { s += ones[x]; }
    return s;
  };
  if (n === 0) return 'ZERO';
  const scales = [[1e9, 'BILLION'], [1e6, 'MILLION'], [1e3, 'THOUSAND']];
  let words = '', rest = Math.floor(n);
  for (const [v, label] of scales) {
    if (rest >= v) { words += below1000(Math.floor(rest / v)) + ' ' + label + ' '; rest %= v; }
  }
  if (rest > 0) words += below1000(rest);
  return words.trim();
}
function amountInWords(amount) {
  const pesos = Math.floor(amount);
  const cents = Math.round((amount - pesos) * 100);
  let w = numToWords(pesos) + ' PESO' + (pesos === 1 ? '' : 'S');
  if (cents > 0) w += ' AND ' + String(cents).padStart(2, '0') + '/100';
  return w + ' ONLY';
}

/* account/payee lookups */
const acct = (code) => state.chartOfAccounts.find(a => a.code === code);
const acctName = (code) => { const a = acct(code); return a ? a.name : ''; };
const payeeName = (code) => { const p = state.payees.find(x => x.code === code); return p ? p.name : ''; };
const student = (no) => state.students.find(s => s.no === no);

function ledgerBalance(line) { return Math.max(0, line.amount - line.paid); }
function studentBalance(s) { return s.ledger.reduce((t, l) => t + ledgerBalance(l), 0); }
function nextVoucherNo() { return `${state.voucherPrefix}-${String(state.voucherSeq).padStart(6, '0')}`; }
function nextJvNo() { return `JV-${state.voucherPrefix}-${String(state.jvSeq).padStart(4, '0')}`; }

/* entry-line totals (shared by CDB voucher + JV) */
function lineTotals(lines) {
  let d = 0, c = 0;
  for (const l of lines) {
    const amt = Number(l.amount) || 0;
    if (l.type === 'D') d += amt; else c += amt;
  }
  return { debit: d, credit: c, balanced: d > 0 && Math.abs(d - c) < 0.005 };
}

/* ============================================================================
 * NAV + SHELL
 * ========================================================================== */
const NAV = [
  { group: 'Overview', items: [ { hash: 'dashboard', label: 'Dashboard', ico: '■' } ] },
  { group: 'A · Collections', items: [
      { hash: 'cashier',  label: 'Cashier',            ico: '₱' },
      { hash: 'charges',  label: 'Add Charges',        ico: '+' },
      { hash: 'reports',  label: 'Collection Reports', ico: '☰' },
  ]},
  { group: 'B · Books', items: [
      { hash: 'cdb',      label: 'Cash Disbursement (CDB)', ico: '→' },
      { hash: 'crb',      label: 'Cash Receipts (CRB)',     ico: '←' },
      { hash: 'jvb',      label: 'Journal Voucher (JVB)',   ico: '⇄' },
      { hash: 'coa',      label: 'Chart of Accounts',       ico: '#'       },
      { hash: 'payees',   label: 'Payees',                  ico: '⌂' },
  ]},
];

function currentHash() {
  const h = (location.hash || '#dashboard').slice(1);
  return h || 'dashboard';
}

function shell(contentHtml) {
  const h = currentHash();
  const nav = NAV.map(g => `
    <div class="mb-4">
      <div class="px-2.5 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">${esc(g.group)}</div>
      ${g.items.map(it => `
        <a href="#${it.hash}" ${h === it.hash ? 'aria-current="page"' : ''} class="nav-link ${h === it.hash ? 'active' : ''} flex items-center gap-2.5 px-2.5 py-2 rounded text-[12.5px] font-medium text-ink-secondary transition">
          <span class="nav-ico w-4 text-center text-[13px] leading-none opacity-75 tnum" aria-hidden="true">${it.ico}</span>
          <span>${esc(it.label)}</span>
        </a>`).join('')}
    </div>`).join('');

  return `
  <button type="button" data-action="skip" class="skip-link">Skip to main content</button>
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-[220px] shrink-0 bg-sidebar border-r border-border p-3 flex flex-col h-screen sticky top-0">
      <div class="flex items-center gap-2.5 px-1 py-1">
        <img src="assets/nps-logo.png" alt="Naga Parochial School seal" class="w-9 h-9 shrink-0" loading="eager" />
        <div class="leading-tight">
          <div class="font-serif text-[13.5px] font-bold text-ink-primary">Naga Parochial</div>
          <div class="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-nps-red">Finance System</div>
        </div>
      </div>
      <div class="mt-3 mb-3 px-1">
        <label class="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-1">School Year</label>
        <select class="w-full text-[12px] border border-border rounded bg-panel px-2 py-1.5 text-ink-primary" disabled>
          <option>${esc(state.schoolYear)}</option>
        </select>
      </div>
      <nav class="flex-1 overflow-y-auto -mx-1 px-1" aria-label="Main navigation">${nav}</nav>
      <div class="mt-auto pt-3 border-t border-border-soft flex flex-col gap-2">
        <div class="flex items-center gap-2 px-1">
          <div class="w-7 h-7 rounded-full bg-panel border border-border grid place-items-center text-[11px] font-bold text-ink-secondary">C</div>
          <div class="leading-tight">
            <div class="text-[12px] text-ink-primary font-medium">Cashier</div>
            <div class="text-[10px] text-ink-muted">Demo · mock data</div>
          </div>
        </div>
        <button data-action="reset" class="no-print flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-ink-secondary hover:bg-[#e7e1d4] hover:text-ink-primary transition">↻ Reset demo data</button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="sticky top-0 z-10 bg-app/85 backdrop-blur border-b border-border px-6 py-2.5 flex items-center justify-between">
        <div id="pageTitle" class="text-[12.5px] text-ink-secondary"></div>
        <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-pending-fg bg-pending-bg px-2.5 py-1 rounded-full">DEMO</span>
      </header>
      <main id="main" tabindex="-1" class="flex-1 p-6 max-w-[1180px] w-full mx-auto">${contentHtml}</main>
    </div>
  </div>`;
}

/* small building blocks */
function card(title, body, extra = '') {
  return `<section class="bg-panel rounded-lg border border-border shadow-sm ${extra}">
    ${title ? `<div class="px-5 py-3.5 border-b border-border-soft flex items-center justify-between"><h2 class="font-semibold text-ink-primary">${title}</h2></div>` : ''}
    <div class="p-5">${body}</div>
  </section>`;
}
function pageHead(title, sub) {
  return `<div class="mb-5">
    <h1 class="text-xl font-bold text-ink-primary">${esc(title)}</h1>
    ${sub ? `<p class="text-sm text-ink-secondary mt-0.5">${sub}</p>` : ''}
  </div>`;
}
function kpi(label, value, tone) {
  const tones = { green: 'text-ok-fg', rose: 'text-nps-red', indigo: 'text-ink-primary', slate: 'text-ink-primary' };
  return `<div class="bg-panel rounded-lg border border-border shadow-sm p-5">
    <div class="text-xs font-medium text-ink-secondary uppercase tracking-wide">${esc(label)}</div>
    <div class="mt-1.5 text-2xl font-bold tnum ${tones[tone] || tones.slate}">${value}</div>
  </div>`;
}

/* ============================================================================
 * VIEW: Dashboard
 * ========================================================================== */
function viewDashboard() {
  const colTotal = state.collections.reduce((t, c) => t + c.total, 0);
  const disTotal = state.disbursements.reduce((t, d) => t + lineTotals(d.lines).debit, 0);
  const unposted = state.collections.filter(c => !c.posted).length;
  const receivables = state.students.reduce((t, s) => t + studentBalance(s), 0);

  const flow = `
    <div class="grid md:grid-cols-2 gap-4">
      <div class="rounded-md border border-ok-fg/25 bg-ok-bg p-4">
        <div class="text-sm font-semibold text-ok-fg mb-1">A · Pera PAPASOK (Collections)</div>
        <p class="text-sm text-ok-fg/90 leading-relaxed">Cashier → hanapin student → tanggap bayad → print OR → Collection Reports (detailed + summary) → <b>post papuntang CRB</b>.</p>
      </div>
      <div class="rounded-md border border-nps-red/25 bg-[#fdf0f2] p-4">
        <div class="text-sm font-semibold text-nps-red mb-1">B · Pera PALABAS (Disbursement)</div>
        <p class="text-sm text-nps-red/90 leading-relaxed">Gastos → Cash Disbursement Voucher (Debit=Credit) → print Voucher + Check → naitala sa CDB.</p>
      </div>
    </div>`;

  return pageHead('Dashboard', 'Buod ng dalawang module ng NPS Finance') + `
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${kpi('Total Collections', peso(colTotal), 'green')}
      ${kpi('Total Disbursements', peso(disTotal), 'rose')}
      ${kpi('Net Cash Position', peso(colTotal - disTotal), 'indigo')}
      ${kpi('Outstanding Receivables', peso(receivables), 'slate')}
    </div>
    ${card('Daloy ng Pera', flow)}
    <div class="mt-4">${card('Status', `
      <ul class="text-sm text-ink-secondary space-y-1.5">
        <li>• <b class="text-ink-primary">${state.collections.length}</b> collection(s) na-record — <b class="text-pending-fg">${unposted}</b> hindi pa na-post sa CRB.</li>
        <li>• <b class="text-ink-primary">${state.disbursements.length}</b> disbursement voucher(s) sa CDB.</li>
        <li>• <b class="text-ink-primary">${state.students.length}</b> student ledgers, <b class="text-ink-primary">${state.chartOfAccounts.length}</b> account codes.</li>
      </ul>
      <p class="mt-3 text-xs text-ink-muted">Reference: <code>docs/legacy-accounting-analysis.md</code></p>
    `)}</div>`;
}

/* ============================================================================
 * VIEW: Cashier (Module A core)
 * ========================================================================== */
function viewCashier() {
  const q = ui.cashierSearch.trim().toLowerCase();
  const matches = state.students.filter(s =>
    !q || s.no.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  const sel = ui.cashierStudentNo ? student(ui.cashierStudentNo) : null;

  const list = `
    <div class="mb-3">
      <input data-action="cashierSearch" value="${esc(ui.cashierSearch)}" placeholder="Search student no. or name…"
        class="w-full text-sm border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-ink-primary/15 focus:border-ink-muted outline-none" autofocus />
    </div>
    <div class="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
      ${matches.map(s => `
        <button data-action="selectStudent" data-student="${esc(s.no)}"
          class="w-full text-left px-3 py-2.5 rounded-lg border transition ${sel && sel.no === s.no ? 'border-nps-red bg-[#fdf0f2]' : 'border-border hover:border-ink-muted hover:bg-panel-alt'}">
          <div class="flex items-center justify-between">
            <div class="font-medium text-sm text-ink-primary">${esc(s.name)}</div>
            <div class="text-xs tnum ${studentBalance(s) > 0 ? 'text-nps-red font-semibold' : 'text-ok-fg'}">${peso(studentBalance(s))}</div>
          </div>
          <div class="text-[11px] text-ink-secondary">${esc(s.no)} · ${esc(s.grade)} · ${esc(s.section)}</div>
        </button>`).join('') || `<div class="text-sm text-ink-muted py-6 text-center">No match.</div>`}
    </div>`;

  let right;
  if (!sel) {
    right = `<div class="grid place-items-center text-center text-ink-muted py-20">
      <div>
        <div class="text-4xl mb-2">₱</div>
        <p class="text-sm">Pumili ng estudyante sa kaliwa para tumanggap ng bayad.</p>
      </div>
    </div>`;
  } else {
    const bal = studentBalance(sel);
    const rows = sel.ledger.map(l => {
      const b = ledgerBalance(l);
      return `<tr class="border-b border-border-soft last:border-0">
        <td class="py-2 pr-3">
          <div class="text-sm text-ink-primary">${esc(l.particular)}</div>
          <div class="text-[11px] text-ink-muted">${esc(l.account)} · ${esc(acctName(l.account))}</div>
        </td>
        <td class="py-2 px-2 text-xs text-ink-secondary whitespace-nowrap">${esc(fmtDate(l.dueDate))}</td>
        <td class="py-2 px-2 text-right tnum text-sm">${num2(l.amount)}</td>
        <td class="py-2 px-2 text-right tnum text-sm text-ok-fg">${num2(l.paid)}</td>
        <td class="py-2 pl-2 text-right tnum text-sm font-semibold ${b > 0 ? 'text-nps-red' : 'text-ink-muted'}">${num2(b)}</td>
      </tr>`;
    }).join('');

    const payBox = bal > 0 ? `
      <div class="rounded-md border border-border p-4 bg-panel-alt">
        <div class="grid sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-ink-secondary mb-1">OR No.</label>
            <div class="flex gap-2">
              <input id="orNo" value="${state.orSeries}" class="w-full text-sm border border-border rounded-lg px-3 py-2 tnum bg-panel" />
              <button data-action="setOR" class="text-xs px-3 rounded-lg border border-border bg-panel hover:bg-sidebar whitespace-nowrap">Set OR</button>
            </div>
          </div>
          <div>
            <label for="amtPay" class="block text-xs font-medium text-ink-secondary mb-1">Amount to Pay</label>
            <input id="amtPay" data-live="cashier" type="number" min="0" step="0.01" value="${bal.toFixed(2)}"
              class="w-full text-sm border border-border rounded-lg px-3 py-2 tnum bg-panel focus:ring-2 focus:ring-ink-primary/15 outline-none" />
          </div>
          <div>
            <label for="amtTender" class="block text-xs font-medium text-ink-secondary mb-1">Amount Tendered</label>
            <input id="amtTender" data-live="cashier" type="number" min="0" step="0.01" value="${bal.toFixed(2)}"
              class="w-full text-sm border border-border rounded-lg px-3 py-2 tnum bg-panel focus:ring-2 focus:ring-ink-primary/15 outline-none" />
          </div>
          <div>
            <label class="block text-xs font-medium text-ink-secondary mb-1">Change</label>
            <div id="changeOut" class="w-full text-sm border border-border rounded-lg px-3 py-2 tnum bg-panel font-semibold text-ink-primary">${peso(0)}</div>
          </div>
        </div>
        <button data-action="receivePayment" class="mt-4 w-full bg-accent hover:opacity-90 text-white font-semibold text-sm rounded-lg py-2.5 transition">
          Receive Payment &amp; Print OR
        </button>
        <p class="mt-2 text-[11px] text-ink-muted">Payment is applied oldest-due first. Cash assumed.</p>
      </div>` : `
      <div class="rounded-md border border-ok-fg/25 bg-ok-bg p-4 text-center text-sm text-ok-fg font-medium">
        ✔ Fully paid — walang outstanding balance.
      </div>`;

    right = `
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="font-bold text-ink-primary">${esc(sel.name)}</div>
          <div class="text-xs text-ink-secondary">${esc(sel.no)} · ${esc(sel.grade)} · ${esc(sel.section)}</div>
        </div>
        <button data-action="statement" class="no-print text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-sidebar">☰ Statement</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
              <th class="text-left font-medium py-2 pr-3">Particulars</th>
              <th class="text-left font-medium py-2 px-2">Due Date</th>
              <th class="text-right font-medium py-2 px-2">Amount</th>
              <th class="text-right font-medium py-2 px-2">Paid</th>
              <th class="text-right font-medium py-2 pl-2">Balance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="border-t-2 border-border font-semibold">
              <td colspan="4" class="py-2 pr-2 text-right text-ink-secondary">Total Balance</td>
              <td class="py-2 pl-2 text-right tnum ${bal > 0 ? 'text-nps-red' : 'text-ink-muted'}">${num2(bal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="mt-4">${payBox}</div>`;
  }

  return pageHead('Cashier', 'Tanggapin ang bayad ng estudyante at i-print ang Official Receipt (OR).') + `
    <div class="grid lg:grid-cols-[360px_1fr] gap-5">
      ${card('Find Student', list)}
      ${card('Student Ledger', right)}
    </div>`;
}

/* ============================================================================
 * VIEW: Add Charges
 * ========================================================================== */
function viewCharges() {
  const sel = ui.cashierStudentNo ? student(ui.cashierStudentNo) : null;
  const incomeOpts = state.chartOfAccounts.filter(a => a.type === 'Income')
    .map(a => `<option value="${a.code}">${a.code} — ${esc(a.name)}</option>`).join('');
  const studentOpts = state.students
    .map(s => `<option value="${esc(s.no)}" ${sel && sel.no === s.no ? 'selected' : ''}>${esc(s.name)} (${esc(s.no)})</option>`).join('');

  const body = `
    <div class="grid sm:grid-cols-2 gap-3">
      <div class="sm:col-span-2">
        <label class="block text-xs font-medium text-ink-secondary mb-1">Student</label>
        <select id="chStudent" class="w-full text-sm border border-border rounded-lg px-3 py-2 bg-panel">
          <option value="">— Select student —</option>${studentOpts}
        </select>
      </div>
      <div class="sm:col-span-2">
        <label class="block text-xs font-medium text-ink-secondary mb-1">Account</label>
        <select id="chAccount" class="w-full text-sm border border-border rounded-lg px-3 py-2 bg-panel">${incomeOpts}</select>
      </div>
      <div class="sm:col-span-2">
        <label class="block text-xs font-medium text-ink-secondary mb-1">Particulars</label>
        <input id="chParticular" placeholder="e.g. Tuition Fee - 3rd Qtr" class="w-full text-sm border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Due Date</label>
        <input id="chDue" type="date" value="${todayISO()}" class="w-full text-sm border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Amount</label>
        <input id="chAmount" type="number" min="0" step="0.01" placeholder="0.00" class="w-full text-sm border border-border rounded-lg px-3 py-2 tnum" />
      </div>
    </div>
    <button data-action="addCharge" class="mt-4 w-full bg-accent hover:opacity-90 text-white font-semibold text-sm rounded-lg py-2.5 transition">+ Add Charge to Ledger</button>`;

  const preview = sel ? `
    <div class="text-sm text-ink-secondary mb-2">${esc(sel.name)} — current ledger</div>
    <div class="space-y-1.5 max-h-[440px] overflow-y-auto">
      ${sel.ledger.map(l => `<div class="flex items-center justify-between text-sm border-b border-border-soft py-1.5">
        <span class="text-ink-primary">${esc(l.particular)}</span>
        <span class="tnum text-ink-secondary">${num2(l.amount)}</span></div>`).join('')}
    </div>` : `<div class="text-sm text-ink-muted py-10 text-center">Pumili ng student para makita ang ledger.</div>`;

  return pageHead('Add Charges', 'Magdagdag ng bagong singil sa ledger ng estudyante.') + `
    <div class="grid lg:grid-cols-2 gap-5">
      ${card('New Charge', body)}
      ${card('Ledger Preview', preview)}
    </div>`;
}

/* ============================================================================
 * VIEW: Collection Reports (detailed + summary) + bridge to Books
 * ========================================================================== */
function viewReports() {
  const cols = state.collections;
  const unposted = cols.filter(c => !c.posted);

  const tabBtn = (id, label) => `<button data-action="reportTab" data-tab="${id}"
     class="px-4 py-2 text-sm font-medium rounded-lg ${ui.reportTab === id ? 'bg-accent text-white' : 'text-ink-secondary hover:bg-sidebar'}">${label}</button>`;

  let body;
  if (cols.length === 0) {
    body = `<div class="text-sm text-ink-muted py-10 text-center">Wala pang collection. Pumunta sa Cashier para tumanggap ng bayad.</div>`;
  } else if (ui.reportTab === 'detailed') {
    const rows = cols.flatMap(c => c.lines.map((ln, i) => `<tr class="border-b border-border-soft">
      <td class="py-2 px-2 text-xs text-ink-secondary">${i === 0 ? esc(fmtDate(c.date)) : ''}</td>
      <td class="py-2 px-2 text-sm tnum">${i === 0 ? esc(c.orNo) : ''}</td>
      <td class="py-2 px-2 text-sm">${i === 0 ? esc(c.studentName) : ''}</td>
      <td class="py-2 px-2 text-xs text-ink-secondary">${esc(ln.account)} ${esc(acctName(ln.account))}</td>
      <td class="py-2 px-2 text-right tnum text-sm">${num2(ln.amount)}</td>
    </tr>`)).join('');
    body = `<div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
        <th class="text-left font-medium py-2 px-2">Date</th>
        <th class="text-left font-medium py-2 px-2">OR No.</th>
        <th class="text-left font-medium py-2 px-2">Payor</th>
        <th class="text-left font-medium py-2 px-2">Account</th>
        <th class="text-right font-medium py-2 px-2">Amount</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr class="border-t-2 border-border font-bold">
        <td colspan="4" class="py-2 px-2 text-right">TOTAL</td>
        <td class="py-2 px-2 text-right tnum">${num2(cols.reduce((t, c) => t + c.total, 0))}</td>
      </tr></tfoot></table></div>`;
  } else {
    const byAcct = {};
    cols.forEach(c => c.lines.forEach(ln => { byAcct[ln.account] = (byAcct[ln.account] || 0) + ln.amount; }));
    const rows = Object.entries(byAcct).sort().map(([code, amt]) => `<tr class="border-b border-border-soft">
      <td class="py-2 px-2 text-sm tnum">${esc(code)}</td>
      <td class="py-2 px-2 text-sm">${esc(acctName(code))}</td>
      <td class="py-2 px-2 text-right tnum text-sm">${num2(amt)}</td>
    </tr>`).join('');
    body = `<div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
        <th class="text-left font-medium py-2 px-2">Code</th>
        <th class="text-left font-medium py-2 px-2">Account</th>
        <th class="text-right font-medium py-2 px-2">Total</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr class="border-t-2 border-border font-bold">
        <td colspan="2" class="py-2 px-2 text-right">TOTAL</td>
        <td class="py-2 px-2 text-right tnum">${num2(Object.values(byAcct).reduce((a, b) => a + b, 0))}</td>
      </tr></tfoot></table></div>`;
  }

  const bridge = `
    <div class="flex items-center justify-between rounded-md border ${unposted.length ? 'border-pending-fg/30 bg-pending-bg' : 'border-border bg-panel-alt'} px-4 py-3">
      <div class="text-sm ${unposted.length ? 'text-pending-fg' : 'text-ink-secondary'}">
        ${unposted.length
          ? `<b>${unposted.length}</b> collection(s) ready to post to the Books (CRB).`
          : 'Lahat ng collections ay na-post na sa CRB.'}
      </div>
      <button data-action="postToBooks" ${unposted.length ? '' : 'disabled'}
        class="text-sm font-semibold rounded-lg px-4 py-2 ${unposted.length ? 'bg-accent hover:opacity-90 text-white' : 'bg-na-bg text-ink-muted cursor-not-allowed'} transition">
        Post to Books →
      </button>
    </div>`;

  return pageHead('Collection Reports', 'Detailed at summary — ito ang ipinapasa sa Books side.') + `
    <div class="mb-4">${bridge}</div>
    ${card('', `
      <div class="flex items-center gap-2 mb-4 -mt-1">${tabBtn('detailed', 'Detailed')}${tabBtn('summary', 'Summary')}
        <div class="ml-auto"><button data-action="printReport" class="no-print text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-sidebar">⎙ Print</button></div>
      </div>
      ${body}`)}`;
}

/* ============================================================================
 * Shared entry-line editor (CDB voucher + JV)
 * ========================================================================== */
function renderLineRows(lines, kind) {
  const acctOpts = (sel) => state.chartOfAccounts
    .map(a => `<option value="${a.code}" ${sel === a.code ? 'selected' : ''}>${a.code} — ${esc(a.name)}</option>`).join('');
  return lines.map((l, i) => `
    <tr class="border-b border-border-soft">
      <td class="py-1.5 pr-2">
        <select data-line="${kind}" data-idx="${i}" data-field="code" class="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-panel">
          <option value="">— code —</option>${acctOpts(l.code)}
        </select>
      </td>
      <td class="py-1.5 px-2">
        <input data-line="${kind}" data-idx="${i}" data-field="particulars" value="${esc(l.particulars)}" placeholder="particulars"
          class="w-full text-xs border border-border rounded-lg px-2 py-1.5" />
      </td>
      <td class="py-1.5 px-2 w-24">
        <select data-line="${kind}" data-idx="${i}" data-field="type" data-live="${kind}" class="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-panel">
          <option value="D" ${l.type === 'D' ? 'selected' : ''}>Debit</option>
          <option value="C" ${l.type === 'C' ? 'selected' : ''}>Credit</option>
        </select>
      </td>
      <td class="py-1.5 px-2 w-32">
        <input data-line="${kind}" data-idx="${i}" data-field="amount" data-live="${kind}" type="number" min="0" step="0.01" value="${l.amount || ''}" placeholder="0.00"
          class="w-full text-xs text-right border border-border rounded-lg px-2 py-1.5 tnum" />
      </td>
      <td class="py-1.5 pl-1 w-8 text-center">
        <button type="button" data-action="${kind}RemoveLine" data-idx="${i}" aria-label="Remove line ${i + 1}" class="text-ink-muted hover:text-nps-red">✕</button>
      </td>
    </tr>`).join('');
}

function totalsBar(lines, kind) {
  const t = lineTotals(lines);
  return `
    <div class="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm mt-2">
      <div>Total Debit: <span id="${kind}TotD" class="tnum font-semibold">${num2(t.debit)}</span></div>
      <div>Total Credit: <span id="${kind}TotC" class="tnum font-semibold">${num2(t.credit)}</span></div>
      <div id="${kind}BalBadge" class="px-2.5 py-1 rounded-full text-xs font-semibold ${t.balanced ? 'bg-ok-bg text-ok-fg' : 'bg-[#fdecef] text-nps-red'}">
        ${t.balanced ? '✔ Balanced' : 'Out of balance'}
      </div>
    </div>
    <div class="mt-2 text-xs text-ink-secondary">Amount in words: <span id="${kind}Words" class="font-medium text-ink-primary">${t.balanced ? amountInWords(t.debit) : '—'}</span></div>`;
}

/* ============================================================================
 * VIEW: Cash Disbursement (CDB) — voucher form + register
 * ========================================================================== */
function viewCDB() {
  if (!ui.voucher) ui.voucher = freshVoucher();
  const v = ui.voucher;
  const payeeOpts = state.payees
    .map(p => `<option value="${p.code}" ${v.payToCode === p.code ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

  const form = `
    <div class="grid sm:grid-cols-3 gap-3 mb-4">
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Voucher No.</label>
        <input value="${esc(v.voucherNo)}" readonly class="w-full text-sm border border-border bg-panel-alt rounded-lg px-3 py-2 tnum" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Date</label>
        <input data-vhead="date" type="date" value="${esc(v.date)}" class="w-full text-sm border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Pay To</label>
        <select data-vhead="payToCode" class="w-full text-sm border border-border rounded-lg px-3 py-2 bg-panel">
          <option value="">— select payee —</option>${payeeOpts}
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Check No.</label>
        <input data-vhead="checkNo" value="${esc(v.checkNo)}" placeholder="0001453" class="w-full text-sm border border-border rounded-lg px-3 py-2 tnum" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Check Date</label>
        <input data-vhead="checkDate" type="date" value="${esc(v.checkDate)}" class="w-full text-sm border border-border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Remarks</label>
        <input data-vhead="remarks" value="${esc(v.remarks)}" placeholder="purpose…" class="w-full text-sm border border-border rounded-lg px-3 py-2" />
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead><tr class="text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
          <th class="text-left font-medium py-1.5 pr-2 w-44">Code</th>
          <th class="text-left font-medium py-1.5 px-2">Particulars</th>
          <th class="text-left font-medium py-1.5 px-2">Type</th>
          <th class="text-right font-medium py-1.5 px-2">Amount</th>
          <th></th>
        </tr></thead>
        <tbody id="voucherLines">${renderLineRows(v.lines, 'voucher')}</tbody>
      </table>
    </div>
    <button data-action="voucherAddLine" class="mt-2 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-sidebar">+ Add line</button>
    <div id="voucherTotals">${totalsBar(v.lines, 'voucher')}</div>
    <div class="flex gap-2 mt-4">
      <button data-action="voucherSave" class="flex-1 bg-nps-red hover:bg-nps-red-dark text-white font-semibold text-sm rounded-lg py-2.5 transition">Save Voucher &amp; Print</button>
      <button data-action="voucherReset" class="no-print px-4 rounded-lg border border-border text-sm hover:bg-sidebar">Clear</button>
    </div>
    <p class="mt-2 text-[11px] text-ink-muted">Hindi pwedeng mag-save kung hindi balanse ang Debit at Credit.</p>`;

  const regRows = state.disbursements.slice().reverse().map(d => {
    const t = lineTotals(d.lines);
    return `<tr class="border-b border-border-soft hover:bg-panel-alt">
      <td class="py-2 px-2 text-sm tnum">${esc(d.voucherNo)}</td>
      <td class="py-2 px-2 text-xs text-ink-secondary">${esc(fmtDate(d.date))}</td>
      <td class="py-2 px-2 text-sm">${esc(d.payTo || payeeName(d.payToCode))}</td>
      <td class="py-2 px-2 text-right tnum text-sm">${num2(t.debit)}</td>
      <td class="py-2 px-2 text-right"><button data-action="printVoucher" data-vno="${esc(d.voucherNo)}" class="text-xs text-nps-red hover:underline">view/print</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="py-6 text-center text-sm text-ink-muted">Wala pang voucher.</td></tr>`;

  return pageHead('Cash Disbursement (CDB)', 'Cash Disbursement Voucher — Debit = Credit, print voucher at check.') + `
    ${card('New Cash Disbursement Voucher', form)}
    <div class="mt-5">${card('CDB Register', `<div class="overflow-x-auto"><table class="w-full">
      <thead><tr class="text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
        <th class="text-left font-medium py-1.5 px-2">Voucher No.</th>
        <th class="text-left font-medium py-1.5 px-2">Date</th>
        <th class="text-left font-medium py-1.5 px-2">Pay To</th>
        <th class="text-right font-medium py-1.5 px-2">Amount</th>
        <th></th>
      </tr></thead><tbody>${regRows}</tbody></table></div>`)}</div>`;
}

function freshVoucher() {
  return {
    voucherNo: nextVoucherNo(), date: todayISO(), checkNo: '', checkDate: todayISO(),
    payToCode: '', remarks: '',
    lines: [ { code: '', particulars: '', type: 'D', amount: '' }, { code: '', particulars: '', type: 'C', amount: '' } ],
  };
}

/* ============================================================================
 * VIEW: Cash Receipts (CRB) — fed by posted collections
 * ========================================================================== */
function viewCRB() {
  const posted = state.collections.filter(c => c.posted);
  const rows = posted.slice().reverse().map(c => {
    const credits = c.lines.map(l => `${l.account} ${num2(l.amount)}`).join('<br>');
    return `<tr class="border-b border-border-soft align-top">
      <td class="py-2 px-2 text-xs text-ink-secondary whitespace-nowrap">${esc(fmtDate(c.date))}</td>
      <td class="py-2 px-2 text-sm tnum">${esc(c.orNo)}</td>
      <td class="py-2 px-2 text-sm">${esc(c.studentName)}</td>
      <td class="py-2 px-2 text-xs text-ink-secondary">101 Cash on Hand</td>
      <td class="py-2 px-2 text-xs text-ink-secondary">${credits}</td>
      <td class="py-2 px-2 text-right tnum text-sm font-semibold text-ok-fg">${num2(c.total)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="py-8 text-center text-sm text-ink-muted">Wala pang naka-post na collection. Pumunta sa Collection Reports → Post to Books.</td></tr>`;

  return pageHead('Cash Receipts (CRB)', 'Talaan ng lahat ng PUMAPASOK na pera — galing sa posted collections.') + `
    ${card('', `<div class="overflow-x-auto"><table class="w-full">
      <thead><tr class="text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
        <th class="text-left font-medium py-2 px-2">Date</th>
        <th class="text-left font-medium py-2 px-2">OR No.</th>
        <th class="text-left font-medium py-2 px-2">Payor</th>
        <th class="text-left font-medium py-2 px-2">Debit (Dr)</th>
        <th class="text-left font-medium py-2 px-2">Credit (Cr)</th>
        <th class="text-right font-medium py-2 px-2">Amount</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr class="border-t-2 border-border font-bold"><td colspan="5" class="py-2 px-2 text-right">TOTAL</td>
        <td class="py-2 px-2 text-right tnum text-ok-fg">${num2(posted.reduce((t, c) => t + c.total, 0))}</td></tr></tfoot>
    </table></div>`)}`;
}

/* ============================================================================
 * VIEW: Journal Voucher (JVB) — non-cash adjustments
 * ========================================================================== */
function viewJVB() {
  if (!ui.jv) ui.jv = freshJv();
  const j = ui.jv;
  const form = `
    <div class="grid sm:grid-cols-3 gap-3 mb-4">
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">JV No.</label>
        <input value="${esc(j.jvNo)}" readonly class="w-full text-sm border border-border bg-panel-alt rounded-lg px-3 py-2" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-secondary mb-1">Date</label>
        <input data-jhead="date" type="date" value="${esc(j.date)}" class="w-full text-sm border border-border rounded-lg px-3 py-2" />
      </div>
      <div class="sm:col-span-1">
        <label class="block text-xs font-medium text-ink-secondary mb-1">Remarks</label>
        <input data-jhead="remarks" value="${esc(j.remarks)}" placeholder="adjustment…" class="w-full text-sm border border-border rounded-lg px-3 py-2" />
      </div>
    </div>
    <div class="overflow-x-auto"><table class="w-full">
      <thead><tr class="text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
        <th class="text-left font-medium py-1.5 pr-2 w-44">Code</th>
        <th class="text-left font-medium py-1.5 px-2">Particulars</th>
        <th class="text-left font-medium py-1.5 px-2">Type</th>
        <th class="text-right font-medium py-1.5 px-2">Amount</th><th></th>
      </tr></thead><tbody id="jvLines">${renderLineRows(j.lines, 'jv')}</tbody></table></div>
    <button data-action="jvAddLine" class="mt-2 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-sidebar">+ Add line</button>
    <div id="jvTotals">${totalsBar(j.lines, 'jv')}</div>
    <div class="flex gap-2 mt-4">
      <button data-action="jvSave" class="flex-1 bg-accent hover:opacity-90 text-white font-semibold text-sm rounded-lg py-2.5 transition">Save Journal Voucher</button>
      <button data-action="jvReset" class="no-print px-4 rounded-lg border border-border text-sm hover:bg-sidebar">Clear</button>
    </div>`;

  const rows = state.journal.slice().reverse().map(j2 => {
    const t = lineTotals(j2.lines);
    return `<tr class="border-b border-border-soft align-top">
      <td class="py-2 px-2 text-sm">${esc(j2.jvNo)}</td>
      <td class="py-2 px-2 text-xs text-ink-secondary">${esc(fmtDate(j2.date))}</td>
      <td class="py-2 px-2 text-sm">${esc(j2.remarks)}</td>
      <td class="py-2 px-2 text-xs text-ink-secondary">${j2.lines.map(l => `${l.code} ${l.type} ${num2(l.amount)}`).join('<br>')}</td>
      <td class="py-2 px-2 text-right tnum text-sm">${num2(t.debit)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="py-6 text-center text-sm text-ink-muted">Wala pang journal voucher.</td></tr>`;

  return pageHead('Journal Voucher (JVB)', 'Mga entry na HINDI cash in/out: adjustments, corrections, depreciation.') + `
    ${card('New Journal Voucher', form)}
    <div class="mt-5">${card('JVB Register', `<div class="overflow-x-auto"><table class="w-full">
      <thead><tr class="text-[11px] uppercase tracking-wide text-ink-muted border-b border-border">
        <th class="text-left font-medium py-1.5 px-2">JV No.</th><th class="text-left font-medium py-1.5 px-2">Date</th>
        <th class="text-left font-medium py-1.5 px-2">Remarks</th><th class="text-left font-medium py-1.5 px-2">Entries</th>
        <th class="text-right font-medium py-1.5 px-2">Amount</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`)}</div>`;
}

function freshJv() {
  return { jvNo: nextJvNo(), date: todayISO(), remarks: '',
    lines: [ { code: '', particulars: '', type: 'D', amount: '' }, { code: '', particulars: '', type: 'C', amount: '' } ] };
}

/* ============================================================================
 * VIEW: Chart of Accounts + Payees
 * ========================================================================== */
function viewCOA() {
  const byType = {};
  state.chartOfAccounts.forEach(a => { (byType[a.type] = byType[a.type] || []).push(a); });
  const tone = { Asset: 'text-ink-secondary bg-na-bg', Liability: 'text-pending-fg bg-pending-bg', Income: 'text-ok-fg bg-ok-bg', Expense: 'text-nps-red bg-[#fdecef]' };
  const sections = Object.entries(byType).map(([type, list]) => `
    <div class="mb-4">
      <div class="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded inline-block ${tone[type] || ''}">${esc(type)}</div>
      <table class="w-full mt-1.5">
        ${list.map(a => `<tr class="border-b border-border-soft">
          <td class="py-1.5 px-2 text-sm tnum w-24 text-ink-secondary">${esc(a.code)}</td>
          <td class="py-1.5 px-2 text-sm text-ink-primary">${esc(a.name)}</td>
        </tr>`).join('')}
      </table>
    </div>`).join('');
  return pageHead('Chart of Accounts', 'Master list ng account codes — foundation data ng Books side.') + card('', sections);
}

function viewPayees() {
  const rows = state.payees.map(p => `<tr class="border-b border-border-soft">
    <td class="py-2 px-2 text-sm tnum w-24 text-ink-secondary">${esc(p.code)}</td>
    <td class="py-2 px-2 text-sm text-ink-primary">${esc(p.name)}</td>
  </tr>`).join('');
  return pageHead('Payees', 'Master list ng mga binabayaran (suppliers, payroll, utilities).') +
    card('', `<table class="w-full">${rows}</table>`);
}

/* ============================================================================
 * ROUTER
 * ========================================================================== */
const VIEWS = {
  dashboard: viewDashboard, cashier: viewCashier, charges: viewCharges, reports: viewReports,
  cdb: viewCDB, crb: viewCRB, jvb: viewJVB, coa: viewCOA, payees: viewPayees,
};
const TITLES = {
  dashboard: 'Overview', cashier: 'A · Collections', charges: 'A · Collections', reports: 'A · Collections',
  cdb: 'B · Books', crb: 'B · Books', jvb: 'B · Books', coa: 'B · Books', payees: 'B · Books',
};

function render() {
  const h = currentHash();
  const view = VIEWS[h] || viewDashboard;
  $('#app').innerHTML = shell(view());
  const pt = $('#pageTitle');
  if (pt) pt.textContent = TITLES[h] || '';
}

/* ============================================================================
 * ACTIONS
 * ========================================================================== */
function receivePayment() {
  const sel = student(ui.cashierStudentNo);
  if (!sel) return;
  const orNo = ($('#orNo') && $('#orNo').value.trim()) || String(state.orSeries);
  let toPay = Math.max(0, Number($('#amtPay') && $('#amtPay').value) || 0);
  const tendered = Math.max(0, Number($('#amtTender') && $('#amtTender').value) || 0);
  const bal = studentBalance(sel);
  toPay = Math.min(toPay, bal);

  if (toPay <= 0) { toast('Walang babayaran o balanse.', 'rose'); return; }
  if (tendered < toPay) { toast('Kulang ang tendered sa amount to pay.', 'rose'); return; }

  // allocate oldest-due first
  const sorted = sel.ledger.filter(l => ledgerBalance(l) > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let remaining = toPay;
  const byAcct = {};
  for (const l of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(ledgerBalance(l), remaining);
    l.paid += take; remaining -= take;
    byAcct[l.account] = (byAcct[l.account] || 0) + take;
  }
  const lines = Object.entries(byAcct).map(([account, amount]) => ({ account, amount }));
  const rec = {
    id: cryptoId(), date: todayISO(), orNo,
    studentNo: sel.no, studentName: sel.name, grade: sel.grade, section: sel.section,
    lines, total: toPay, tendered, change: tendered - toPay, posted: false,
  };
  state.collections.push(rec);
  state.orSeries += 1;
  saveState();
  render();
  showORReceipt(rec);
}

function addCharge() {
  const no = $('#chStudent') && $('#chStudent').value;
  const s = student(no);
  if (!s) { toast('Pumili muna ng student.', 'rose'); return; }
  const account = $('#chAccount').value;
  const particular = $('#chParticular').value.trim();
  const dueDate = $('#chDue').value;
  const amount = Math.max(0, Number($('#chAmount').value) || 0);
  if (!particular || amount <= 0) { toast('Kumpletuhin ang particulars at valid na amount (hindi negatibo).', 'rose'); return; }
  s.ledger.push({ id: cryptoId(), account, particular, dueDate, amount, paid: 0 });
  ui.cashierStudentNo = s.no;
  saveState();
  render();
  toast('Charge added sa ledger.', 'green');
}

function postToBooks() {
  const unposted = state.collections.filter(c => !c.posted);
  if (!unposted.length) return;
  if (!confirm(`Post ${unposted.length} collection(s) sa CRB (Cash Receipts Book)?\n\nMila-lock na ang mga ito — hindi na mababawi sa demo.`)) return;
  unposted.forEach(c => { c.posted = true; });
  saveState();
  render();
  toast(`${unposted.length} collection(s) posted to CRB.`, 'green');
  location.hash = '#crb';
}

/* ---- voucher (CDB) ---- */
function syncVoucherFromDOM() {
  const v = ui.voucher; if (!v) return;
  $$('[data-vhead]').forEach(el => { v[el.getAttribute('data-vhead')] = el.value; });
  $$('[data-line="voucher"]').forEach(el => {
    const i = +el.getAttribute('data-idx'), f = el.getAttribute('data-field');
    if (!v.lines[i]) return;
    v.lines[i][f] = (f === 'amount') ? (el.value === '' ? '' : Number(el.value)) : el.value;
  });
}
function voucherSave() {
  syncVoucherFromDOM();
  const v = ui.voucher;
  const t = lineTotals(v.lines);
  if (v.lines.some(l => Number(l.amount) < 0)) { toast('Bawal ang negatibong amount sa entry lines.', 'rose'); return; }
  if (!v.payToCode) { toast('Pumili ng Pay To (payee).', 'rose'); return; }
  if (!t.balanced) { toast('Debit at Credit ay hindi balanse.', 'rose'); return; }
  const rec = { ...v, payTo: payeeName(v.payToCode), lines: v.lines.filter(l => l.code && Number(l.amount) > 0) };
  state.disbursements.push(rec);
  state.voucherSeq += 1;
  ui.voucher = freshVoucher();
  saveState();
  render();
  showVoucherDoc(rec);
}

/* ---- journal (JVB) ---- */
function syncJvFromDOM() {
  const j = ui.jv; if (!j) return;
  $$('[data-jhead]').forEach(el => { j[el.getAttribute('data-jhead')] = el.value; });
  $$('[data-line="jv"]').forEach(el => {
    const i = +el.getAttribute('data-idx'), f = el.getAttribute('data-field');
    if (!j.lines[i]) return;
    j.lines[i][f] = (f === 'amount') ? (el.value === '' ? '' : Number(el.value)) : el.value;
  });
}
function jvSave() {
  syncJvFromDOM();
  const j = ui.jv;
  const t = lineTotals(j.lines);
  if (j.lines.some(l => Number(l.amount) < 0)) { toast('Bawal ang negatibong amount sa entry lines.', 'rose'); return; }
  if (!t.balanced) { toast('Debit at Credit ay hindi balanse.', 'rose'); return; }
  state.journal.push({ ...j, lines: j.lines.filter(l => l.code && Number(l.amount) > 0) });
  state.jvSeq += 1;
  ui.jv = freshJv();
  saveState();
  render();
  toast('Journal voucher saved.', 'green');
}

/* live recompute of totals bar without re-render (keeps input focus) */
function recomputeTotals(kind) {
  const sync = kind === 'voucher' ? syncVoucherFromDOM : syncJvFromDOM;
  sync();
  const lines = (kind === 'voucher' ? ui.voucher : ui.jv).lines;
  const t = lineTotals(lines);
  const setTxt = (id, txt) => { const el = $('#' + id); if (el) el.textContent = txt; };
  setTxt(kind + 'TotD', num2(t.debit));
  setTxt(kind + 'TotC', num2(t.credit));
  const badge = $('#' + kind + 'BalBadge');
  if (badge) {
    badge.textContent = t.balanced ? '✔ Balanced' : 'Out of balance';
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-semibold ' +
      (t.balanced ? 'bg-ok-bg text-ok-fg' : 'bg-[#fdecef] text-nps-red');
  }
  setTxt(kind + 'Words', t.balanced ? amountInWords(t.debit) : '—');
}

function recomputeChange() {
  const toPay = Number($('#amtPay') && $('#amtPay').value) || 0;
  const tendered = Number($('#amtTender') && $('#amtTender').value) || 0;
  const el = $('#changeOut');
  if (el) {
    const ch = tendered - toPay;
    el.textContent = peso(ch < 0 ? 0 : ch);
    el.classList.toggle('text-nps-red', tendered < toPay);
    el.classList.toggle('text-ink-primary', tendered >= toPay);
  }
}

/* ============================================================================
 * MODALS / PRINT
 * ========================================================================== */
let lastFocused = null;
function openModal(innerHtml, wide) {
  lastFocused = document.activeElement;
  $('#modalHost').innerHTML = `
    <div class="fixed inset-0 z-50 bg-ink-primary/40 flex items-start justify-center p-4 overflow-y-auto no-print" data-action="modalBackdrop">
      <div id="printRoot" role="dialog" aria-modal="true" aria-label="Document preview" class="pop-in bg-panel rounded-lg shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} my-8">${innerHtml}</div>
    </div>`;
  const first = $('#modalHost').querySelector('[data-action="closeModal"]');
  if (first) first.focus();
}
function closeModal() {
  if (!$('#modalHost').innerHTML) return;
  $('#modalHost').innerHTML = '';
  if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (_) {} }
  lastFocused = null;
}

function modalChrome(title, bodyHtml) {
  return `
    <div class="no-print flex items-center justify-between px-5 py-3 border-b border-border-soft">
      <h3 class="font-semibold text-ink-primary">${esc(title)}</h3>
      <button type="button" data-action="closeModal" aria-label="Close dialog" class="text-ink-muted hover:text-ink-primary text-xl leading-none">×</button>
    </div>
    ${bodyHtml}
    <div class="no-print flex gap-2 px-5 py-3 border-t border-border-soft">
      <button data-action="doPrint" class="flex-1 bg-accent hover:opacity-90 text-white text-sm font-semibold rounded-lg py-2">⎙ Print</button>
      <button data-action="closeModal" class="px-4 rounded-lg border border-border text-sm hover:bg-sidebar">Close</button>
    </div>`;
}

function showORReceipt(rec) {
  const linesHtml = rec.lines.map(l =>
    `<div class="flex justify-between"><span>${esc(acctName(l.account))}</span><span class="tnum">${num2(l.amount)}</span></div>`).join('');
  const body = `<div class="doc p-6 text-[13px] text-ink-primary">
    <div class="text-center mb-3">
      <div class="font-bold text-base">NAGA PAROCHIAL SCHOOL</div>
      <div>Naga City</div>
      <div class="mt-1 font-semibold tracking-wide">OFFICIAL RECEIPT</div>
    </div>
    <div class="flex justify-between"><span>OR No.:</span><span class="font-bold">${esc(rec.orNo)}</span></div>
    <div class="flex justify-between"><span>Date:</span><span>${esc(fmtDate(rec.date))}</span></div>
    <div class="flex justify-between"><span>Received from:</span><span>${esc(rec.studentName)}</span></div>
    <div class="flex justify-between"><span>Student No.:</span><span>${esc(rec.studentNo)} · ${esc(rec.grade)}</span></div>
    <div class="rule my-2"></div>
    ${linesHtml}
    <div class="rule my-2"></div>
    <div class="flex justify-between font-bold"><span>TOTAL</span><span class="tnum">${num2(rec.total)}</span></div>
    <div class="flex justify-between"><span>Tendered</span><span class="tnum">${num2(rec.tendered)}</span></div>
    <div class="flex justify-between"><span>Change</span><span class="tnum">${num2(rec.change)}</span></div>
    <div class="mt-3 text-[11px]">Amount in words: <b>${amountInWords(rec.total)}</b></div>
    <div class="mt-6 text-center text-[11px] text-ink-secondary">This is a demo receipt — not an official document.</div>
  </div>`;
  openModal(modalChrome('Official Receipt — ' + rec.orNo, body));
}

function showVoucherDoc(rec) {
  const t = lineTotals(rec.lines);
  const rows = rec.lines.map(l => `<tr>
    <td class="py-1 pr-2">${esc(l.code)}</td>
    <td class="py-1 px-2">${esc(l.particulars || acctName(l.code))}</td>
    <td class="py-1 px-2 text-right tnum">${l.type === 'D' ? num2(l.amount) : ''}</td>
    <td class="py-1 pl-2 text-right tnum">${l.type === 'C' ? num2(l.amount) : ''}</td>
  </tr>`).join('');
  const body = `<div class="doc p-6 text-[12px] text-ink-primary">
    <div class="text-center mb-3">
      <div class="font-bold text-base">NAGA PAROCHIAL SCHOOL</div>
      <div>Naga City</div>
      <div class="mt-1 font-semibold tracking-wide">CASH DISBURSEMENT VOUCHER</div>
    </div>
    <div class="flex justify-between"><span>Voucher No.: <b>${esc(rec.voucherNo)}</b></span><span>Date: ${esc(fmtDate(rec.date))}</span></div>
    <div class="flex justify-between"><span>Pay to: <b>${esc(rec.payTo)}</b></span><span>Check No.: ${esc(rec.checkNo || '—')}</span></div>
    <div>Remarks: ${esc(rec.remarks || '—')}</div>
    <table class="w-full mt-3 border-t border-b border-black">
      <thead><tr class="text-[11px]"><th class="text-left py-1 pr-2">Code</th><th class="text-left py-1 px-2">Particulars</th><th class="text-right py-1 px-2">Debit</th><th class="text-right py-1 pl-2">Credit</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="font-bold border-t border-black"><td colspan="2" class="py-1 text-right pr-2">TOTAL</td><td class="text-right py-1 px-2 tnum">${num2(t.debit)}</td><td class="text-right py-1 pl-2 tnum">${num2(t.credit)}</td></tr></tfoot>
    </table>
    <div class="mt-2">Amount in words: <b>${amountInWords(t.debit)}</b></div>
    <div class="grid grid-cols-2 gap-6 mt-10 text-center text-[11px]">
      <div><div class="rule mb-1"></div>Prepared by</div>
      <div><div class="rule mb-1"></div>Approved by</div>
    </div>
    <div class="mt-5 text-center text-[11px] text-ink-secondary">Demo voucher — not an official document.</div>
  </div>`;
  openModal(modalChrome('Voucher — ' + rec.voucherNo, body), true);
}

function statementModal() {
  const s = student(ui.cashierStudentNo);
  if (!s) return;
  const rows = s.ledger.map(l => `<tr>
    <td class="py-1 pr-2">${esc(l.particular)}</td>
    <td class="py-1 px-2 text-right tnum">${num2(l.amount)}</td>
    <td class="py-1 px-2 text-right tnum">${num2(l.paid)}</td>
    <td class="py-1 pl-2 text-right tnum">${num2(ledgerBalance(l))}</td></tr>`).join('');
  const body = `<div class="doc p-6 text-[12px]">
    <div class="text-center mb-3"><div class="font-bold text-base">NAGA PAROCHIAL SCHOOL</div><div class="font-semibold">STATEMENT OF ACCOUNT</div></div>
    <div>${esc(s.name)} · ${esc(s.no)} · ${esc(s.grade)} ${esc(s.section)}</div>
    <table class="w-full mt-2 border-t border-b border-black">
      <thead><tr><th class="text-left py-1 pr-2">Particulars</th><th class="text-right py-1 px-2">Amount</th><th class="text-right py-1 px-2">Paid</th><th class="text-right py-1 pl-2">Balance</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="font-bold border-t border-black"><td colspan="3" class="text-right py-1 pr-2">TOTAL BALANCE</td><td class="text-right py-1 pl-2 tnum">${num2(studentBalance(s))}</td></tr></tfoot>
    </table></div>`;
  openModal(modalChrome('Statement of Account', body), true);
}

/* simple toast */
let toastTimer = null;
function toast(msg, tone) {
  const colors = { green: 'bg-ok-fg', rose: 'bg-nps-red', slate: 'bg-accent' };
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div'); el.id = 'toast';
    el.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] no-print';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="${colors[tone] || colors.slate} text-white text-sm font-medium px-4 py-2.5 rounded-md shadow-lg pop-in">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.innerHTML = ''; }, 2600);
}

/* ============================================================================
 * EVENT DELEGATION
 * ========================================================================== */
function onClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.getAttribute('data-action');
  switch (a) {
    case 'skip': { const m = $('#main'); if (m) m.focus(); break; }
    case 'selectStudent': ui.cashierStudentNo = t.getAttribute('data-student'); render(); break;
    case 'receivePayment': receivePayment(); break;
    case 'setOR': { const v = $('#orNo'); if (v) { state.orSeries = parseInt(v.value, 10) || state.orSeries; saveState(); toast('OR series set to ' + state.orSeries, 'slate'); } break; }
    case 'statement': statementModal(); break;
    case 'addCharge': addCharge(); break;
    case 'reportTab': ui.reportTab = t.getAttribute('data-tab'); render(); break;
    case 'postToBooks': postToBooks(); break;
    case 'printReport': window.print(); break;

    case 'voucherAddLine': syncVoucherFromDOM(); ui.voucher.lines.push({ code: '', particulars: '', type: 'C', amount: '' }); render(); break;
    case 'voucherRemoveLine': { syncVoucherFromDOM(); const i = +t.getAttribute('data-idx'); ui.voucher.lines.splice(i, 1); if (!ui.voucher.lines.length) ui.voucher.lines.push({ code: '', particulars: '', type: 'D', amount: '' }); render(); break; }
    case 'voucherSave': voucherSave(); break;
    case 'voucherReset': ui.voucher = freshVoucher(); render(); break;
    case 'printVoucher': { const d = state.disbursements.find(x => x.voucherNo === t.getAttribute('data-vno')); if (d) showVoucherDoc(d); break; }

    case 'jvAddLine': syncJvFromDOM(); ui.jv.lines.push({ code: '', particulars: '', type: 'C', amount: '' }); render(); break;
    case 'jvRemoveLine': { syncJvFromDOM(); const i = +t.getAttribute('data-idx'); ui.jv.lines.splice(i, 1); if (!ui.jv.lines.length) ui.jv.lines.push({ code: '', particulars: '', type: 'D', amount: '' }); render(); break; }
    case 'jvSave': jvSave(); break;
    case 'jvReset': ui.jv = freshJv(); render(); break;

    case 'doPrint': window.print(); break;
    case 'closeModal': case 'modalBackdrop': if (e.target === t || a === 'closeModal') closeModal(); break;
    case 'reset': if (confirm('Reset all demo data to the original seed?')) { resetState(); ui.cashierStudentNo = null; ui.voucher = null; ui.jv = null; render(); toast('Demo data reset.', 'slate'); } break;
  }
}

function onInput(e) {
  const el = e.target;
  const live = el.getAttribute && el.getAttribute('data-live');
  if (live === 'cashier') { recomputeChange(); return; }
  if (live === 'voucher') { recomputeTotals('voucher'); return; }
  if (live === 'jv') { recomputeTotals('jv'); return; }
  if (el.getAttribute && el.getAttribute('data-action') === 'cashierSearch') {
    ui.cashierSearch = el.value; // re-render list but keep focus by re-rendering then refocusing
    const pos = el.selectionStart;
    render();
    const again = $('[data-action="cashierSearch"]');
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (_) {} }
  }
}

/* keep draft fields (non-live) synced so add/remove line + save never lose typing */
function onChange(e) {
  const el = e.target;
  if (el.getAttribute && (el.getAttribute('data-vhead') || el.getAttribute('data-line') === 'voucher')) recomputeTotals('voucher');
  if (el.getAttribute && (el.getAttribute('data-jhead') || el.getAttribute('data-line') === 'jv')) recomputeTotals('jv');
  if (el.id === 'chStudent') { ui.cashierStudentNo = el.value || null; render(); }
}

/* ============================================================================
 * INIT
 * ========================================================================== */
window.addEventListener('hashchange', () => { closeModal(); render(); });
document.addEventListener('click', onClick);
document.addEventListener('input', onInput);
document.addEventListener('change', onChange);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (!el) return;
  // Enter in the cashier amount fields = receive payment
  if (el.id === 'amtTender' || el.id === 'amtPay') { e.preventDefault(); receivePayment(); return; }
  // Enter in the student search = select the first match
  if (el.getAttribute && el.getAttribute('data-action') === 'cashierSearch') {
    e.preventDefault();
    const first = document.querySelector('[data-action="selectStudent"]');
    if (first) { ui.cashierStudentNo = first.getAttribute('data-student'); render(); }
  }
});

if (!location.hash) location.hash = '#dashboard';
render();
