# ♠ Showdown

**Your table. Your chips. Three AI opponents. No real money involved.**

Showdown is a browser-based poker game I built for myself to play against AI opponents. It features four classic poker variants, adjustable AI difficulty, a custom-designed table, and enough chip drama to make a bad river card feel personal.

**[Play Showdown](https://pokershowdown.netlify.app/)**

## What's on the Table?

- **Four poker variants**
  - Texas Hold'em — two hole cards and five shared community cards.
  - Omaha — four hole cards; use exactly two hole cards and three community cards.
  - Seven-Card Stud — no community cards, with a mix of face-up and face-down cards.
  - Five-Card Draw — discard and redraw to improve your hand.

- **Three AI opponents** — play against Nadia, Omar, and Ken, each making their own decisions.
- **Adjustable difficulty** — choose Easy, Medium, or Hard to change opponent behaviour.
- **Full betting controls** — fold, check, call, bet, raise, and go all-in, with a slider and quick-bet options.
- **Hand rankings and rules** — built-in references for when you need a refresher.
- **Synthesized sound effects** — audio for deals, betting, wins, and losses, generated directly in the browser.
- **Table-side drama** — animated cards, winner highlights, confetti, and loss feedback.
- **Responsive interface** — dark emerald felt, brass-gold accents, and a layout designed for desktop and smaller screens.

## Getting Started

No installation required.

1. Clone or download this repository.
2. Keep `index.html`, `style.css`, and `script.js` in the same directory.
3. Open `index.html` in your browser.
4. Choose your variant and difficulty, then start playing.

No `npm install`, no build command, no backend to configure.

## Project Structure

```text
showdown/
├── index.html   # Game interface and layout
├── style.css    # Styling, cards, controls and animations
├── script.js    # Game engine, AI, hand evaluation and audio
└── README.md
```

## Under the Hood

Built using vanilla JavaScript, HTML5, and CSS3.

- **Game engine:** deck creation, shuffling, dealing, betting rounds, and pot distribution.
- **Hand evaluation:** poker hand ranking, tie-breaking, and best-hand selection.
- **AI opponents:** heuristic-based hand-strength estimates with difficulty-dependent aggression, decision noise, and bluffing.
- **Audio:** the Web Audio API generates sound effects without external audio files.
- **Visual effects:** CSS animations and Canvas-powered confetti add feedback to wins and losses.

The game runs client-side, with no application backend or account system.

## A Few Things to Know

- Each new page load starts a fresh table with **1,000 chips per player**.
- Switching poker variants resets all stacks to 1,000 chips.
- Opponents automatically reload to 1,000 chips when their stack falls below the big blind.
- Game progress is not saved between visits.
- Chips are fictional; this is not a real-money gambling platform.
- Google Fonts is loaded externally, and the sound preference is stored locally in the browser.

## Why I Built It

Mostly because I wanted my own poker table.

It was also a fun way to build a complete interactive browser game involving game-state management, card evaluation, AI decision-making, betting logic, and interface design.

No grand business plan. Just poker, code, and the occasional questionable call.

---

*Made for the love of the game. And the occasional bad beat.* ♣
