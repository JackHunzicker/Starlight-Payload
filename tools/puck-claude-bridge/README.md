# Puck ↔ Claude Code Bridge

Local-only process that powers the Puck in-editor AI chat with a real
**Claude Code Fable session** authenticated through the operator existing Claude
subscription OAuth. No `ANTHROPIC_API_KEY` is involved anywhere.

```
Puck AI chat (admin editor)
  → POST /api/puck/ai            (Payload-authenticated, PUCK_AI_MODE=bridge)
    → POST http://127.0.0.1:8765/chat   (this bridge, shared-secret header)
      → claude -p --model fable --output-format stream-json --resume <session>
        → existing Claude subscription OAuth (owned by the CLI, never by us)
  ← stream-json lines → validated Puck Data → data-puck-actions SSE
    → editor canvas only (unsaved until the owner clicks Save/Publish)
```

## Run

```powershell
cd tools\puck-claude-bridge
copy .env.example .env   # then set PUCK_AI_BRIDGE_SECRET (must match apps/web/.env)
node server.mjs          # or .\start-bridge.ps1
```

The web app finds it via `PUCK_AI_BRIDGE_URL` (`http://127.0.0.1:8765` for host
dev, `http://host.docker.internal:8765` from the Docker `web` container — both
already wired).

## Behavior

- `chatId → Claude session` mapping lives in `sessions.json`; every Puck chat
  resumes its own Claude conversation (`--resume`), so context persists across
  messages. Delete `sessions.json` to reset all chats.
- Claude runs with `--tools "" --max-turns 1`: pure generation, no file or
  shell access, one turn per message.
- Requests are single-flight per chat, capped at `PUCK_AI_BRIDGE_MAX_CONCURRENT`
  total, killed after `PUCK_AI_BRIDGE_TIMEOUT_MS`, and killed immediately if the
  editor cancels (connection close). Requests are logged to `logs/bridge.log`.

## Hard rules

- **Never deploy this to the VPS or bind it to a non-loopback interface.**
  Subscription OAuth must not be exposed as a shared/public inference service.
  In production the Puck AI chat only works while this bridge runs on the operator
  machine; otherwise the endpoint reports the bridge as offline.
- The shared secret is a local capability credential between the web app and
  this process — it is not an Anthropic credential and grants nothing beyond
  invoking this bridge.
- `--bare` must never be added to the claude invocation: bare mode deliberately
  skips subscription OAuth/keychain reads.
