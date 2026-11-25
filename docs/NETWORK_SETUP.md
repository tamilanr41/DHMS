# ZhanX DentalCare — Network Setup

ZhanX DentalCare is designed for a **single clinic on a local network**. One server PC
holds PostgreSQL and the API; every other PC runs the desktop client and talks to the API
over TCP. No internet connection is required for daily operation.

```text
                 Clinic LAN (switch / Wi-Fi)
   ┌──────────────────┬──────────────────┬──────────────────┐
   │                  │                  │                  │
┌──┴───────────┐  ┌───┴──────────┐  ┌───┴──────────┐  ┌────┴─────────┐
│ Server PC    │  │ Reception PC │  │ Dentist PC   │  │ Chairside PC │
│ PostgreSQL   │  │ Client       │  │ Client       │  │ Client       │
│ API :4000    │  │              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
        ▲
        │  TCP 4000 only (authenticated API)
        └── clients never connect to PostgreSQL (:5432)
```

---

## 1. Server PC network configuration

### 1.1 Give the server a stable address

Use a **static IP** or a **DHCP reservation** on the router. Clients store the address, so
it must not change.

Recommended layout:

| Device | Address | Notes |
|---|---|---|
| Router / gateway | `192.168.1.1` | |
| Server | `192.168.1.10` | static or DHCP reservation |
| Printer | `192.168.1.20` | optional |
| Clients | `192.168.1.100+` | DHCP |

To set a static address (elevated PowerShell — adjust names):

```powershell
Get-NetAdapter
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.1.10 -PrefixLength 24 -DefaultGateway 192.168.1.1
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses 192.168.1.1,8.8.8.8
```

### 1.2 Set the network profile to Private

The firewall rule created by `setup-server.ps1` applies to **Private** and **Domain**
networks only. If Windows classifies the LAN as Public, clients will be blocked.

```powershell
Get-NetConnectionProfile
Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private
```

### 1.3 Firewall

`setup-server.ps1` creates:

```text
Rule: ZhanX DentalCare API
Direction: Inbound
Protocol: TCP
Local port: 4000
Profile: Private, Domain
Action: Allow
```

Check or recreate it:

```powershell
Get-NetFirewallRule -DisplayName "ZhanX DentalCare API"
New-NetFirewallRule -DisplayName "ZhanX DentalCare API" -Direction Inbound -Action Allow `
  -Protocol TCP -LocalPort 4000 -Profile Private,Domain
```

Do **not** open PostgreSQL port `5432` to the LAN. The API is the only entry point.

### 1.4 Confirm the API listens on the LAN

`.env` must contain:

```ini
HOST=0.0.0.0
PORT=4000
```

`0.0.0.0` makes the API reachable from other PCs. `127.0.0.1` would restrict it to the
server itself.

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen
```

---

## 2. Client PC configuration

### 2.1 Install

Run the client installer, or:

```powershell
.\scripts\setup-client.ps1 -ServerUrl http://192.168.1.10:4000 -Launch
```

### 2.2 Point the client at the server

On the sign-in screen → **Server settings**:

1. `http://192.168.1.10:4000`
2. **Test connection** → green result with latency.
3. **Save & reconnect**.

The address is stored per Windows user:

```text
%APPDATA%\ZhanX DentalCare\server-config.json
```

If a PC is moved or the server address changes, repeat this step. No reinstall is needed.

---

## 3. Verification from a client PC

```powershell
# 1. Can the client reach the port?
Test-NetConnection 192.168.1.10 -Port 4000

# 2. Does the API answer and can it reach PostgreSQL?
Invoke-RestMethod http://192.168.1.10:4000/api/health | ConvertTo-Json -Depth 4
```

Expected:

```json
{ "data": { "status": "ok", "database": true, "version": "1.0.0" } }
```

`status: ok` + `database: true` means the full path works.
`status: degraded` means the API is up but PostgreSQL is unreachable — fix the database on
the server, not the network.

Then sign in from the client and open **Dashboard** and **Patients**.

---

## 4. How clients find the API

| Environment | Base URL |
|---|---|
| Installed desktop client | `server-config.json` → `http://<server>:4000` |
| Development browser | `VITE_API_URL` or `http://127.0.0.1:4000` |
| Server itself | `http://127.0.0.1:4000` |

The API base is always `<server>:4000/api`. The client appends `/api` internally.

CORS is only relevant for browser development. `CORS_ORIGINS` in `.env` lists the Vite
origins; the Electron client does not send an `Origin` header.

---

## 5. Security on the LAN

- Only port **4000** is exposed, and every route except `/api/health` requires a valid
  access token plus a server-side permission check.
- PostgreSQL credentials exist only in the server `.env`; the renderer never receives them.
- Use one account per staff member. Shared logins destroy the audit trail and make
  lockout behaviour meaningless.
- Do not port-forward `4000` to the internet. If remote access is ever needed, use a VPN
  (WireGuard/OpenVPN/Tailscale) — never a public port.
- Put clinical PCs on the clinic network, not on a guest Wi-Fi SSID. Guest/client isolation
  will block client-to-server traffic.
- Keep the server PC physically secured and enable BitLocker on its system and backup
  drives.
- Sessions: access tokens last 15 minutes; refresh tokens are rotating and revocable.
  A password change or administrator reset revokes all refresh sessions.

---

## 6. Common network problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Client shows "Server unreachable" | Server off, wrong IP, or firewall | `Test-NetConnection <ip> -Port 4000`; start the API task; check the firewall rule |
| `Test-NetConnection` fails from one PC only | Different VLAN / guest network / Wi-Fi client isolation | Put the PC on the clinic LAN or disable client isolation |
| Health works locally but not from clients | API bound to `127.0.0.1` or firewall profile is Public | Set `HOST=0.0.0.0`; set the network profile to Private |
| Health returns `degraded` | PostgreSQL service stopped or bad credentials | Start the PostgreSQL service; check `logs\server.log` |
| Client connects but sign-in fails with 401 | Wrong username/password, or account locked | Wait for the lockout window or reset the password as administrator |
| 403 on a page | The role lacks the permission | Review **Users & roles**; permissions are enforced by the server |
| Works after reboot but fails later | Server IP changed | Use a DHCP reservation/static IP and update clients |
| Slow reports over Wi-Fi | Weak Wi-Fi / large date range | Use wired Ethernet; narrow the report range |
| Two PCs show different times | Clock drift | Enable automatic time sync on server and clients |

More fixes are in `TROUBLESHOOTING.md`.
