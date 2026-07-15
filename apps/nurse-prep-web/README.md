# Nurse Prep EB Workbench

Static operations cockpit for the Harrity/Nurse Prep pipeline state in this repository.

Run it from the repository root so the app can read `state/`, `manifests/`, `qa/`, and `daily_worksets/`:

```powershell
python -m http.server 5179
```

Then open:

```text
http://localhost:5179/apps/nurse-prep-web/
```

The app is dependency-free and uses committed JSON artifacts as its data source.
