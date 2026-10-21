# Projekt-Richtlinien für Antigravity / Gemini

## Automatisches Pushen auf GitHub (artboxdev)

Für alle Änderungen und Konversationen in diesem Projekt gilt die verbindliche Vorgabe, dass abgeschlossene Code-Änderungen direkt auf das GitHub-Repository des Accounts **artboxdev** gepusht werden.

### Git-Konfiguration & Remotes
* **GitHub-Account:** `artboxdev`
* **Remote-Name:** `artcube_lite`
* **Remote-URL:** `https://github.com/artboxdev/artcube_lite.git`
* **Arbeits-Branch:** `dawda-new-experience`
* **Deployment-Branch (Vercel / Production):** `main`

### Standard-Ablauf nach Code-Änderungen:
Sobald Änderungen an der Next.js-App (z. B. `app/experiences/sakura/SakuraCanvas.tsx`), den Komponenten oder der Konfiguration vorgenommen und validiert wurden:

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
4. **Auf artboxdev `main` für Vercel Auto-Deployment spiegeln:**
   ```bash
   git push artcube_lite dawda-new-experience:main
   ```

### Live-URL:
* **Next.js Portal / Vercel:** [https://artboxdev.github.io/artcube_lite/](https://artboxdev.github.io/artcube_lite/)
