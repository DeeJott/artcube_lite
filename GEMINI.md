# Projekt-Richtlinien für Antigravity / Gemini

## Automatisches Pushen auf GitHub (DeeJott)

Für alle Änderungen und Konversationen in diesem Projekt gilt die verbindliche Vorgabe, dass abgeschlossene Code-Änderungen direkt auf das GitHub-Repository des verknüpften Accounts **DeeJott** gepusht werden.

### Git-Konfiguration & Remotes
* **GitHub-Account:** `DeeJott`
* **Remote-Name:** `artcube_lite`
* **Remote-URL:** `https://github.com/DeeJott/artcube_lite.git`
* **Arbeits-Branch:** `dawda-new-experience`
* **Deployment-Branch (GitHub Pages):** `main`

### Standard-Ablauf nach Code-Änderungen:
Sobald Änderungen an Kunstwerken (z. B. `public/sakura-v3.html`), der Next.js-App oder der Konfiguration vorgenommen und validiert wurden:

1. **Dateien stagen:**
   ```bash
   git add <geänderte-dateien>
   ```
2. **Commit erstellen:**
   ```bash
   git commit -m "feat/fix: <prägnante Beschreibung der Änderung>"
   ```
3. **Auf DeeJott Arbeits-Branch pushen:**
   ```bash
   git push artcube_lite dawda-new-experience
   ```
4. **Auf DeeJott `main` für GitHub Actions / GitHub Pages spiegeln:**
   ```bash
   git push artcube_lite dawda-new-experience:main
   ```

### Live-URLs für Tests auf Smartphones:
* **Direktes Kunstwerk:** [https://deejott.github.io/artcube_lite/sakura-v3.html](https://deejott.github.io/artcube_lite/sakura-v3.html)
* **Next.js Portal:** [https://deejott.github.io/artcube_lite/](https://deejott.github.io/artcube_lite/)
