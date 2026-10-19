# Project Artemis v2

A browser-based web proxy with a built-in chat, accounts, roles, an admin dashboard and an Owner console, wrapped in a space theme (animated starfield, planets, a cinematic 3D launch intro with sound).

## Features
- **Proxy**: server-side rewriting engine (`/p/<token>/<base64url(url)>`), WebSocket proxying, SSRF guard, per-user rate limit, blocklist.
- **Search**: type anything in the address bar. Native DuckDuckGo/Brave results (with fallback between engines), or a URL to open the page.
- **Browser UI**: tabs, back/forward, bookmarks bar, history suggestions, tab cloaking, panic key.
- **Update log**: an Updates page everyone can read; only the owner edits it.
- **Hub and Arcade**: XP and ranks (Stardust to Legend, each with its own level-up cutscene, and a server-wide announcement when someone reaches Legend), daily missions with a streak, leaderboards, a profile lookup, and five arcade games (Eclipse Run, Asteroid Blaster, Moon Lander, Star Memory, Comet Snake).
- **Coins, packs and cosmetics**: earn coins, open loot crates (profile effects and titles) and theme packs (new app themes), equip effects and titles. Staff see everyone's coins and can give coins, titles, effects, themes and crates to one person, a role or everyone.
- **Event timelines**: the owner builds each live event as a timeline (Gulper arena, loot storm, boss hunt, trivia) with minutes per phase, presets and settings. A shared multiplayer arena runs the rules from `public/js/arena-core.js` (same file in the server and the preview), with power-ups, minimap, kill streaks, themed music and a boss. Repeat players who already own the event's limited rewards get 2,500 bonus coins.
- **Live event arena**: starting a live event drops everyone into a full-screen, themed worm arena (Void Worms) with an opening title, a live leaderboard and a draggable event chat. Latecomers join from the top bar or the chat. Owner and co-owners can also set a countdown banner (what, when, details) that shows on top of every screen.
- **Redeem codes**: owner and co-owners make codes (coins, free crates, an item, use limit, expiry). Players redeem them in Packs or the Hub with a gift-opening animation. One use per player; rewards skip the daily coin cap.
- **Pack previews**: "See what's inside" on every crate shows all items, odds and a replay button for each Chroma item's own cutscene.
- **Update banner and safe data**: after a deploy a green "the update is live, click to restart" banner appears. Data is written atomically, backed up on every start and every 3 hours (newest 12 kept in `data/backups`), and a damaged file restores from the newest backup instead of starting empty.
- **Chroma, themed crates and backgrounds**: a rainbow Chroma rarity above Legendary (the whole server gets a banner when anyone pulls one), Gamer, Hacker, Backdrop and Chroma crates, and 16 animated profile backgrounds that show behind your name on profile cards.
- **Earning**: coins from chatting (1, every 20 s), searching (2, every 8 s), browsing (1, every 15 s), games, missions and streaks, capped at 500 a day (UTC reset). Prizes, wheel spins and achievements are exempt. An hourly prize wheel, and 33 lifetime achievements that pay coins once.
- **Trust and moderation**: trusted members (300 messages, 3 h on the proxy, an account 10+ days old, no ban for 14 days, or granted by the owner) can post GIFs and use #trusted-general. The owner console has a ChatBot & trust tab: the 24-hour OG launch window (new accounts get the OG title), ArtemisBot (bad-language filter with strikes and bans, never applied to commanders, co-owners or the owner) and manual trust grants. A role power, Open the owner console, lets a custom role run events, economy, ChatBot and trust.
- **Live events**: the owner starts the Opening Event or Halloween Night: a cinematic, then a hosted party (trivia, word scrambles, reaction races, this-or-that votes, game rushes, drops) with an auto-host. Everyone who plays gets a limited title and profile effect plus coins and crates when it ends. 14 one-click quick events and a cutscene library live in the owner console.
- **Global announcements**: an animated pop-up inside the app and a banner on the sign-in screen.
- **Sidebar**: one resizable, collapsible sidebar holds all navigation.
- **Chat**: Discord-style layout with a channel list, user panel and a member list grouped by role with colored names; channels, replies, reactions, edit/delete, mentions, typing, embeds, profiles with avatars, status and presence.
- **Roles**: Owner, Co-owner (everything except wipes, backups, sign-out-everyone and ownership transfer), Commander, Crew, plus custom roles (Manager and Moderator come pre-made) with permissions (`view_dashboard, announce, manage_users, manage_channels, delete_messages, manage_blocklist, manage_roles, use_terminal`). You can only act on people ranked below you.
- **Mission control**: live charts, top sites, per-user stats, crew management, bans, announcements (word-pop banner), server settings, audit log, admin terminal (`help` lists commands).
- **Owner console**: role editor, promote/demote Commanders, maintenance mode, sign out everyone, wipes (password re-confirm), JSON backup, ownership transfer.
- **Themes**: Eclipse, Lunar, Orion, Aurora, plus eight unlockable themes from theme packs.

The owner is whoever registers the username `Warmaster` (or set `OWNER_PASSWORD` in `.env` to have that account created at startup). Sign-up is open by default (Mission control > Broadcast & server turns invite-only on). Sign-in has "keep me signed in" (30 days), and Settings has an account section to change your callsign, passcode or delete your account.

## Run locally
```
npm ci
npx tsx src/server.ts        # http://localhost:8080
npx tsc --noEmit             # type check
```
The app is served on `localhost` and proxied pages on `127.0.0.1`, so proxied sites cannot read your session (origin isolation).

## Keep your data across updates (Render and similar hosts)
Hosts like Render wipe the app's filesystem on every deploy unless a persistent disk is mounted. `render.yaml` mounts one at `/data` and sets `ARTEMIS_DATA=/data`; on any host, point `ARTEMIS_DATA` at a persistent volume. Updating the code never touches that folder.

## Deploy on a VPS
You need two hostnames pointing to the same server, for example `artemis.example.com` and `p.artemis.example.com`.
```
cp .env.example .env     # set APP_DOMAIN and PROXY_DOMAIN
docker compose up -d
```
Caddy gets HTTPS certificates automatically. Data lives in the `/data` volume.

## Environment variables
| Variable | Meaning |
|---|---|
| `PORT`, `HOST` | listen address (8080, 0.0.0.0) |
| `OWNER_USERNAME`, `OWNER_PASSWORD` | owner account (default username Warmaster); the password is created at startup if set |
| `PROXY_ORIGIN` | origin used for proxied pages, e.g. `https://p.example.com` |
| `TRUST_PROXY=1` | trust `X-Forwarded-*` (behind Caddy) |
| `ARTEMIS_DATA` | data directory |
| `RATE_LIMIT_PER_MIN` | default per-user request limit |
| `ARTEMIS_UPSTREAM_PROXY` | send outbound traffic through another proxy |
| `ARTEMIS_UA` | user agent for outbound requests |
| `ARTEMIS_ALLOW_PRIVATE=1` | disable the SSRF guard (testing only) |

## Proxy engine: Scramjet

Browsing runs on [Scramjet](https://github.com/MercuryWorkshop/scramjet). Pages are rewritten **in the browser** by a service worker, and the server only carries traffic through a Wisp tunnel at `/wisp/<token>/`. That tunnel is where Artemis keeps its rules: the signed token, bans, maintenance mode, the owner's blocklist, private-network protection and the rate limit.

- Scramjet needs a secure context: `https://`, or `http://localhost`. On plain `http` a tab falls back to the classic server-side proxy automatically.
- Locally, Scramjet runs on the same origin as the app. In production set `PROXY_ORIGIN` to a **sibling subdomain** (for example app.example.com and sites.example.com) so proxied sites cannot touch the app's session.
- The files live in `public/sj/` (shell page and service worker) and `src/scramjet.ts` (static files and tunnel).

## Host it at home (YouTube and other sites that distrust data centers)

Sites like YouTube show "sign in to confirm you're not a bot" when traffic comes from a data-center address such as Render's. A home internet connection is trusted much more, so running Artemis at home usually fixes it. Nothing is faked: the traffic simply leaves from your own address.

1. Keep a computer on at home (a Mac works). Start Artemis there with `OWNER_PASSWORD="..." npx tsx src/server.ts`. On a Mac, run `caffeinate -s` in a second Terminal tab so it does not sleep.
2. To let friends in over the internet with https (Scramjet needs https), use a tunnel so you do not have to open router ports. For example with Cloudflare Tunnel: `brew install cloudflared`, then `cloudflared tunnel --url http://localhost:8080`. It prints an `https://...trycloudflare.com` address. It changes each time you start it; a fixed address needs a free Cloudflare account and a domain.
3. Heavy video traffic through one home connection can slow your internet and can still trigger YouTube checks sometimes. Keep the member list small.

## Home exit node (YouTube while the site stays on Render)
Render's servers sit in a data center, so YouTube shows "sign in to confirm you're not a bot". The exit node fixes that without moving the whole site: a small program on a home computer carries everyone's browsing, so sites see your home internet.

1. On the home computer, in this project folder: `EXIT_KEY="pick-a-long-secret" MAIN_URL="https://your-site.onrender.com" npx tsx src/exit-node.ts` (it listens on port 8090).
2. In a second Terminal tab: `./cloudflared tunnel --url http://localhost:8090` and copy the https address it prints.
3. On the site: Owner console > Safety > Home exit node. Paste the address and the same secret, then Save and test. It shows "connected" when it works.

If the exit node or tunnel stops, Artemis checks every 20 seconds and quietly goes back to the server's own connection. Bans and the blocklist from the main site apply at the exit node too (that is what `MAIN_URL` is for). Browsing uses your home bandwidth.

## Limits
Sites that are heavy on JavaScript, use DRM video, or show CAPTCHAs may not work through any rewriting proxy.

## Preview
`npm run build:preview` builds `preview/artemis-preview.html`, a single file with sample data and no live proxying.

## Cloud browser

The ☁ button in Browse opens a real Chrome, Firefox or Edge-style browser that runs on your exit-node computer and is streamed to the site. Everyone gets one private 30-minute session; admins and above are unlimited.

On the computer that runs the exit node:

```
npm i                                   # installs playwright as an optional dependency
npx playwright install chromium firefox
EXIT_KEY="a-long-secret" MAIN_URL="https://your-site.onrender.com" npx tsx src/exit-node.ts
```

It uses the same tunnel and key as the home exit node. The browser cannot open localhost or any private/LAN address, and it follows the site's bans and blocklist. Set `CLOUD_MAX` to change how many sessions can run at once (default 4).
