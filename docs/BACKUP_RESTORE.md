# ZhanX DentalCare — Backup & Restore

Two things must be protected:

1. **The PostgreSQL database** — patients, clinical records, billing, audit trail.
2. **Uploaded files** — `data\documents` and `data\branding` on the server.

The unified backup package (`.tar.gz`) bundles **both**:
- The PostgreSQL custom database dump (`database.dump`)
- All clinic files: `data/documents`, `data/photos`, `data/branding`, `data/consents`

When a backup is created or restored via the API / UI, both the database and the uploaded files are packaged and restored together as a complete clinic snapshot.

---

## 1. What the application does automatically

| Feature | Behaviour |
|---|---|
| Scheduled backup | The API runs `pg_dump` on the cron schedule in `.env` (`BACKUP_SCHEDULE`, default `0 21 * * *` = 21:00 daily, server local time). |
| Format | PostgreSQL custom format (`-Fc`), compressed, restorable with `pg_restore`. |
| Location | `data\backups` by default; `clinic_settings.backup_preferences.directory` can point to another disk/folder. |
| History | Every attempt is recorded in `backup_history` with size, status and error. |
| Retention | `BACKUP_RETENTION_DAYS` (default 30). Expired database dumps are deleted; `pre_restore` backups are exempt. |
| Verification | **Administration → Backup & restore → Verify** runs `pg_restore --list` and reports the number of readable entries. |
| Interrupted runs | If the API is stopped during a dump, the row is marked `failed` ("Interrupted by a server restart") the next time the API starts, so no backup is left stuck in `Running`. |
| Safety | A restore always creates a `pre_restore` backup before overwriting the database. |

The in-process schedule only runs while the API is running. If the server PC is switched
off at 21:00, that night's backup is skipped. For a clinic that shuts down at night, either
schedule the backup during working hours or add the Windows scheduled task described below.

### Manual backup from the UI

1. Sign in as Administrator.
2. **Administration → Backup & restore**.
3. Click **Create backup now**.
4. Click **Verify** on the new row. Keep the downloaded copy off the server PC
   (external drive, NAS or clinic cloud folder).

### Manual backup from PowerShell

```powershell
cd C:\ZhanX\Server
.\scripts\backup.ps1
```

It reads `.env`, finds `pg_dump`/`pg_restore`, writes
`data\backups\zhanx-<yyyyMMdd-HHmmss>.dump`, verifies the archive and applies retention.

Options:

```powershell
.\scripts\backup.ps1 -BackupDir "E:\ClinicBackups" -RetentionDays 60
.\scripts\backup.ps1 -Prefix "nightly"
```

### Nightly task outside the API

If you want backups even when the API is stopped, register a second scheduled task:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\ZhanX\Server\scripts\backup.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 9:00PM
Register-ScheduledTask -TaskName "ZhanX DentalCare Backup" -Action $action -Trigger $trigger `
  -User "SYSTEM" -RunLevel Highest -Force
```

Verify the first run by checking `data\backups\backup.log`.

---

## 2. Back up uploaded files

The DB stores only file **metadata** for patient documents and branding. Copy the folder
to the same backup destination, ideally immediately after the database dump:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = "E:\ClinicBackups\files-$stamp"
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item "C:\ZhanX\Server\data\documents" (Join-Path $target "documents") -Recurse -Force
Copy-Item "C:\ZhanX\Server\data\branding"  (Join-Path $target "branding")  -Recurse -Force
Copy-Item "C:\ZhanX\Server\data\license"   (Join-Path $target "license")   -Recurse -Force
Copy-Item "C:\ZhanX\Server\data\device"    (Join-Path $target "device")    -Recurse -Force
```

The `license` folder holds the signed license and `device` holds the DPAPI-protected
installation secret. Backing up both preserves the existing Device ID after a restore on
the same server. If they are lost, the Device ID changes and ZhanX Studio must reissue the
license — patient data is still intact. See [LICENSING.md](LICENSING.md#7-reinstalls-hardware-changes-and-recovery).

Keep the dump and the file copy under the same timestamp so they can be restored together.
Files on disk are also never deleted by uninstalling the client or the server application.

---

## 3. Restore from the UI

1. Sign in as Administrator.
2. **Administration → Backup & restore**.
3. Choose the backup → **Restore**.
4. Type `RESTORE` exactly and confirm.

The server:

1. takes a `pre_restore` backup,
2. terminates open database sessions,
3. runs `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction`,
4. returns the restored file name and the safety backup name.

The current session may be invalidated by the restore. Sign in again with the credentials
that were valid when the backup was taken. If the API process needs a restart after a
restore, restart the **ZhanX DentalCare API** scheduled task.

> A UI restore automatically restores **both** the database and all uploaded clinic files (documents, X-rays, photos, consents, branding) when restoring from a unified `.tar.gz` package. Legacy `.dump` files restore the database.

---

## 4. Restore from PowerShell (recommended for disaster recovery)

Use this when the API cannot start, or when restoring onto a fresh server.

```powershell
cd C:\ZhanX\Server
.\scripts\restore.ps1 -Archive "E:\ClinicBackups\zhanx-20261029-210000.dump"
```

The script:

1. verifies the archive with `pg_restore --list`,
2. asks you to type `RESTORE` (unless `-Force`),
3. creates a pre-restore backup via `backup.ps1`,
4. stops the **ZhanX DentalCare API** task,
5. closes open sessions,
6. restores with `--clean --if-exists --no-owner --no-privileges --single-transaction`,
7. prints counts for users, patients, invoices and audit entries,
8. restarts the API and checks `/api/health`.

Options:

```powershell
.\scripts\restore.ps1 -Archive .\backups\zhanx-20261029-210000.dump -Force
.\scripts\restore.ps1 -Archive D:\drop\zhanx-20261029-210000.dump -KeepServiceStopped
```

If `pg_restore` reports a failure, the transaction is rolled back by
`--single-transaction`; the database remains as it was. Fix the cause (wrong archive,
version mismatch, permissions) before retrying. The pre-restore backup is in
`data\backups\pre-restore-*.dump`.

After a successful restore, copy the matching `documents`/`branding` folders back into
`C:\ZhanX\Server\data\`.

---

## 5. Restore onto a new server PC

1. Install Node.js and PostgreSQL as in `INSTALLATION.md`.
2. Extract the server package and run `setup-server.ps1` — this creates an **empty**
   database and a new administrator.
3. Restore the latest dump with `restore.ps1`. The dump replaces the newly created
   database contents, including the administrator account from the backup.
4. Copy the matching `documents` and `branding` folders into `data\`.
5. Sign in with the credentials that were valid when the backup was taken.
6. Point every client at the new server address (**Server settings** on the sign-in screen
   or `setup-client.ps1`).

---

## 6. Recovery drill (do this quarterly)

1. Create a backup and verify it.
2. Restore it into a **separate test database** (never the live one).
3. Sign in, open a patient with documents, an invoice with payments and the audit log.
4. Record the date and result in the clinic's operations log.

If the drill has never been run, you do not yet know that the backups are usable.

---

## 7. Retention and off-site copies

| Copy | Frequency | Retention | Location |
|---|---|---|---|
| Automatic/UI dumps | Daily | 30 days (configurable) | Server disk |
| Off-site dump copy | Daily or weekly | 90+ days | External drive / NAS / clinic cloud |
| Uploaded documents | Same schedule as dumps | Match dump retention | Same off-site destination |
| Quarterly restore test | Quarterly | Keep the report | Clinic records |

- Keep at least one copy **outside the server PC**. Ransomware and disk failure do not
  distinguish between the database and its backups on the same disk.
- Encrypt external drives (BitLocker) because dumps contain patient health information.
- Uninstalling the desktop client or the server application never deletes the database,
  backups or patient files.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `pg_dump.exe not found` | Set `PG_BIN_DIR`, `PG_DUMP_BIN`, `PG_RESTORE_BIN` in `.env`, or pass `-PgBin "C:\Program Files\PostgreSQL\18\bin"`. |
| Backup status `failed` | Open the row's error in the UI or `data\backups\backup.log`. Common causes: wrong DB password, PostgreSQL service stopped, disk full. |
| Backup file is 0 bytes | Check free disk space and PostgreSQL logs; run `backup.ps1` manually for the full error. |
| Restore fails with "database is being accessed by other users" | Stop the API task, run `restore.ps1` (it terminates sessions), or close `pgAdmin`/`psql` windows. |
| Restore succeeds but files are missing | The dump contains only the database; restore `data\documents` from the file backup. |
| Restored data looks old | Confirm you restored the intended timestamp; all dumps are listed with their creation time. |
| Login fails after restore | The user table came from the backup — use the password that was valid then, not the current one. |
