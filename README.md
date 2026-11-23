# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/FaizaaX/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/FaizaaX/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar — a dashboard that ranks the protocols that still record no token by what their launch would be worth, each with the steps to farm it.

It reads a sealed snapshot of every protocol DefiLlama tracks (758 protocols, frozen 2026-11-14), keeps the 40 on the house watchlist, adds 138 early finds below the $50M floor, and scores all 178 with one model: `implied = TVL × 0.30 × growth × maturity × span`, where growth follows the protocol's own 7-day TVL change, maturity follows how long it has run with no token recorded, and span follows how many chains it runs on. No protocol name is ever special-cased. The dashboard is a static page — board, detail view per protocol, live-token view, filters and a model sandbox that reprices the whole board live — with no network at all.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` (Node 22) writes `out/board.json` (178 rows, every one with an implied value and a six-step farm plan), `out/data.js` for the dashboard, copies `dashboard/` and `screenshots/` into `out/`, and writes `out/dossier.json` with `buildDossier` from `vendor/makefun-board.ts`. Open `out/dashboard/index.html` in a browser; the three screenshots under `screenshots/` show the board, a protocol's detail view and a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
