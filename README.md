# ZhanX DentalCare

A Windows desktop dental clinic management system for a single clinic, built by
**ZhanX Studio**. React + Electron client, Node/Express API, PostgreSQL database, designed
to run on a clinic LAN without internet access.

Every module writes to a real PostgreSQL database through an authenticated API. The
client never connects to PostgreSQL and never receives database credentials.

---

## Modules

| Area | Capability |
|---|---|
| Authentication | Username/password, bcrypt, 15-minute access tokens, rotating revocable refresh sessions, lockout after repeated failures, forced password change |
| Roles | Administrator, Dentist, Receptionist, Dental Assistant — 39 permission codes enforced on the server |
| Dashboard | Daily KPIs, collections, upcoming appointments, recent visits and payments, low-stock and expiry alerts |
| Patients | Registration with duplicate warnings, 10 profile tabs, medical history and consent, documents, activity timeline |
| Appointments | Day/week calendar, slot validation, database-level overlap prevention, status history, waiting queue |
| Dental chart | Adult and primary FDI charts, condition catalog, per-tooth history, superseded (never overwritten) findings |
| Consultations | Draft/finalize/amend workflow, diagnosis, follow-up, linked appointment status |
| Treatment plans | Proposed vs completed procedures, discounts (dentist/admin authorization), estimates and PDF |
| Prescriptions | Medicines, dosage, instructions, dentist approval, A4 PDF |
| Billing | Invoices with line items and tax, partial payments, refunds, receipts, void workflow, idempotent collection, append-only financial records |
| Inventory | Items, batches, expiry, suppliers, stock movements, low-stock/expiry alerts |
| Dental lab | Optional lab module, labs, work orders and status tracking |
| Reports | 22 operational and financial reports with JSON preview, CSV, Excel and PDF export |
| Administration | Users & roles, clinic settings and branding, treatment catalog, backups, audit logs |
| Backup | Scheduled/manual `pg_dump`, verification, retention, pre-restore safety backup, typed confirmation |

---

## Stack

- **Client:** React 18, Vite, JavaScript/JSX (no TypeScript), Tailwind CSS, React Router,
  TanStack Query, React Hook Form, Zod, Lucide icons, Recharts
- **Desktop:** Electron 33, context isolation, sandbox, no Node integration, CSP,
  navigation guards, safeStorage-encrypted refresh token, NSIS installer
- **API:** Node.js 20+, Express, Zod, pino logging, centralized error handling,
  helmet, rate limiting, bcrypt
- **Database:** PostgreSQL 16+, UUID keys, `NUMERIC(12,2)` money, transactions, constraints,
  indexes, `btree_gist` exclusion constraint, append-only audit triggers
- **Exports:** pdfkit (A4 PDFs), ExcelJS, CSV (UTF-8 BOM)

---

## Repository layout

```text
apps/
  server/            Express API, services, middleware, database scripts
  desktop/           React renderer, Electron main/preload, Vite config
database/
  migrations/        SQL migrations (applied in filename order)
docs/                INSTALLATION, LICENSING, DATABASE, BACKUP_RESTORE, NETWORK_SETUP, TROUBLESHOOTING
scripts/             setup-server, setup-client, backup, restore, build-server-package
tools/
  license-generator/ Private offline license signer (never packaged or distributed)
```

---

## Development quick start

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 16+ running locally

### 2. Install dependencies

```powershell
npm install
```

### 3. Configure the environment

```powershell
Copy-Item .env.example .env
```

Edit `.env` for your database. The example uses port `55432` because the development
machine may already run another PostgreSQL on `5432`, and Windows sometimes reserves
ports in the 54xx range; adjust `DB_PORT` to match your instance. Never commit `.env`.

Create the role and database once:

```powershell
$env:PGPASSWORD="<postgres password>"
psql -h 127.0.0.1 -p 5432 -U postgres -c "CREATE ROLE zhanx_app LOGIN PASSWORD '<db password>';"
psql -h 127.0.0.1 -p 5432 -U postgres -c "CREATE DATABASE zhanx_dentalcare OWNER zhanx_app;"
```

**Development cluster without admin rights.** If PostgreSQL is installed but the Windows
service cannot be used, the app can run against a project-local cluster created with
`initdb` on port `55432`. Its data directory lives outside the project
(`%LOCALAPPDATA%\ZhanX\dev-pgdata`) so OneDrive never syncs a live database. Start and
stop it with:

```powershell
.\scripts\dev-db.ps1 start
.\scripts\dev-db.ps1 status
.\scripts\dev-db.ps1 stop
```

Run this once after a reboot before starting the API. The server log is written to
`%LOCALAPPDATA%\ZhanX\logs\postgres.log`; if a `.pgdata` folder also exists inside the
project it is ignored while the LOCALAPPDATA cluster is present.

### 4. Migrate and seed

```powershell
npm run migrate

# development only: demo staff + 5 demo patients
cd apps\server
node src\database\seed.js --demo
```

The seed prints the administrator password once. The current local development database
uses:

```text
Administrator : admin / Admin@12345
Demo staff    : dr.arjun, priya.front, kavya.assist / Demo@12345
```

These are development credentials only. A production installation creates its own
administrator with a generated password and starts with an empty clinic database.

### 5. Run

```powershell
npm run dev
```

This starts the API (`http://127.0.0.1:4000`), Vite (`http://127.0.0.1:5173`) and Electron.

Useful individual commands:

```powershell
npm run dev:server     # API with --watch
npm run dev:vite       # renderer only
npm run dev:electron   # Electron against the running Vite server
```

### 6. Tests

```powershell
npm test
```

Tests use Node's built-in test runner with supertest. Each test file recreates
`zhanx_test` from the migrations and seeds reference data only; it never touches the
development database. The application role has no `CREATEDB`, so the harness drops and
recreates the database as a superuser: set `TEST_DB_ADMIN_USER` (default `postgres`) and
`TEST_DB_ADMIN_PASSWORD` if that account needs a password.

```powershell
$env:TEST_DB_ADMIN_USER="postgres"
$env:TEST_DB_ADMIN_PASSWORD="<superuser password>"
npm test
```

---

## Builds

### Desktop client (NSIS installer)

```powershell
npm run build:desktop     # renderer bundle only
npm run dist:client       # build + NSIS installer in release\client
```

The installer is per-user, allows a custom directory, and **does not delete clinic data**
on uninstall (`deleteAppDataOnUninstall: false`).

`electron-builder` downloads NSIS and winCodeSign into its cache. On locked-down build
machines the download/rename step can fail with "Access is denied" or a symlink privilege
error. Pre-extract the three tool directories once and point the builder at them:

```powershell
$env:ELECTRON_BUILDER_CACHE="$PWD\.builder-cache\"
npm run dist:client
```

The cache must contain `nsis\nsis-3.0.4.1\`, `nsis\nsis-resources-3.4.1\` and
`winCodeSign\winCodeSign-2.6.0\` (the winCodeSign archive is extracted with `-x'!darwin*'`,
since the darwin symlinks cannot be created without the symlink privilege). `.builder-cache`
is git-ignored and is only a build-time convenience.

### Server package

```powershell
npm run dist:server
```

Produces `release\server\ZhanX-DentalCare-Server-<version>.zip` containing the API,
production dependencies, migrations, scripts and docs. It never contains `.env`, `data`,
`.pgdata` or development dependencies.

---

## Security notes

- Passwords are bcrypt hashes (cost 12); plaintext passwords are never stored or logged.
- Refresh tokens are random, hashed at rest, rotated on use and revocable.
- Login attempts are rate-limited and accounts lock temporarily after repeated failures.
- Every protected route checks a permission on the server; hiding a button is not access
  control.
- Audit logs are append-only (database trigger blocks update/delete).
- Financial records are append-only: payments/refunds cannot be deleted, finalized invoices
  can only be voided, and the database rejects deletion.
- Money is stored as `NUMERIC(12,2)` and calculated in integer paise with `BigInt`.
- PostgreSQL credentials stay in the server `.env`; the Electron renderer has no database
  access and no Node integration.
- Production requires a JWT secret of at least 32 characters.

---

## Documentation

- [Installation](docs/INSTALLATION.md)
- [Licensing, activation and reinstalls](docs/LICENSING.md)
- [Database](docs/DATABASE.md)
- [Backup & restore](docs/BACKUP_RESTORE.md)
- [Network setup](docs/NETWORK_SETUP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

---

© ZhanX Studio. Proprietary software for the licensed clinic.
