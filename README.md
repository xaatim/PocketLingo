
<div align="center">

# PocketLingo

**Offline, two-way voice translator for any Android phone — running natively in Termux.**

![Platform](https://img.shields.io/badge/platform-Android%20%2F%20Termux-green)
![Offline](https://img.shields.io/badge/network-fully%20offline-blue)
![License](https://img.shields.io/badge/license-Apache--2.0-lightgrey)
![Status](https://img.shields.io/badge/status-active-brightgreen)

PocketLingo turns an old Android phone into a dedicated, pocket-sized, fully offline translation device. Everything runs directly on the phone inside Termux — no PC, no cloud, no accounts. Two people face each other, each picks a language, each taps their side of the screen to speak — and the other person hears it in their language. The browser is locked into [Fully Kiosk Browser](https://www.fullykiosk.com/) so the phone behaves like a single-purpose appliance.

Built for the phone you already have in a drawer.

</div>

## Why a phone (not a Raspberry Pi)

A Raspberry Pi-based translator needs a screen, microphone, speaker, battery, case, and a lot of wiring to become portable. An old Android phone already has all of those — plus a touchscreen — and fits in your hand. This project repurposes the phone you're not using anymore into a purpose-built translation device, with Termux providing the runtime and Fully Kiosk Browser providing the locked-down front end.

## Features

- **Fully offline** — speech recognition, translation, and speech synthesis all run on-device after initial setup
- **Runs entirely in Termux** — no separate computer, no dev server on a laptop, no SSH required after setup
- **Kiosk-locked** — Fully Kiosk Browser launches straight into PocketLingo and keeps it there
- **Two-lane UI** — one person on each side of the screen, no passing the phone back and forth
- **Tap to record** — tap the RECORD button to start, tap again to stop. Designed for touch, not keyboards
- **Native language dropdowns** — one per lane, like Google Translate
- **Fully responsive** — works on phone, tablet, desktop, and kiosk displays
- **Keyboard shortcuts** on desktop (`Z` / `X` toggle each lane as a bonus)
- **Remembers your language choice** across reloads

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Speech-to-text | [Moonshine](https://github.com/usefulsensors/moonshine) |
| Translation | [Gemma 4](https://ai.google.dev/gemma) via LiteRT-LM (on-device) |
| Text-to-speech | moonshine-voice |
| Backend | Python (`http.server`) |
| Runtime | Termux on Android, fully offline |
| Kiosk shell | Fully Kiosk Browser |

## Setup (on the phone, in Termux)

Prerequisites:

- **Termux** installed from [F-Droid](https://f-droid.org/packages/com.termux/) (not the Play Store build — it's outdated)
- **Fully Kiosk Browser** installed from the Play Store
- Node.js and Python 3.10+ available inside Termux
- ~4–6 GB of free storage for the model

```bash
# Update Termux packages
pkg update && pkg upgrade

# Install runtime dependencies
pkg install nodejs-lts python git

# Clone
git clone https://github.com/xaatim/pocketlingo.git
cd pocketlingo

# Frontend dependencies
cd frontend && npm install && cd ..

# Backend setup
chmod +x setup.sh download_model.sh start.sh
./setup.sh
./download_model.sh

# Run everything
./start.sh
```

Once `start.sh` is running, the web UI will be available at:

- **Dev mode:** `http://localhost:5173`
- **Production mode:** `http://localhost:3000`

Because everything is on `localhost`, the browser treats it as a secure context and the microphone works with no flags, no certificates, and no reverse proxy.

## Using PocketLingo

1. Open Fully Kiosk Browser pointed at `http://localhost:5173` (or `:3000` in production)
2. Person 1 picks their language from the left dropdown
3. Person 2 picks their language from the right dropdown
4. Person 1 taps **RECORD** on their side, speaks, then taps **STOP**
5. The phone transcribes the speech, translates it, and speaks the result in the other language
6. Person 2 taps **RECORD** on their side to reply

While one person is recording, the other lane is temporarily locked. This prevents audio from both sides being mixed.

## Kiosk Setup with Fully Kiosk Browser

Fully Kiosk Browser is what turns the phone into a dedicated device. Recommended settings:

- **Start URL:** `http://localhost:5173` (or `http://localhost:3000` in production)
- **Start on boot:** enabled — the phone goes straight into PocketLingo after a reboot
- **Kiosk mode:** enabled — hides the status bar and navigation, and disables the back button
- **Keep screen on:** enabled — the screen never sleeps while the app is running
- **Autoplay media:** enabled — required so the translated speech plays automatically
- **Microphone permission:** grant once in Fully Kiosk's settings, then it persists
- **Disable volume/brightness gestures:** recommended, so a stray swipe doesn't break the session
- **Web auto-reload:** optional, useful if Termux restarts and you want the page to reconnect

To make the whole thing feel like a native app, add PocketLingo to the home screen from Fully Kiosk and set it as the launcher (Fully Kiosk supports being the default home app). From then on, pressing the home button returns to the translator instead of the Android launcher.

## Testing on Your Phone

Because PocketLingo runs on `localhost` inside Termux, the browser's secure-context requirement for microphone access is satisfied automatically — no Chrome flags, no self-signed certificates, and no reverse proxy are needed. Just point Fully Kiosk Browser at `http://localhost:5173`.

If you ever need to reach it from another device on your network (e.g. for debugging from a laptop), see the three workarounds below:

1. **Chrome Android flag** — open `chrome://flags/#unsafely-treat-insecure-origin-as-secure` on the phone, add the phone's local IP address (e.g. `http://<phone-ip>:5173`), relaunch Chrome
2. **HTTPS with a self-signed certificate** — configure Vite to serve HTTPS; accept the certificate once
3. **Reverse proxy** — put Caddy or nginx in front with a real domain and HTTPS

## Project Structure

```
pocketlingo/
├── frontend/           React + Vite web UI
│   ├── src/
│   │   ├── components/   LanguageLane, ResponseDrawer, SettingsOverlay, Visualizer
│   │   ├── hooks/        useAudioRecorder
│   │   └── utils/        api, audio-blip, audioHelpers
│   ├── index.html
│   └── style.css
├── backend/            Python API server (Moonshine STT, TTS, LLM proxy)
│   ├── server.py
│   └── requirements.txt
├── setup.sh            Creates Python venv, installs backend deps
├── download_model.sh   Fetches the LiteRT Gemma model
└── start.sh            Launches everything (litert-lm + API + UI)
```

## Roadmap

- [x] Touch-first UI with native language dropdowns
- [x] Tap-to-toggle recording (touch + mouse)
- [x] Fully responsive layout
- [x] Language persistence across reloads
- [x] Termux-native runtime (no separate PC required)
- [x] Kiosk mode via Fully Kiosk Browser
- [ ] Termux:Boot integration for one-tap startup after reboot
- [ ] Wake-word activation for hands-free use
- [ ] Language pack expansion
- [ ] Battery / thermal optimization for long offline sessions

## Credits

PocketLingo is built on top of **[google-gemma/gemma-translator](https://github.com/google-gemma/gemma-translator)**, an Apache-2.0 project from Google Creative Lab. The original project provided the on-device inference pipeline, Moonshine speech integration, and the core two-lane architecture that makes this possible.

This fork rewrites the frontend for touch-first operation on Android phones and retargets the runtime for Termux + Fully Kiosk Browser:

- Replaced the keyboard-driven "revolver" language selector with native `<select>` dropdowns
- Replaced hold-to-talk with tap-to-toggle recording
- Made the layout fully responsive (removed the fixed 480×320 kiosk sizing)
- Kept both lanes side-by-side in all orientations
- Added mobile meta tags (PWA-capable, theme-color, viewport-fit)
- Persisted language choice to `localStorage` per lane
- Removed Raspberry Pi-specific deployment scripts and STL files
- Retargeted setup for Termux on Android with Fully Kiosk Browser as the shell

Original work licensed under Apache-2.0. Modifications © 2026 Hatim Ahmed Hassan.
