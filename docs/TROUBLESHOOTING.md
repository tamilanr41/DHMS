# ZhanX DentalCare — Troubleshooting

Start with the three checks below; they isolate most problems to server, database or client.

```powershell
# 1. Is the API process listening?
Get-NetTCPConnection -LocalPort 4000 -State Listen

# 2. Is the API healthy and connected to PostgreSQL?
Invoke-RestMethod http://127.0.0.1:4000/api/health | ConvertTo-Json -Depth 4

# 3. What does the server log say?
Get-Content C:\ZhanX\Server\logs\server.log -Tail 80
```

| Health result | Meaning |
|---|---|
| `status: ok`, `database: true` | Server is healthy; investigate the client or the specific action |
| `status: degraded`, `database: false` | API runs but PostgreSQL is unreachable |
| Connection refused | API is not running or is bound to another port |
| Timeout from a client PC | Firewall, wrong IP, or network profile is Public |

---

## 1. Server does not start

### `Failed to start server: JWT_SECRET must be set...`

Production requires a secret of at least 32 characters. `setup-server.ps1` generates one.
If `.env` was edited, restore the value or regenerate and restart:

```powershell
cd C:\ZhanX\Server
# inspect without printing secrets to the screen
Select-String -Path .env -Pattern '^JWT_SECRET=' | ForEach-Object { "JWT_SECRET length: $($_.Line.Length - 11)" }
```

Changing `JWT_SECRET` invalidates every existing session; users simply sign in again.

### `EADDRINUSE` / port 4000 already in use

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen | Select-Object OwningProcess
Get-Process -Id <pid> | Select-Object Id, ProcessName, Path
```

Stop the conflicting process, or change `PORT` in `.env` and the firewall rule, then update
every client's server address.

### The scheduled task runs but nothing listens

```powershell
Get-ScheduledTask "ZhanX DentalCare API" | Select-Object State
Start-ScheduledTask "ZhanX DentalCare API"
Get-Content C:\ZhanX\Server\logs\server.log -Tail 40
```

Common causes:

- Node.js was uninstalled or moved. `start-server.cmd` contains the full path to `node.exe`.
  Reinstall Node.js, then re-run `setup-server.ps1` (or edit `start-server.cmd`).
- The install folder was moved or renamed. Re-run `setup-server.ps1` from the new location.
- `.env` permissions no longer allow SYSTEM to read it. Re-apply:

  ```powershell
  icacls C:\ZhanX\Server\.env /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(F)"
  ```

---

## 2. Database problems

### `password authentication failed for user "zhanx_app"`

The password in `.env` no longer matches the PostgreSQL role (for example after a manual
`ALTER ROLE`). Reset it as the `postgres` superuser, then update `.env`:

```sql
ALTER ROLE zhanx_app WITH LOGIN PASSWORD 'new-strong-password';
```

Restart the API after editing `.env`.

### `ECONNREFUSED 127.0.0.1:5432`

PostgreSQL is not running, or is on another port.

```powershell
Get-Service *postgres*
Start-Service postgresql-x64-18
Select-String -Path C:\ZhanX\Server\.env -Pattern '^DB_PORT='
```

### `database "zhanx_dentalcare" does not exist`

Re-run the setup script (it is idempotent) or create it as described in `INSTALLATION.md`.
Do not point the application at a different empty database and assume it is configured.

### `Migration ... failed: extension "btree_gist" is not available`

`btree_gist` must be created by a superuser. Run once as `postgres`:

```sql
\c zhanx_dentalcare
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

`setup-server.ps1` does this automatically. If you created the database manually, do it now.

### Migration failed halfway

Each migration runs inside a transaction; a failed migration is rolled back and not
recorded. Fix the cause and run `node src\database\migrate.js` again. Never edit an
already-applied migration; add a new numbered file.

---

## 3. Clients cannot reach the server

```powershell
# on the client PC
Test-NetConnection 192.168.1.10 -Port 4000
Invoke-RestMethod http://192.168.1.10:4000/api/health
```

- **Ping works, port fails** → firewall or API bound to `127.0.0.1`.
- **Nothing works, other PCs are fine** → client is on guest Wi-Fi/VLAN with isolation, or
  has a wrong address. Check **Server settings**.
- **Firewall rule exists but still blocked** → the network profile is Public. Run
  `Set-NetConnectionProfile -NetworkCategory Private`.
- **Address changed** → set a DHCP reservation and update clients, or re-run
  `setup-client.ps1 -ServerUrl ...`.

The client stores its server address at:

```text
%APPDATA%\ZhanX DentalCare\server-config.json
```

Delete that file only if you want the client to fall back to the default; then set the
address again from the sign-in screen.

---

## 4. Sign-in and permissions

| Symptom | Cause | Fix |
|---|---|---|
| "Invalid username or password" | Wrong credentials | Check username; passwords are case-sensitive |
| "Account is locked" | Too many failed attempts (`LOGIN_MAX_ATTEMPTS`, default 5) | Wait for `LOGIN_LOCK_MINUTES` (default 15) or reset the password |
| Forced to the change-password screen | `must_change_password` is true | Set a new password; the app unlocks automatically |
| 401 after being idle | Access token expired (15 min) and refresh failed | Sign in again. If it happens immediately, check that the server clock is correct |
| 403 / "You do not have access" | Role lacks the permission | Administrator updates the role/user; permissions are enforced on the server |
| Administrator locked out | Password lost | On the server run `node src\database\create-admin.js --reset-password` |

### Activation and licensing problems

| Symptom | Cause | Fix |
|---|---|---|
| App shows the activation screen instead of sign-in | No valid license for this Device ID | Send the shown Device ID to ZhanX Studio and import the signed license |
| "License was issued for another computer" | Device ID changed (Windows reinstall, disk replacement, new secret) | Request a reissued license for the new Device ID |
| "License signature is invalid" | File edited, truncated or not a ZhanX license | Re-import the original file; request a new license if lost |
| "License has expired" | Subscription/evaluation expiry reached | Import a renewed license; data is untouched |
| "Device identity could not be read" | Windows registry/volume serial unavailable | Reboot and retry; contact support with the error text |
| Activation accepted but sign-in says `LICENSE_REQUIRED` | License file moved/deleted after activation | Re-import the license; check `data\license\zhanx.license.json` |
| Setup screen never appears | An account already exists | Sign in; use **Users & roles** to add staff |
| Setup returns 409 | First administrator already created | Sign in with that account or reset its password |

Run `Invoke-RestMethod http://127.0.0.1:4000/api/license/status` on the server (or open
`data\license\zhanx.license.json`) to see the current state and failure reason. Full
detail is in `docs\LICENSING.md`.

Reset an administrator password on the server:

```powershell
cd C:\ZhanX\Server\server
node src\database\create-admin.js --reset-password
```

This also unlocks the account and revokes all refresh sessions.

---

## 5. Desktop client problems

### Blank or white window

1. Confirm the API health check works from that PC.
2. Close the app completely (Task Manager → **ZhanX DentalCare**) and reopen.
3. Reinstall the client over the existing installation (settings are preserved).
4. Check Windows Event Viewer → **Windows Logs → Application** for an Electron crash.

### "Server settings" button does nothing / cannot save

The address can only be changed in the installed desktop client. In browser development
mode, set `VITE_API_URL` instead.

### The app opens on the wrong server

Edit or delete `%APPDATA%\ZhanX DentalCare\server-config.json` and set the address again.

### PDF does not open

PDFs are written to `%TEMP%\zhanx-prints` and opened with the default PDF application.
Install a PDF viewer (Edge, Adobe Reader, SumatraPDF) and set it as the default for `.pdf`.

### Uninstall concerns

Uninstalling the client removes application files only. It does not remove the clinic
database, backups or documents, which live on the server. `%APPDATA%` settings may remain.

---

## 6. Billing problems

| Symptom | Reason | Fix |
|---|---|---|
| "Finalize the invoice before collecting payment" | Draft invoice | Open the invoice → **Finalize** |
| "Amount exceeds the outstanding balance" | Payment larger than the balance | Collect the exact outstanding amount; the limit is enforced with exact decimal math |
| "This invoice is already fully paid" | Status is `paid` | Issue a refund first if money must be returned |
| "This invoice has collected payments. Refund the payments before voiding" | Voiding with money collected | Refund first, then void |
| "Only draft invoices can be edited/deleted" | Invoice already issued | Create a credit/refund or void workflow instead of editing |
| "Payment has refunds recorded against it" | Voiding a refunded payment | Reverse through the refund workflow; records are append-only |
| Duplicate payment appears once | Idempotency key replay | Expected: the API returns the original payment with `idempotentReplay: true` |
| Totals look wrong | Check tax percent and line discounts | Subtotal, discount, tax and total are computed server-side in integer paise; verify the inputs |

Financial rows cannot be deleted from the database for a reason. Use void and refund
workflows so the audit trail and reports remain correct.

---

## 7. Clinical modules

- **Appointment overlap (409)** — the same dentist already has an active appointment in
  that time range. Choose another slot, dentist or chair. Cancelled/no-show appointments
  do not block a slot.
- **Cannot complete a consultation** — a diagnosis is required. Save the diagnosis, then
  complete. Completed consultations are amended, never overwritten.
- **Dental chart history** — previous findings are superseded, not deleted. Use the tooth
  history panel to see who changed what.
- **Prescription requires a dentist** — a non-dentist must select the prescribing dentist.
- **Prescription PDF missing signature** — upload the dentist signature in **Clinic settings**.

---

## 8. Documents and images

- Uploaded files live on the **server** in `data\documents`; the client only previews them.
  If previews fail, check that folder exists and SYSTEM can read it.
- `UPLOAD_MAX_MB` (default 10) limits each upload. Increase it in `.env` and restart the API.
- Supported types: PDF, JPEG, PNG, WebP, TIFF, DICOM.
- Database backups do **not** include these files. See `BACKUP_RESTORE.md`.

---

## 9. Reports and exports

- Reports default to the last 30 days. Set an explicit range for older data.
- Financial reports require the `reports.financial` permission (Administrator, Dentist).
- CSV opens correctly in Excel because it is UTF-8 with a BOM.
- Exports are capped at 20,000 rows per file. Narrow the range if you hit the cap.
- If a report is slow, run it on the server PC and check PostgreSQL load; avoid multi-year
  ranges across every module.

---

## 10. Backups and restore

See `BACKUP_RESTORE.md` for the full procedure. Quick answers:

| Symptom | Fix |
|---|---|
| `pg_dump.exe not found` | Set `PG_BIN_DIR`/`PG_DUMP_BIN` in `.env` or pass `-PgBin` |
| Backup failed | Check the error in the UI, `data\backups\backup.log`, disk space and the PostgreSQL service |
| Restore blocked by active sessions | Stop the API task; `restore.ps1` terminates sessions |
| Data restored but documents missing | Copy `data\documents` from the matching file backup |
| Login fails after restore | Use the password that was valid when the backup was taken |

---

## 11. Performance

- A clinic-sized database (tens of thousands of records) should respond in well under
  a second on a wired LAN.
- Use wired Ethernet for the server; Wi-Fi is acceptable for chairside clients.
- Keep `DB_POOL_MAX` at 10 unless you have a measured reason to change it.
- Do not run PostgreSQL on a laptop that sleeps or is switched off during clinic hours.
- If the dashboard is slow, check `pg_stat_activity` for long-running queries and confirm
  autovacuum is running.

---

## 12. Collecting diagnostics for support

Run on the server:

```powershell
$out = "C:\ZhanX\diagnostics-$(Get-Date -Format yyyyMMdd-HHmmss).txt"
"== Health ==" | Out-File $out
try { Invoke-RestMethod http://127.0.0.1:4000/api/health | ConvertTo-Json -Depth 4 | Out-File $out -Append } catch { $_ | Out-File $out -Append }
"== Task ==" | Out-File $out -Append
Get-ScheduledTask "ZhanX DentalCare API" | Format-List State, TaskName | Out-File $out -Append
"== Service ==" | Out-File $out -Append
Get-Service *postgres* | Format-Table Name, Status | Out-File $out -Append
"== Listening ==" | Out-File $out -Append
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | Format-Table LocalAddress, State, OwningProcess | Out-File $out -Append
"== Log (last 100) ==" | Out-File $out -Append
Get-Content C:\ZhanX\Server\logs\server.log -Tail 100 | Out-File $out -Append
```

Review the file before sending it: logs can contain patient names and invoice numbers.
Never send `.env`, database dumps or patient documents to a third party.
