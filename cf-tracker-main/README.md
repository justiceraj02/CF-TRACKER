# ⚡ CF Tracker — Follow & Solve

A premium Codeforces problem-tracking dashboard that lets you follow another user's solved problems and track your progress against theirs.

![CF Tracker](https://img.shields.io/badge/Codeforces-Tracker-blue?style=for-the-badge)
![Static](https://img.shields.io/badge/Type-Static_Web_App-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

## ✨ Features

- **Multi-Profile Tracking** — Follow multiple Codeforces users, switch between tabs
- **Problem Table** — Sortable, filterable table with search across names, contests, and tags
- **Progress Dashboard** — Stats cards showing solved/attempted/remaining with progress bar
- **Bookmark & Checkmark** — Star problems for later, checkmark to archive completed ones
- **Submission Details** — Expand any row to see both users' submission history
- **Daily Target Planner** — Smart goal-setting with growth-based problem distribution
- **Problem Suggestions** — Daily rotating suggestions based on your CF rating
- **Fully Client-Side** — No backend needed, all data persisted in localStorage
- **Responsive Design** — Works on desktop, tablet, and mobile

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- A local HTTP server (ES modules require it)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/cf-tracker.git
   cd cf-tracker
   ```

2. **Start a local server** (pick one):
   ```bash
   # Option 1: npx (no install needed)
   npx serve .

   # Option 2: Python
   python -m http.server 8080

   # Option 3: VS Code Live Server extension
   # Right-click index.html → "Open with Live Server"
   ```

3. **Open in browser** — Navigate to `http://localhost:3000` (or whichever port)

4. **First-time setup** — Enter your CF handle and the target handle you want to track

## 📁 Project Structure

```
cf-tracker/
├── index.html          ← Clean HTML markup
├── README.md           ← This file
├── LICENSE             ← MIT License
├── .gitignore          ← Git ignore rules
├── .editorconfig       ← Editor configuration
├── css/
│   └── styles.css      ← All styles (~700 lines)
└── js/
    ├── app.js          ← Entry point, rendering, UI & events
    ├── config.js       ← Constants & storage key generators
    ├── utils.js        ← Pure utility functions
    ├── storage.js      ← localStorage CRUD operations
    ├── api.js          ← Codeforces API communication
    └── data.js         ← Data processing, filtering, sorting
```

## 🛠 Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Custom properties, Grid, Flexbox, animations, glassmorphism
- **Vanilla JavaScript** — ES Modules, Fetch API, localStorage
- **Google Fonts** — Inter & JetBrains Mono
- **Codeforces API** — Real-time submission data

## 🎨 Design

- Dark mode with subtle gradient background
- Color-coded CF rating badges (gray → green → cyan → blue → violet → orange → red)
- Micro-animations on hover, row entry, and panel transitions
- Responsive breakpoints at 900px and 600px

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
