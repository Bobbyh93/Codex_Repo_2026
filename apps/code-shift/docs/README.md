# Code Shift: pilot release

Simulation lab in a box. A Raspberry Pi 5 serves a patient monitor on the room display, a patient chart, a barcode medication administration record, an active orders list, a worklist and provider calls to student phones over a private Wi-Fi network, with every action recorded for debrief. No manual data entry; actions have consequences.

## What is in the pilot
- **Instructor**: Monitor and events (vitals, trends, 27 rhythms drawn from the LLUMC arrhythmia criteria, six scripted scenario events), Worklist (confirm or flag what students did), Patient chart with the facilitator pack and session controls, eMAR (scanning policy, sim-day orders, physical barcode registration), Orders, Provider (reply choices that place real orders and add medications), Evidence timeline with debrief report and JSON export, Session (labels, room display).
- **Students (phones)**: Worklist (everything due, tap Done), Chart (read only: updates, SBAR, summary, labs, orders), MAR (identify the patient, scan the label; alerts for already given, too early, max doses, hold rule; the scans are the documentation), Orders (acknowledge new orders), Provider (SBAR call by choices).
- **Scenario**: N115C CAD / Chest Pain, Carl Shapiro (fictional), University General Hospital.

Monitor traces: `ecg-monitor.md`.

## Install on the Pi
See `pi-deploy.md`: image the Pi, connect it to the GL.iNet Slate, unzip, run `sudo bash deploy/install.sh`, optionally `sudo bash deploy/install-display.sh` for the HDMI monitor, install the certificate on each phone once, then run the verification checklist.

## Built but dormant (future builds)
Verbal patient interaction (speech in, scripted or Claude-driven patient, spoken and captioned on the display, objective findings by voice); free-text notes, vitals entry and assessment forms. Server endpoints remain; nothing is exposed in the pilot interface.
