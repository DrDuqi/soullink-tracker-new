# Windows Code Signing — Vorbereitung

Ziel: „Unbekannter Herausgeber" entfernen und SmartScreen-Warnungen minimieren.
Der Build ist bereits **signaturbereit** — sobald ein Zertifikat per Umgebungsvariablen
vorliegt, signiert `electron-builder` Installer **und** App automatisch. Ohne Zertifikat
läuft der Build unverändert (unsigniert) weiter.

## 1. Zertifikat wählen
| Option | SmartScreen | Kosten | Hinweis |
|---|---|---|---|
| **EV Code Signing** (Hardware/HSM) | sofort reputierlich, keine Warnung | ~300–500 €/Jahr | beste Wahl, aber Token/Cloud-HSM nötig |
| **OV Code Signing** | Warnung verschwindet erst nach Reputation (einige Downloads) | ~100–200 €/Jahr | „Unbekannter Herausgeber" weg, SmartScreen anfangs noch möglich |
| **Azure Trusted Signing** | gut, von Microsoft | ~ wenige €/Monat | günstigste seriöse Variante, rein cloud-basiert |

Empfehlung für ein kostenloses Fan-Tool: **Azure Trusted Signing** oder ein **OV**-Zertifikat.

## 2. Lokal signieren (Test)
`electron-builder` liest diese Standard-Variablen automatisch:

```powershell
$env:CSC_LINK = "C:\pfad\zum\cert.pfx"      # oder Base64-String der .pfx
$env:CSC_KEY_PASSWORD = "<pfx-passwort>"
npm run dist
```

## 3. CI (GitHub Actions)
1. `.pfx` als Base64 ablegen → GitHub-Secrets:
   - `WIN_CSC_LINK` = Base64 der .pfx
   - `WIN_CSC_KEY_PASSWORD` = Passwort
2. Im Release-Workflow vor `electron-builder` setzen:
   ```yaml
   env:
     CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
     CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
   ```
   Mehr ist nicht nötig — die `win`-Konfiguration (sha256 + RFC3161-Timestamp) steht schon.

## 4. Nach Erhalt des Zertifikats EINMALIG ergänzen
In `package.json` → `build.win` den **exakten** Zertifikat-Subjektnamen eintragen, damit
die Auto-Update-Signaturprüfung (`electron-updater`) passt:

```json
"publisherName": "<CN aus dem Zertifikat, z. B. 'SoulLink Tracker'>"
```

> ⚠️ Erst hinzufügen, **wenn** signiert wird. Bei unsigniertem Build würde `publisherName`
> die Update-Signaturprüfung fehlschlagen lassen und Auto-Update für aktuelle Nutzer brechen.

## 5. Azure Trusted Signing (Alternative zu .pfx)
Statt `CSC_LINK` die `build.win.azureSignOptions` nutzen (electron-builder ≥ 25) und
`AZURE_*`-Credentials als Secrets setzen. Details: electron.build/code-signing-win.
