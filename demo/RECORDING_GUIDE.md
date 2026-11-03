# Clavis walkthrough recording guide

This guide produces the clean 69-second source walkthrough that Remotion will finish with narration, synchronized captions, scene wipes, titles, and product callouts.

## 1. Start the local application

From `C:\Users\hp\Arinze\clavis`:

```powershell
npm.cmd run build --workspace=@clavis/frontend
npm.cmd run preview --workspace=@clavis/frontend -- --host 127.0.0.1
```

Use `http://127.0.0.1:4173`. Do not record the deployed Vercel URL.

## 2. Configure OBS

Use a dedicated scene named `Clavis Demo`.

- Video base canvas: `1920x1080`
- Video output resolution: `1920x1080`
- Frame rate: `30 fps`
- Recording format: `Hybrid MP4` (use MKV only if Hybrid MP4 is unavailable)
- Encoder: hardware H.264 if available; otherwise x264
- Quality: high quality / medium file size
- Desktop audio: muted
- Microphone: muted
- Source: Display Capture for the primary display
- Source transform: Fit to screen, then Stretch to screen if black borders remain
- Cursor: enabled, but park it in the lower-right corner between actions
- Recording folder: `C:\Users\hp\Arinze\clavis\demo\remotion\public\video`

The display is 1280x720, so Chrome must be full-screen and OBS will scale the clean capture to 1920x1080. Remotion applies a restrained camera crop afterward.

## 3. Prepare six Chrome tabs before recording

Open Chrome, set zoom to 80%, and use DevTools Console to prepare each tab. Chrome may ask you to type `allow pasting` before accepting pasted console commands.

These commands use public testnet account IDs only. They do not load a private key and cannot sign a transaction.

### Tab 1 — landing hero

Open `http://127.0.0.1:4173/`, then run:

```js
localStorage.clear(); sessionStorage.clear(); location.href = "/";
```

### Tab 2 — owner setup

Open another local tab and run:

```js
localStorage.setItem("signedAccountId", "clavis.testnet");
localStorage.setItem("near-wallet-selector:selectedWalletId", JSON.stringify("my-near-wallet"));
localStorage.setItem("near-wallet-selector:recentlySignedInWallets", JSON.stringify(["my-near-wallet"]));
location.href = "/setup";
```

Wait for the page to load, then click `Continue` once so the tab is parked on **Set treasury limits**.

### Tab 3 — owner dashboard

Open another local tab, repeat the owner command above, and set the final line to:

```js
location.href = "/dashboard";
```

Park the page at the top with **Good morning, owner** visible.

### Tab 4 — public audit

Open `http://127.0.0.1:4173/audit`. Confirm the summary shows:

- Total decisions: 2
- Approved in view: 1
- Rejected in view: 1

### Tab 5 — worker portal

Open another local tab and run:

```js
localStorage.setItem("signedAccountId", "worker-one.testnet");
localStorage.setItem("near-wallet-selector:selectedWalletId", JSON.stringify("my-near-wallet"));
localStorage.setItem("near-wallet-selector:recentlySignedInWallets", JSON.stringify(["my-near-wallet"]));
location.href = "/worker";
```

Confirm **Hello, Worker One** is visible.

### Tab 6 — architecture close

Open `http://127.0.0.1:4173/`, scroll to the acid-green **Configure once. Let policy do the rest.** section, and leave it there.

After all tabs are prepared, return to Tab 1 and press `F11` for full-screen Chrome.

## 4. Record this exact cue sheet

Start OBS while Tab 1 is visible. Use `Ctrl+1` through `Ctrl+6` to switch tabs while Chrome is full-screen.

| Recording time | Action |
| --- | --- |
| `00:00` | Start recording on Tab 1. Hold the landing hero. |
| `00:07` | `Ctrl+2` to owner setup. Show treasury limits. |
| `00:10` | Click `Continue` to show approved recipients. |
| `00:13` | Click `Continue` to show the restricted agent account. |
| `00:16` | `Ctrl+3` to the owner dashboard. Hold treasury, anomaly alert, roster, and rules engine. |
| `00:27` | Scroll down slowly to show more of the roster, payment audit, and emergency controls. |
| `00:34` | `Ctrl+4` to the public audit. Hold the privacy headline and two decision counts. |
| `00:39` | Click the `Rejected` filter so **Recipient not approved** is visible. |
| `00:47` | Click `All` again and hold the privacy proof. |
| `00:52` | `Ctrl+5` to the worker portal. Hold the schedule, private earnings notice, route, and allocation. |
| `00:57` | `Ctrl+6` to the architecture section. Hold the autonomous loop cards. |
| `01:04` | Stop interacting; keep the architecture section still for the branded end card. |
| `01:10` | Stop OBS recording. |

Move deliberately. Do not click transaction buttons, change policy, connect a real wallet, or expose DevTools during the recording.

## 5. Register the recording

If OBS saved directly into the requested video folder, pass that file path. Otherwise the command copies it and preserves the original:

```powershell
npm.cmd run demo:register-recording -- "C:\path\to\your\Clavis Walkthrough.mp4"
```

Then verify the registration:

```powershell
npm.cmd run demo:typecheck
npx.cmd remotion compositions demo/remotion/src/index.ts
```

Once the file is registered, the final render command is:

```powershell
npm.cmd run demo:render
```
