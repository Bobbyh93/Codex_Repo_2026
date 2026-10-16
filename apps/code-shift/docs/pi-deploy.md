# Code Shift on a Raspberry Pi 5 — deploy and verification checklist

Scope: first-checkpoint software (chart, notes, private observations, evidence timeline) running on Pi hardware over the lab's local network. This does not make the pilot clinically approved; see "Pilot gates" at the end.

## 1. Image the Pi
- Raspberry Pi OS 64-bit **Lite** (Bookworm or newer) via Raspberry Pi Imager. Set hostname `codeshift`, a user, SSH on, and the lab Wi-Fi (or leave Wi-Fi off if using Ethernet to the travel router).
- Boot, then `sudo apt update && sudo apt full-upgrade -y && sudo reboot`.

## 1b. Network: GL.iNet Slate travel router (decided topology)
The Pi plugs into the Slate's LAN port by Ethernet; students and the instructor join the Slate's Wi-Fi. The Pi never hosts its own access point. This is a private LAN (192.168.8.x by default), isolated from the campus network, with no internet while the WAN port is unplugged.

Slate settings (admin UI, usually http://192.168.8.1):
- WAN port **unplugged** during sessions. Repeater mode off. Plug WAN in only to re-run the installer.
- Wi-Fi: WPA2/WPA3, long passphrase, SSID e.g. `CodeShift-Sim`, both 2.4 and 5 GHz on. Guest network **off** (guest clients cannot reach LAN devices, so they could not reach the Pi).
- Wireless: **Isolate clients** on. Phones cannot see each other but still reach the Pi on the wired LAN port.
- System: change the admin password; GoodCloud, DDNS, and remote access off.
- LAN > DHCP: static lease for the Pi, e.g. `192.168.8.10`, so the URL is stable: `http://192.168.8.10:4317`. Optionally add a custom DNS/hosts entry such as `codeshift.lan` → 192.168.8.10 for a whiteboard-friendly address.
- Check campus policy on personal access points; register the SSID/MAC with IT if required.

## 2. Copy the project and install
On your laptop, zip the project folder **without** `node_modules`, `data`, `dist` (the install script rebuilds `dist`). Copy and install:
```bash
scp code-shift.zip <user>@codeshift.local:~
```
On the Pi:
```bash
sudo apt install -y unzip rsync && unzip -q code-shift.zip -d ~/code-shift-src && cd ~/code-shift-src && sudo bash deploy/install.sh
```
The script installs Node 24 (needs internet once), builds the app into `/opt/code-shift`, puts data in `/var/lib/code-shift`, and enables the `code-shift` systemd service. It prints the LAN URL and where the instructor key is.

## 2b. HTTPS and the phone certificate (required for camera scanning)
Phone browsers only allow the camera on https. The installer creates a self-signed certificate for 192.168.8.10 / codeshift.lan and the service serves https on 4317. Port 8080 serves plain http that redirects to https and offers the certificate at `/cert`. Each student phone trusts it **once** (about a minute per phone; do this at orientation, not during the sim):

- **iPhone / iPad (Safari):** open http://192.168.8.10:8080/cert, tap Allow, then Settings > General > VPN & Device Management > install the "Code Shift Simulation" profile. Then Settings > General > About > Certificate Trust Settings > turn on full trust for it. Open https://192.168.8.10:4317.
- **Android (Chrome):** open http://192.168.8.10:8080/cert, save the file, then Settings > Security > Encryption & credentials > Install a certificate > CA certificate > choose the file. Open https://192.168.8.10:4317.
- If a phone cannot install the certificate, it can still use the app over https with the browser warning accepted, but the camera will be blocked; typed codes still work and are logged as manual.
- If the Pi's IP or name changes, re-run `sudo bash deploy/make-cert.sh <ip> <name>`, restart the service, and phones must re-install.

## 2c. Room monitor display
The patient monitor is meant for a screen plugged into the Pi's HDMI port. Run `sudo bash deploy/install-display.sh` once; after boot the screen shows the monitor with no login (it uses the public, read-only `/api/display`, which exposes vitals only). Any browser can also open https://192.168.8.10:4317/display, for example a laptop driving a TV.

## 2d. Labels and physical barcodes
Two ways to get scannable items, and they can be mixed:
- **Print from the app.** Sign in as instructor and open https://192.168.8.10:4317/labels (also linked from Session setup). Tape the wristband to the manikin and each label to its sim container. Codes are Code 128; the scanner also reads QR, Code 39, UPC/EAN, Data Matrix and ITF.
- **Use real sim meds or a supply-room wristband that already carry barcodes.** Chart > eMAR > "Physical barcodes" (instructor only): scan the item with your phone (or type the code), pick what it is (wristband or a medication), add a note, Register. Students' scans of that item then resolve to the scenario item. Registrations persist across sessions on this Pi and are recorded in the timeline. Remove one from the same panel.

## 2e. Scanning policy (muscle memory)
Every scan is checked by the Pi the moment it is read; a wrong wristband or package stops the student with a red alert and is recorded, before anything is documented. Order alerts (already given, too early, maximum doses, hold rule from the live monitor) must be acknowledged with a reason, or the medication held.
Each session is created with **Require scanning** on. Students must scan the wristband first, then the label; the camera opens by itself at each step; manual code entry is not offered. The server records which was scanned first and the seconds between scans, and flags out-of-order scans. If a phone cannot use the camera (certificate not installed), the instructor can switch the session to "manual allowed" from eMAR > Scanning policy; every manual entry then requires a reason and is flagged in the eMAR and the timeline. Students never receive barcode values from the server, so a code cannot be copied off the screen.

## 3. Verify on hardware (record results in the test log)
| # | Check | Pass criterion |
|---|-------|----------------|
| 1 | `sudo reboot`, wait 60 s, `systemctl status code-shift` | `active (running)` without any login |
| 2 | Pi wired to Slate LAN, Slate WAN unplugged; phone on `CodeShift-Sim` opens `http://192.168.8.10:4317` | Welcome page loads; no mixed-content or certificate prompts |
| 2b | From a phone, try to open any internet site and try to ping another phone | Both fail (WAN unplugged; client isolation on); the app still loads |
| 3 | Instructor logs in on a laptop, creates the session; three phones join as Student 01–03 | Roster shows three "Joined" |
| 4 | Each phone adds a note; instructor saves a private observation | Notes appear on all devices within a few seconds; observation never appears on a phone; `curl -b` from a student cookie to `/api/state` contains no observation text |
| 5 | **Offline**: with the Slate WAN unplugged (normal operation), repeat step 4 | Identical behavior; no page stalls on external assets |
| 6 | Pull the Pi's power mid-session, power on, reopen | Service restarts; all prior entries present (append-only store on disk) |
| 7 | Load: from a laptop run `node tests/load.mjs http://<pi-ip>:4317 <instructor-key> 10 60` | `errors=0`, p95 under 500 ms |
| 7b | Instructor opens Patient monitor, applies a preset with a 60 s trend | HDMI display and instructor view both trend; VITALS_SET entry appears in the timeline |
| 7c | Student phone (certificate installed) opens Chart > eMAR > Give on Aspirin; camera opens; scan the wristband, then the label; Document given | Entry says "camera scan" and "wristband then label, N s apart"; scanning the wrong label is blocked and recorded |
| 7c2 | Scan the label first, then the wristband (use Rescan) | Entry carries "SEQUENCE: medication scanned before patient"; eMAR row shows "Scanned out of order" |
| 7c4 | At the medication step scan the wrong package | Red "Stop. WRONG MEDICATION" banner with vibration before anything is documented; "Scan alert" entry in the timeline; eMAR row shows "1 scan alert" |
| 7c5 | Instructor sets SBP 86 on the monitor; student gives Nitroglycerin SL | Hold-rule alert shown on the eMAR row and in the dialog; Document given is refused until the alert is acknowledged with a reason, or Hold instead is used |
| 7c6 | Give Aspirin a second time | "Already given" alert; same acknowledgement flow; entry reads "ALERTS OVERRIDDEN (reason)" |
| 7c3 | Instructor registers the barcode on a real sim med (eMAR > Physical barcodes), student scans it | Resolves to the assigned medication; BARCODE_REGISTERED entry in the timeline |
| 7d | Same on a phone without the certificate, session set to Require scanning | Camera is refused and no manual entry is offered. Instructor switches to manual allowed: student types codes with a reason; entry says "MANUAL ENTRY (reason)" and the row shows "1 manual" |
| 7e | Student sends a provider message; instructor replies | Both appear on the Provider page on all devices and in the timeline |
| 8 | Phone layout at 390 px wide | No horizontal scroll; eMAR, Give dialog, and note form usable |
| 9 | `sudo bash deploy/backup.sh` after the session | Backup file created; opens with `sqlite3` |

Step 5 is the Release 1 "no internet" requirement; step 1 and 6 cover WBS 1.1 service auto-start.

## 4. Operating notes
- Pi address on the Slate LAN is fixed by DHCP lease (192.168.8.10). If the Pi shows a different address at startup, fix the lease on the Slate rather than the Pi.
- Instructor key: `sudo cat /var/lib/code-shift/instructor-key.txt`. To set your own, add `Environment=INSTRUCTOR_PASSWORD=...` to the unit (`sudo systemctl edit code-shift`), then restart.
- Logs: `journalctl -u code-shift -f`. Restart: `sudo systemctl restart code-shift`.
- New session: this checkpoint keeps one persistent session. To start fresh, stop the service, move `/var/lib/code-shift/code-shift.sqlite*` into a dated folder (keep it as evidence), start the service.
- Update the app: re-run `sudo bash deploy/install.sh` from a newer source folder; data is untouched.
- The service runs as a locked-down system user; only `/var/lib/code-shift` is writable.
- Traffic is HTTPS with the self-signed certificate (section 2b). Port 8080 is the http helper for certificate download and redirect only.

## 5. Pilot gates still open (not software)
- Orientation step: install the certificate on each student phone and let each student do one practice scan before the first sim.
- Faculty/clinical reviewer sign-off recorded for the N115C Carl Shapiro scenario as loaded in `server/scenario.js`.
- Student-data use and any research intent reviewed as stated in the platform definition.
- Release 1 features not yet built: assessment (head-to-toe) documentation, instructor event injection beyond the monitor, debrief PDF. Built: monitor with vitals documentation, eMAR with barcode verification, provider messaging.
