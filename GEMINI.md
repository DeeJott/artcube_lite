# Projekt-Richtlinien für Antigravity / Gemini

## Automatisches Pushen auf GitHub (artboxdev)

Für alle Änderungen und Konversationen in diesem Projekt gilt die verbindliche Vorgabe, dass abgeschlossene Code-Änderungen direkt auf das GitHub-Repository des Accounts **artboxdev** gepusht werden.

### Git-Konfiguration & Remotes
* **GitHub-Account:** `artboxdev`
* **Remote-Name:** `artcube_lite`
* **Remote-URL:** `https://github.com/artboxdev/artcube_lite.git`
* **Arbeits-Branch:** `dawda-new-experience`
* **Deployment-Branch (GitHub Pages / Vercel):** `main`

### Standard-Ablauf nach Code-Änderungen:
Sobald Änderungen an Kunstwerken (z. B. `art-cube-demo/public/sakura-v3.html`), der Next.js-App oder der Konfiguration vorgenommen und validiert wurden:

1. **Dateien stagen:**
   ```bash
   git add <geänderte-dateien>
   ```
2. **Commit erstellen:**
   ```bash
   git commit -m "feat/fix: <prägnante Beschreibung der Änderung>"
   ```
3. **Auf artboxdev Arbeits-Branch pushen:**
   ```bash
   git push artcube_lite dawda-new-experience
   ```
4. **Auf artboxdev `main` für Vercel / GitHub Actions spiegeln:**
   ```bash
   git push artcube_lite dawda-new-experience:main
   ```

### Live-URLs für Tests auf Smartphones:
* **Direktes Kunstwerk:** [https://artboxdev.github.io/artcube_lite/sakura-v3.html](https://artboxdev.github.io/artcube_lite/sakura-v3.html)
* **Next.js Portal:** [https://artboxdev.github.io/artcube_lite/](https://artboxdev.github.io/artcube_lite/)

## Schutz manueller Benutzeränderungen (Höchste Priorität)

1. **Manuelle Änderungen immer respektieren:**
   - Wenn der Benutzer manuell Dateien oder Code im Editor ändert, dürfen diese Änderungen unter keinen Umständen überschrieben, rückgängig gemacht oder ignoriert werden.
   - Der Benutzer hat immer das letzte Wort über Code, Texte und Übersetzungen.

2. **Vor jeder Bearbeitung Dateiinhalt frisch einlesen:**
   - Niemals auf älteren Versionen aus dem Chatverlauf oder Zwischenspeicher aufbauen.
   - Vor jeder Änderung muss die Zieldatei mit den Datei-Tools (`view_file`) geprüft werden, um den exakten, aktuellen Zustand auf der Festplatte zu kennen.

3. **Präzise, minimale Diffs statt Komplett-Überschreibung:**
   - Verwende immer punktuelle Ersetzungen (`replace_file_content` oder `multi_replace_file_content`), um ausschließlich die angeforderten Zeilen anzupassen.
   - Dateien dürfen niemals blind komplett neu geschrieben werden.

4. **Keine destruktiven Git-Operationen:**
   - Führe niemals destruktive Befehle wie `git checkout --`, `git restore`, `git reset --hard` oder `git clean` aus, ohne vorherige explizite Erlaubnis des Nutzers.

