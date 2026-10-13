/* ============================================================================
 * NPS Finance — demo data + state
 * Seeds realistic Philippine-school accounting data and persists to
 * localStorage. All figures are mock. See docs/legacy-accounting-analysis.md.
 * ========================================================================== */

const STORE_KEY = 'nps_finance_demo_v1';

/* ---- Chart of Accounts (Books foundation data) ----------------------------
 * Codes 589 = EQUIPMENT and 3444 = CIB-PNB come straight from the legacy
 * screenshot; the rest are plausible for a private school.                    */
const CHART_OF_ACCOUNTS = [
  { code: '101',  name: 'Cash on Hand',                 type: 'Asset'     },
  { code: '102',  name: 'Cash in Bank - BDO',           type: 'Asset'     },
  { code: '3444', name: 'Cash in Bank - PNB (CIB-PNB)', type: 'Asset'     },
  { code: '589',  name: 'Equipment',                    type: 'Asset'     },
  { code: '201',  name: 'Accounts Payable',             type: 'Liability' },
  { code: '401',  name: 'Tuition Fee Income',           type: 'Income'    },
  { code: '402',  name: 'Registration Fee',             type: 'Income'    },
  { code: '403',  name: 'Miscellaneous Fee',            type: 'Income'    },
  { code: '404',  name: 'Books & Modules',              type: 'Income'    },
  { code: '405',  name: 'ID & School Supplies',         type: 'Income'    },
  { code: '406',  name: 'Other Fees',                   type: 'Income'    },
  { code: '501',  name: 'Salaries & Wages',             type: 'Expense'   },
  { code: '502',  name: 'Light & Water',                type: 'Expense'   },
  { code: '503',  name: 'Office & School Supplies',     type: 'Expense'   },
  { code: '504',  name: 'Repairs & Maintenance',        type: 'Expense'   },
  { code: '505',  name: 'Professional Fees',            type: 'Expense'   },
];

/* ---- Payees (Books master list) ------------------------------------------ */
const PAYEES = [
  { code: 'P-001', name: 'Camarines Norte Electric Coop (CANORECO)' },
  { code: 'P-002', name: 'Daet Water District' },
  { code: 'P-003', name: 'National Book Store - Daet' },
  { code: 'P-004', name: 'JRS Computer & Office Supplies' },
  { code: 'P-005', name: 'Metro Office Equipment Inc.' },
  { code: 'P-006', name: 'Payroll - Teaching Staff' },
];

/* ---- Students + ledgers (Collections side) -------------------------------
 * Each ledger line is a charge tied to an income account code so Collection
 * Reports can be summarized per account.                                      */
function seedStudents() {
  const mk = (account, particular, dueDate, amount, paid = 0) =>
    ({ id: cryptoId(), account, particular, dueDate, amount, paid });
  return [
    {
      no: '2026-00142', name: 'Abell, Maria Clara S.', grade: 'Grade 7', section: 'St. Dominic',
      ledger: [
        mk('402', 'Registration Fee',     '2026-06-05', 1500, 1500),
        mk('401', 'Tuition Fee - 1st Qtr','2026-07-05', 6500, 6500),
        mk('401', 'Tuition Fee - 2nd Qtr','2026-09-05', 6500, 2000),
        mk('403', 'Miscellaneous Fee',    '2026-07-05', 3200, 0),
        mk('404', 'Books & Modules',      '2026-06-20', 2750, 0),
      ],
    },
    {
      no: '2026-00187', name: 'Borja, Juan Miguel D.', grade: 'Grade 10', section: 'St. Thomas',
      ledger: [
        mk('402', 'Registration Fee',     '2026-06-05', 1500, 1500),
        mk('401', 'Tuition Fee - 1st Qtr','2026-07-05', 7200, 7200),
        mk('401', 'Tuition Fee - 2nd Qtr','2026-09-05', 7200, 0),
        mk('403', 'Miscellaneous Fee',    '2026-07-05', 3500, 3500),
        mk('405', 'ID & School Supplies', '2026-06-20',  650, 0),
      ],
    },
    {
      no: '2026-00203', name: 'Castillo, Angela R.', grade: 'Grade 4', section: 'Sampaguita',
      ledger: [
        mk('402', 'Registration Fee',     '2026-06-05', 1200, 1200),
        mk('401', 'Tuition Fee - 1st Qtr','2026-07-05', 5800, 5800),
        mk('401', 'Tuition Fee - 2nd Qtr','2026-09-05', 5800, 5800),
        mk('403', 'Miscellaneous Fee',    '2026-07-05', 2800, 2800),
        mk('406', 'Field Trip Fee',       '2026-10-10',  900, 0),
      ],
    },
    {
      no: '2026-00241', name: 'Dela Cruz, Paolo V.', grade: 'Grade 11 - STEM', section: 'Newton',
      ledger: [
        mk('402', 'Registration Fee',     '2026-06-05', 1800, 0),
        mk('401', 'Tuition Fee - 1st Qtr','2026-07-05', 8900, 0),
        mk('403', 'Miscellaneous Fee',    '2026-07-05', 4200, 0),
        mk('404', 'Books & Modules',      '2026-06-20', 3400, 0),
      ],
    },
    {
      no: '2026-00268', name: 'Enriquez, Sofia Mae L.', grade: 'Grade 1', section: 'Rosal',
      ledger: [
        mk('402', 'Registration Fee',     '2026-06-05', 1200, 1200),
        mk('401', 'Tuition Fee - 1st Qtr','2026-07-05', 5200, 5200),
        mk('401', 'Tuition Fee - 2nd Qtr','2026-09-05', 5200, 1500),
        mk('405', 'ID & School Supplies', '2026-06-20',  550, 550),
      ],
    },
    {
      no: '2026-00290', name: 'Fernandez, Gabriel A.', grade: 'Grade 8', section: 'St. Francis',
      ledger: [
        mk('402', 'Registration Fee',     '2026-06-05', 1500, 1500),
        mk('401', 'Tuition Fee - 1st Qtr','2026-07-05', 6800, 6800),
        mk('401', 'Tuition Fee - 2nd Qtr','2026-09-05', 6800, 6800),
        mk('401', 'Tuition Fee - 3rd Qtr','2026-11-05', 6800, 0),
        mk('403', 'Miscellaneous Fee',    '2026-07-05', 3200, 0),
      ],
    },
  ];
}

/* ---- Pre-recorded sample disbursement (so CDB is not empty) --------------- */
function seedDisbursements() {
  return [
    {
      voucherNo: '26-029561', date: '2026-09-28', checkNo: '0001452', checkDate: '2026-09-28',
      payToCode: 'P-005', payTo: 'Metro Office Equipment Inc.',
      remarks: 'Purchase of 5 units desktop computers for the computer lab.',
      lines: [
        { code: '589',  particulars: 'Equipment - 5 desktop units', type: 'D', amount: 50000 },
        { code: '3444', particulars: 'Cash in Bank - PNB',          type: 'C', amount: 50000 },
      ],
    },
  ];
}

/* ---- Pre-recorded sample journal voucher ---------------------------------- */
function seedJournal() {
  return [
    {
      jvNo: 'JV-26-0088', date: '2026-09-30',
      remarks: 'To record depreciation of equipment for September 2026.',
      lines: [
        { code: '504', particulars: 'Depreciation expense', type: 'D', amount: 1250 },
        { code: '589', particulars: 'Accumulated depreciation', type: 'C', amount: 1250 },
      ],
    },
  ];
}

function defaultState() {
  return {
    version: 1,
    schoolYear: '2026-2027',
    orSeries: 102501,          // next OR number
    voucherPrefix: '26',       // year prefix for voucher series
    voucherSeq: 29562,         // next voucher sequence -> 26-029562
    jvSeq: 89,                 // next journal voucher sequence
    chartOfAccounts: CHART_OF_ACCOUNTS,
    payees: PAYEES,
    students: seedStudents(),
    collections: [],           // posted cashier payments (also feeds CRB)
    disbursements: seedDisbursements(), // CDB
    journal: seedJournal(),    // JVB
  };
}

/* ---- tiny id helper (no crypto dependency required) ----------------------- */
function cryptoId() {
  return 'id-' + Math.random().toString(36).slice(2, 10);
}

/* ---- persistence ---------------------------------------------------------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) return parsed;
    }
  } catch (e) { /* ignore — fall back to seed */ }
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { /* storage may be blocked; demo still works in memory */ }
}

function resetState() {
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  state = defaultState();
  saveState();
}

/* global mutable state */
let state = loadState();
