# Friends Publishing House

Manga by Rare Friends holders, starring their Friends. Holders sign in with a wallet, build worlds with
FriendSDK, ink pages, and publish. Anyone can read, share to X or Farcaster, embed, or (as a holder) remix.

## What is in it

- **Holder gate**: wallet sign-in (one free signed message) plus an on-chain `balanceOf` check on the Genesis and
  Generations collections (Robinhood Chain, 4663). Rechecked every 15 minutes. Reading needs no wallet.
- **World Builder** (`/studio/world/:id`): start from any of the six FriendSDK worlds, add and drag the 18 SDK
  props, walk Friends in (the SDK depth-sorts them among the props), switch **black and white or colour**.
- **Manga editor** (`/studio/manga/:id`): 9 panel layouts (including slanted manga cuts and 4-koma), screentones,
  speed and focus lines, worlds as panel backgrounds (pan and zoom), Friends in any SDK pose (4 facings, idle and
  walk, 8 frames), speech/shout/thought/whisper/narration bubbles with draggable tails, SFX lettering, emotes,
  prop stickers, undo/redo, autosave. Whole issue in B&W or colour.
- **Publish**: pages are rasterised in the browser from the same SVG the editor shows (1200 x 1800 PNG), plus a
  1200 x 630 share card, so X and Farcaster unfurl the cover. Reader at `/read/:slug`, iframe embed at
  `/embed/:slug`, creator shelf at `/creator/:address`, RSS at `/feed.xml`, and one-click remix with credit.

## Run locally

```sh
npm install
cp .env.example .env.local   # set DEV_LOGIN_ADDRESS + DEV_CAST_WALLET for a wallet-free local sign-in
npx next dev -p 3190
```

Without `BLOB_READ_WRITE_TOKEN`, everything is stored in `./.data`. The dev sign-in only exists when
`NODE_ENV !== production`; `DEV_CAST_WALLET` is read-only (its Friends appear in the cast picker).

## Deploy (Vercel)

1. Create a Vercel Blob store and connect it (sets `BLOB_READ_WRITE_TOKEN`).
2. Set `SESSION_SECRET` (32+ random chars) and `NEXT_PUBLIC_SITE_URL`.
3. Optional: `ROBINHOOD_RPC_URL` for a private RPC, tried before the public ones.

## Where things live

- `lib/model.ts`: the document model, layouts, and the validators every API write goes through.
- `components/render/`: the page renderer (`PageSvg`), FriendSDK world and prop rendering, PNG export, share card.
- `lib/chain.ts`: holder check, owned Friends (rarefriends.com `owned-nfts`), artwork (Genesis `tokenURI`,
  Generations via FriendSDK's sprite reader), cached in storage.
- `lib/db.ts`: drafts, worlds, publishing, feed. `lib/storage.ts`: Vercel Blob or local folder.

## Credits

FriendSDK v0.1.4 (Apache-2.0) is vendored as its release tarball in `vendor/` (SHA-256 matches the release's
SHA256SUMS). World artwork: Rare Friends Isometric World Assets. Character artwork: canonical Rare Friends
Generations sprites and on-chain Genesis portraits. See FriendSDK's NOTICE.md. Fonts (SIL OFL): Dela Gothic One,
Bangers, Comic Neue, Silkscreen, Space Grotesk. Community project, not affiliated with Rare Friends.
