# ShortParse-Web 🛡️🔮✨

ShortParse-Web is the premium, high-fidelity Single Page Application (SPA) frontend for `ShortParse`—the automated Warcraft Logs review and raid coaching platform. 

Crafted strictly with a **glassmorphic, state-of-the-art visual aesthetic**, it provides raid leaders and players with stunning interactive scorecards, chronological avoidable death timelines, defensive cooldown auditing visualizer streams, and an AI-driven System Control Console.

---

## 🎨 Design Philosophy & Visual Excellence

ShortParse-Web is built around modern UI/UX design tokens:
* **Glassmorphism**: Frosted-glass components utilizing backdrop-filters, precise translucent borders (`rgba(255,255,255,0.08)`), and Harmonious HSL tailormade dark color palettes.
* **Modern Typography**: Pure clean text powered by Google Fonts (**Outfit** for premium headings, **Inter** for clinical micro-text statistics).
* **Responsive Layouts**: Dense, responsive CSS grids and micro-animations on interactive chips, sliders, and timeline cards.
* **Zero Placeholders**: Curated, harmonious visual indicators showing class colors, custom badges, and high-resolution spell icons pulled dynamically from Battle.net.

---

## 💻 Primary Interface Views

### 1. The Raid Scorecard Dashboard
A beautiful high-level diagnostic table summarizing the complete raid performance. Clicking on any player dynamically reveals their full individual metrics including survivability percentages, performance metrics vs elite global percentiles, and personalized notes.

### 2. The Conversational "Raid Coach" (Gemini AI integration)
An interactive right-side drawer that allows users to converse directly with their logs! Driven by a background Gemini pipeline, administrators can query combat metrics dynamically (e.g. *"why did we wipe on Midnight Falls?"* or *"audit my defensive CD overlaps"*), receiving highly structured, cold robotic summaries of roster failures and corrective assignments.

### 3. Chronological Avoidable Death Timelines
An interactive color-coded micro-tracker representing the final 8 seconds preceding a player's death. Displays:
* 🟥 Red Bars: Avoidable damage hits taken (including exact damage size).
* 🟩 Green Bars: Incoming healing received.
* 🟪 Purple Bars: Active defensive buffs, shields, or cooldowns running.

### 4. Interactive Cooldown Timeline Visualizer
Shows a granular timeline mapping of every player's defensive casting efficiency, cross-referenced with boss raid-wide avoidable mechanics. Highlights wasteful cooldown overlaps and dangerous dry spells taking heavy damage.

### 5. Spec-Flex Roster Calibrator
An advanced dashboard analyzing player specialization diversity across several fights to identify players playing multiple specs, tracking consistent attendance, and calculating flex survival grades.

---

## ⚡ The System Control Console (Administrators Only)

Accessible discreetly by navigating to `/admin`, the portal verifies Warcraft Logs OAuth sessions against `ADMIN_USERNAMES` to display a glassmorphic command center:

```
[ Update Website ] ────> Dispatches pull, checks VM environment locally
[ Update API ] ────────> Fetches branch, pulls backend server, reloads modules
[ Restart Service ] ───> Dispatches systemctl daemon reload to Uvicorn
[ Update Encounters ] ─> Inputs WCL Zone ID, scrapes telemetry, AI auto-writes boss.py
[ Update Cooldowns ] ──> Triggers SpellAudit telemetry scanner, drafts spec configs
```

### Key Administrative Controls:
1. **Dynamic Statistics Grid**: Visualizes logged users, Patreon premium members adoption rates, Redis caching latency state, and SQLite database footprint.
2. **AI Autopilot Encounters Form**: Enter a WCL Zone ID (e.g. `46`), and click **Update Encounters**. The system queries WCL, enriches spells via Battle.net, asks Gemini to auto-draft a mapped boss module complying with Typed dictionary schemas, and writes it directly to the backend encounters registry.
3. **Live Job Process Queue**: Real-time progress monitoring of active report analysis queues (`queued`, `running`, `completed`, `failed`).

---

## ⚙️ Front-End Architecture

ShortParse-Web is built strictly with raw vanilla performance to ensure instant load times and lightweight network footprint:
* **No Bloat**: Pure CSS styling (`css/style.css`) and pure modern Javascript (`js/app.js`) managing active DOM mutations, Canvas rendering, and API communication.
* **Asset Mounting**: When running the FastAPI server, static directories (`css/`, `js/`, `images/`) are mounted directly at root, making deployment a single-command process.

---

## 🚀 Serving with Nginx (Production Layout)

In production, Nginx serves the static HTML/CSS files directly from `ShortParse-Web` and reverse-proxies the active API routes to Uvicorn:

```nginx
server {
    listen 443 ssl http2;
    server_name shortparse.com;

    root /var/www/ShortParse-Web;
    index index.html;

    # Serve static assets directly from Nginx
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API and OAuth requests to Uvicorn
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📝 License
ShortParse-Web is open-source software licensed under the MIT License.
