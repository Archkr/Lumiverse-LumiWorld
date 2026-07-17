# LumiWorld

LumiWorld is a Lumiverse Spindle extension with two private world-simulation channels.

- **Director Note** runs late in prompt assembly and injects a concise world-state directive before the visible reply.
- **World Agent** keeps a per-chat clock, a complete 24-hour character schedule, and current private simulation state.

LumiWorld uses Lumiverse connection profiles through `spindle.generate.raw()`. It never reads or stores API keys.

## Version 0.3.2

The desktop surface is a compact floating CRT status widget. Its upper knob opens settings and its lower knob switches channels. A normal Lumiverse drawer tab remains available as the mobile-friendly control surface.

Settings use Lumiverse shared controls for connection and model selection, so dropdowns follow the active Lumiverse theme and can open outside the settings scroll area.

## Director Note

For enabled visible generations (`normal`, `continue`, `regenerate`, `swipe`, and `impersonate`), LumiWorld:

1. Builds controller-only context from the selected history, persona, character, activated World Info, notes, and optional World Agent state.
2. Sends it to the selected controller connection.
3. Injects the returned note as a top system block named `LumiWorld Director` in Prompt Breakdown.

Controller calls are isolated per user and chat. A duplicate call for the same chat passes through rather than delaying the visible reply; unrelated chats do not block one another.

Lumiverse limits interceptors to five minutes. The Director timeout field reflects that actual host ceiling. World Agent calls have their own independent timeout setting.

## World Agent

World Agent state is stored per user and chat at:

```text
world-agent/chats/{chatId}.json
```

It stores the simulated day/hour, running state, active character/persona IDs, 24-hour schedule, location, mood, activity, thought, goal, and a short privacy-safe activity history.

Each generated schedule must be structured JSON with exactly one entry for every hour `0` through `23`. Incomplete, duplicate, malformed, or plain-text schedules are rejected without replacing the previous valid day. The settings UI exposes the raw controller output through a copy action when a generation fails.

World Agent reads the configured recent stored chat messages for every schedule and hourly update. Hidden messages are excluded and the active swipe is used. If Lumiverse cannot provide history, LumiWorld says so and does not substitute stale cached context.

When injection is enabled, `LumiWorld World Agent` appears in Prompt Breakdown. The main model receives only the current state plus the current and next two schedule slots. The full day remains available to World Agent calls and the settings UI.

## LumiState interoperability

LumiWorld publishes a public, read-only `agent_world.state.current` snapshot for LumiState and other compatible extensions. It contains only the active chat ID, source-local revision, freshness, and the simulation day, hour, and running status.

The public snapshot never includes the World Agent schedule, location, mood, activity, thought, goal, or history. Those remain private LumiWorld state.

`agent_world.contract.v1` describes the endpoint and LumiState v1 capability metadata. Missing readers do not affect LumiWorld, and publishing makes no model call.

## Permissions

LumiWorld requests:

- `interceptor` to inspect assembled prompts and inject private system blocks.
- `generation` to list connection profiles and run Director/World Agent calls.
- `chats` to resolve the active chat and character routing.
- `chat_mutation` because Lumiverse gates read-only raw message history behind `spindle.chat.getMessages(chatId)`.
- `characters` and `personas` to read enabled context cards.
- `world_books` to read activated World Info metadata and entry content.
- `ui_panels` for the desktop CRT widget.

Despite the `chat_mutation` permission name, LumiWorld only calls `getMessages()`; it does not append, update, delete, hide, or swipe chat messages.

## Privacy

LumiWorld stores settings, privacy-safe run metadata, and World Agent state. It does not store full prompts, raw controller inputs, API keys, complete controller outputs, or World Info content in run logs.

The selected controller connections receive whichever context sources the user enables. Treat those model connections with the same privacy expectations as any other chat model connection.

## Development

```bash
bun install
bun run typecheck
bun test
bun run build
```

Built `dist/` files are committed so Lumiverse can load the extension directly.
