# ZhanX DentalCare — Installation

This guide installs the clinic system on Windows. A typical clinic has **one server PC**
(which runs PostgreSQL and the API) and one or more **front-desk / chairside PCs**
(which run the desktop client).

- Server package: `ZhanX-DentalCare-Server-<version>.zip` (API + database scripts + docs)
- Client installer: `ZhanX DentalCare Setup <version>.exe` (Electron/NSIS, per-user)

> The client never connects to PostgreSQL directly. It only talks to the HTTP API
> on the server, so database credentials never leave the server PC.

---

## 1. Requirements

| Component | Requirement |
|---|---|
| Windows | Windows 10/11 x64, or Windows Server 2016+ |
| Server software | Node.js 20 LTS or newer |
| Database | PostgreSQL 16 or newer (18 recommended) |
| Privileges | Local administrator on the server PC (for setup) |
| Network | Wired LAN recommended; static IP or DHCP reservation for the server |
| Disk | Database + documents; plan backup space separately (see `BACKUP_RESTORE.md`) |

The desktop client bundles its own runtime — the clinic PCs do **not** need Node.js,
PostgreSQL or internet access.

---

## 2. Server installation

### 2.1 Install prerequisites

1. Install **Node.js 20 LTS** (or newer) from <https://nodejs.org>. Accept the default
   options so `node` and `npm` are on the system PATH.
2. Install **PostgreSQL** from <https://www.postgresql.org/download/windows/>.
   - Remember the `postgres` superuser password.
   - Keep the default port `5432` unless it conflicts with another database.
   - The Windows service must be running (`postgresql-x64-18` or similar).
3. Extract `ZhanX-DentalCare-Server-<version>.zip` to a permanent folder, for example:

   ```text
   C:\ZhanX\Server\
     server\            API source and production node_modules
     database\          migrations
     docs\              these documents
     scripts\           setup, backup, restore, packaging scripts
     .env.example
     start-server.cmd
   ```

   Do **not** run the server from `Downloads` or a temporary folder.

### 2.2 Run the setup script

Open **PowerShell as Administrator**, then:

```powershell
cd C:\ZhanX\Server
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\setup-server.ps1
```

The script is interactive and performs these steps:

1. Verifies Node.js ≥ 20 and finds the PostgreSQL tools.
2. Connects to PostgreSQL as `postgres`.
3. Creates the login role `zhanx_app` and the database `zhanx_dentalcare`
   (an existing database is left untouched).
4. Enables the `btree_gist` extension used by the appointment-overlap constraint.
5. Writes a production `.env` with a **newly generated 96-character JWT secret** and a
   random database password, then restricts the file ACL to SYSTEM/Administrators.
6. Installs production-only Node dependencies.
7. Applies database migrations. **No staff account is created by default** — the first
   administrator is created inside the app after license activation.
8. Registers the scheduled task **ZhanX DentalCare API** to start the API at boot as SYSTEM.
9. Opens inbound TCP **4000** for the Private and Domain firewall profiles.
10. Starts the API and waits for `/api/health` to report `database: true`.

At the end it prints the LAN URL and the next steps (activate the license, then create
the administrator in the app).

#### Optional parameters

```powershell
.\scripts\setup-server.ps1 `
  -PgPort 5432 `
  -ApiPort 4000 `
  -DbName zhanx_dentalcare `
  -DbUser zhanx_app `
  -BackupDir "D:\ClinicBackups"
```

| Parameter | Default | Purpose |
|---|---|---|
| `-InstallDir` | package folder | Where the server is installed |
| `-PgHost` / `-PgPort` | `127.0.0.1` / `5432` | PostgreSQL location |
| `-PgBin` | auto-detected | Folder containing `psql.exe` |
| `-PgSuperUser` | `postgres` | Superuser used only during setup |
| `-PgSuperPassword` | prompt | Superuser password |
| `-DbName` / `-DbUser` | `zhanx_dentalcare` / `zhanx_app` | Application role/database |
| `-DbPassword` | generated | Application role password |
| `-ApiPort` | `4000` | API and firewall port |
| `-BackupDir` | `<install>\data\backups` | Default backup folder |
| `-CreateAdmin` | off | Create an administrator from the script instead of the app |
| `-AdminUsername` / `-AdminFullName` | `admin` / `Clinic Administrator` | Only with `-CreateAdmin` |
| `-AdminPassword` | generated | Only with `-CreateAdmin` |
| `-NoStartupTask` | off | Do not register the boot task |
| `-SkipFirewall` | off | Do not add the firewall rule |

#### Re-running setup

Re-running is safe: the role password is rotated, a new `.env` is written (the previous
one is backed up as `.env.bak-<timestamp>`), migrations are idempotent, and no staff
account is touched. To reset an administrator password:

```powershell
cd C:\ZhanX\Server\server
node src\database\create-admin.js --reset-password
```

The command prompts for the new password twice (or accepts `ADMIN_PASSWORD`), validates
the policy, unlocks the account and revokes all refresh sessions. Add `--username=<name>`
and `--full-name="..."` to create the administrator when the database is empty
(for example when `setup-server.ps1` was run with `-CreateAdmin`).

### 2.3 Verify the server

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/health | ConvertTo-Json -Depth 4
```

Expected:

```json
{ "data": { "status": "ok", "database": true, "version": "1.0.0", "...": "..." } }
```

From another PC on the LAN, replace `127.0.0.1` with the server's LAN IP.

Service commands:

```powershell
Get-ScheduledTask "ZhanX DentalCare API"
Stop-ScheduledTask "ZhanX DentalCare API"
Start-ScheduledTask "ZhanX DentalCare API"
```

---

## 3. Client installation

### 3.1 Install

1. Copy `ZhanX-DentalCare-Setup.exe` to the clinic PC and run it.
2. NSIS installs **per user** into `%LOCALAPPDATA%\Programs\ZhanX DentalCare` by default;
   no administrator rights are required for a normal install.
3. Launch **ZhanX DentalCare** from the desktop or Start Menu shortcut.

### 3.2 Activate the license

On first launch — and whenever the stored license cannot be verified — the application
shows the activation screen instead of the clinic data:

1. The **Device ID** is derived from this Windows computer. Send it to ZhanX Studio.
2. Enter the clinic name, dentist name, address and contact number.
3. Click **Import License** and select the signed JSON license file you received
   (or paste it under **Or paste a license key** and click **Check pasted license**).
4. Click **Activate ZhanX DentalCare**. The license is verified locally, bound to this
   Device ID and stored under the clinic data folder.

No internet connection is needed. The signed license is kept so it can be re-verified
on every start. See [LICENSING.md](LICENSING.md) for key management, reinstalls,
hardware changes and reactivation.

### 3.3 Create the administrator and sign in

1. Right after activation the app asks you to create the **clinic administrator**
   (full name, username, password). This is the only time the setup screen is available;
   it closes permanently once an account exists.
2. Sign in with that account.
3. Open **Clinic settings** and fill in the clinic name, address, phone, GSTIN,
   consultation fee, currency (INR), invoice prefix and logo/signature. The same page
   manages the treatment catalog used by invoices and treatment plans.
4. Open **Users & roles** and create accounts for each dentist, receptionist and assistant.
   Give each person their own account — permissions and the audit trail depend on it.
5. Review **Inventory** opening stock and suppliers.

The production database starts with **no patients, appointments or invoices**.
Everything after this point is created by the clinic.

### 3.4 Connecting a front-desk PC

Install the client on each front-desk PC. On the sign-in screen click **Server settings**:

1. Enter the server address, e.g. `http://192.168.1.10:4000`.
2. Click **Test connection** — you should see the latency and a green confirmation.
3. Click **Save & reconnect**.

The address is stored per Windows user in:

```text
%APPDATA%\ZhanX DentalCare\server-config.json
```

You can also pre-configure it before first launch:

```powershell
.\scripts\setup-client.ps1 -ServerUrl http://192.168.1.10:4000 -Launch
```

To install silently and configure at the same time:

```powershell
.\scripts\setup-client.ps1 `
  -ServerUrl http://192.168.1.10:4000 `
  -InstallerPath ".\ZhanX-DentalCare-Setup.exe"
```

A LAN client does not hold its own license: it operates against the licensed clinic
server, and stops working if that server is not activated. Licensing is per clinic
server installation, not per front-desk PC — see [LICENSING.md](LICENSING.md).

---

## 4. Updating the application

1. Take a manual backup (**Administration → Backup & restore → Create backup now**).
2. On the server, stop the API task.
3. Replace the `server\` folder with the new package's `server\` folder
   (keep your `.env` and `data\` folder).
4. Run migrations:

   ```powershell
   cd C:\ZhanX\Server\server
   node src\database\migrate.js
   ```

5. Start the API task and confirm `/api/health`.
6. Install the new client build on each PC. Existing local settings and the server
   address are preserved.

Never delete or re-create the database during an update.

---

## 5. Uninstalling

**Client:** uninstalling removes the application files. It does **not** delete the clinic
database, backups or patient documents, because none of them live on the client PC.
Per-user settings (server address) may remain in `%APPDATA%`.

**Server:** there is no uninstaller that drops the database. To decommission the server,
stop the scheduled task and remove the PostgreSQL database manually — only after a
verified final backup. The installer/build configuration explicitly sets
`deleteAppDataOnUninstall: false` so an uninstall cannot wipe clinic data.

---

## 6. File locations

| Item | Path |
|---|---|
| Server install | `C:\ZhanX\Server` (example) |
| Server config | `<install>\.env` |
| API log | `<install>\logs\server.log` |
| Uploaded documents | `<install>\data\documents` |
| Branding images | `<install>\data\branding` |
| Backups | `<install>\data\backups` (or configured folder) |
| Stored license | `<install>\data\license\zhanx.license.json` |
| Device secret (DPAPI) | `<install>\data\device\installation.secret` |
| Client executable | `%LOCALAPPDATA%\Programs\ZhanX DentalCare\ZhanX DentalCare.exe` |
| Client server address | `%APPDATA%\ZhanX DentalCare\server-config.json` |
| Client refresh token | `%APPDATA%\ZhanX DentalCare\session.bin` (DPAPI-encrypted) |

Continue with `NETWORK_SETUP.md` for the LAN configuration and `BACKUP_RESTORE.md`
before going live.
