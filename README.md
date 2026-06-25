# CATAN: Cities & Knights — Full Digital Multiplayer Edition

A faithful, full-featured digital implementation of the **Cities & Knights** expansion for Settlers of Catan, running in the web browser with a server-authoritative engine and WebSocket syncing.

---

## 🛠️ Tech Stack
* **Frontend**: React 18, TypeScript, Tailwind CSS, HTML5 Canvas (custom hexagon mesh coordinate rendering), Zustand (state management), Lucide Icons, Canvas-Confetti (animations).
* **Backend**: Node.js, Express, Socket.io (WebSocket lobby & state sync server).
* **Testing**: Vitest for game state mutation assertions.

---

## 📂 Project Structure
```
├── shared/
│   └── types.ts             # Unified types, action requests & event payloads
├── server/
│   ├── gameEngine.ts        # Authoritative server-side Cities & Knights rules engine
│   ├── gameEngine.test.ts   # Core rules unit tests (Vitest)
│   └── index.ts             # Express & Socket.io server
├── client/
│   ├── components/
│   │   ├── Board.tsx        # HTML5 Canvas pointy-topped hex grid renderer
│   │   ├── PlayerHUD.tsx    # Bottom HUD panel for cards & turn action console
│   │   ├── DicePanel.tsx    # Production & event dice console (Alchemist choice)
│   │   ├── CityImprovementBoard.tsx  # Politics/Science/Trade track board
│   │   └── BarbarianTrack.tsx        # Barbarian ship tracking HUD
│   ├── store/
│   │   └── gameStore.ts     # Zustand store for board selections & sync state
│   ├── hooks/
│   │   └── useSocket.ts     # Client WebSocket Socket.io-client event triggers
│   ├── vite.config.ts       # Vite bundler & alias configs
│   ├── tailwind.config.js   # Tailwind custom theme styles
│   ├── postcss.config.js    # PostCSS pipeline settings
│   ├── index.html           # Document template with fonts
│   ├── index.css            # Stylesheets, animations & custom scrollbars
│   ├── main.tsx             # React mounting entry point
│   └── App.tsx              # Match lobbies, connection handlers & game screens
├── package.json             # Root monorepo workspace dependencies & run scripts
└── tsconfig.json            # Strict TypeScript configuration
```

---

## 🕹️ Features Implemented

1. **Board Generation & Layout**:
   * Generates a 37-hex grid containing 19 land tiles and 18 sea tiles forming the outer frame.
   * Deterministic standard setup (spiral layout) on first match; random map shuffle on subsequent games.
   * 9 perimeter harbors placed symmetrically.

2. **Strict Turn Phases**:
   * **Pre-roll**: Activate knights (1 grain), move active knights along roads, use knight actions (displace enemy knight, break road, chase robber), or play progress cards.
   * **Roll**: Rolls white, red, and event dice simultaneously.
     * Castle results check red die against city improvements to distribute progress cards.
     * Barbarian results advance ship towards 0.
   * **Post-roll / Building**: Build roads, settlements, upgrade to cities, build city walls, recruit/upgrade knights, buy city improvements, trade with bank/players, and end turn.

3. **Barbarian Attack Resolution**:
   * Measures total city strength vs active knight levels.
   * Success: Awards unique **Defender of Catan** card (+1 VP) to highest contributor, or Politics cards in case of ties.
   * Failure: Downgrades city to settlement for the player(s) with the fewest active knight levels who own cities. Destroys city wall if present. Suspend game phase until city choice is made.

4. **Full Knights & City Walls Mechanics**:
   * Enforces knight recruiting (Sheep + Grain + Ore), upgrading (Level 1 ➔ 2 ➔ 3), and Fortress requirement for Mighty Knights.
   * Active/Inactive state toggles, deactivating knights after attack or actions.
   * City walls increase hand limits by 2.

5. **Lobby and Reconnection Support**:
   * Join room lobby codes and player color choice slots.
   * Automatic reconnect: if a player's network drop occurs, they can rejoin using the same name and restore their latest authoritative state.

---

## 🚀 Getting Started

### 📋 Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### ⚙️ Installation
Clone or navigate to the project directory and install the packages:
```bash
npm install
```

### 🧪 Running Tests
Verify game mechanics compliance with our Vitest test suite:
```bash
npm run test
```

### 🖥️ Running the Application (Local Dev)
To run both the server and client concurrently:
```bash
npm run dev
```
* **Client App**: Runs on `http://localhost:3000`
* **WebSocket Server**: Runs on `http://localhost:4000`

### 👥 Local Multiplayer Testing
1. Run `npm run dev`.
2. Open `http://localhost:3000` in browser window.
3. Input a room code (e.g. `catan-live`), your name (`Alice`), select a color, and join the lobby.
4. Open a **new browser tab** or **Incognito tab** to `http://localhost:3000`.
5. Join the **same** room code (`catan-live`) as `Bob` and `Charlie`.
6. Once 3 or 4 players have joined the lobby, the "Start Game" button will unlock. Click it to initialize the board and start the match!
