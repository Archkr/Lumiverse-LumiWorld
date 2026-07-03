# LumiWorld

LumiWorld is a Lumiverse Spindle extension for private world-simulation channels.

It ships with two channels:

- **Director Note**: a late prompt interceptor that asks a controller model how the world should move before the visible reply.
- **World Agent**: an experimental per-chat simulation clock that tracks a character's schedule, location, mood, activity, thought, and goal.

LumiWorld uses Lumiverse connection profiles through `spindle.generate.raw()`. API keys stay inside Lumiverse.

## At a glance

| | |
|---|---|
| Extension type | Prompt interceptor plus per-chat simulation state |
| Version | `0.3.0` |
| Drawer UI | Lofi channel deck |
| Prompt Breakdown labels | `LumiWorld Director`, `LumiWorld World Agent` |
| Runs on | `normal`, `continue`, `regenerate`, `swipe`, `impersonate` |
| Skips | `quiet` and disabled generation types |
| Permissions | `interceptor`, `generation`, `chats`, `characters`, `personas`, `world_books` |
| Not requested | `chat_mutation` |

## Channels

### Director Note

Director Note preserves the original LumiWorld behavior:

1. Lumiverse assembles a visible chat-generation prompt.
2. LumiWorld receives the in-flight message array through the interceptor API.
3. LumiWorld sends recent Lumiverse-marked chat-history messages plus enabled controller-only context to the selected controller connection.
4. The controller returns a private directive.
5. LumiWorld injects that directive as a top system message for the main model.

Optional controller context sources:

- activated World Info entries;
- active user persona;
- active character card;
- additional notes;
- current World Agent state, when available.

World Info entries are fetched from activated World Info metadata and `world_books.entries.get()`. Tagged prompt entries marked with `__isWorldInfoEntry` remain a fallback only.

### World Agent

World Agent is a per-chat simulation layer. It has its own LLM connection, model override, temperature, token cap, timeout, and prompt templates.

State is stored per user and chat at:

```text
world-agent/chats/{chatId}.json
```

Tracked state includes:

- day and hour;
- running or paused clock status;
- last tick time;
- active character/persona ids;
- daily schedule;
- location;
- mood;
- activity;
- current thought;
- goal;
- short activity history.

The clock is intentionally conservative:

- each chat has its own clock;
- automatic ticks only run while Lumiverse is visible when visible-only ticking is enabled;
- missed time does not trigger catch-up bursts;
- manual `+1 Hour` advances exactly one simulated hour.

When World Agent state exists and injection is enabled, LumiWorld injects a separate private `LumiWorld World Agent` system block for visible prompt generations. The block contains only current clock/schedule/state, not raw prompts, full logs, or raw model outputs.

## Settings

Director Note settings:

| Setting | Default |
|---|---|
| `enabled` | Off |
| `connectionId` | None |
| `modelOverride` | Empty |
| `temperature` | `0.35` |
| `maxTokens` | `420` |
| `timeoutMs` | `45000` |
| `maxInputChars` | `60000` |
| `historyMessageLimit` | `12` |
| `includeWorldInfoEntries` | Off |
| `includeUserPersona` | On |
| `includeCharacter` | On |
| `generationTypes` | All visible types |
| `additionalNotes` | Empty |
| `systemTemplate` | Built-in director prompt |
| `userTemplate` | Built-in controller wrapper |
| `runLogLimit` | `12` |

World Agent settings:

| Setting | Default |
|---|---|
| `worldAgent.enabled` | Off |
| `worldAgent.connectionId` | None |
| `worldAgent.modelOverride` | Empty |
| `worldAgent.temperature` | `0.45` |
| `worldAgent.maxTokens` | `700` |
| `worldAgent.timeoutMs` | `60000` |
| `worldAgent.hourDurationMs` | `300000` |
| `worldAgent.injectState` | On |
| `worldAgent.autoTickVisibleOnly` | On |
| `worldAgent.scheduleTemplate` | Built-in schedule prompt |
| `worldAgent.updateTemplate` | Built-in hourly update prompt |

Template variables include:

```text
{{prompt}}
{{generationType}}
{{chatId}}
{{connectionId}}
{{timestamp}}
{{maxDirectiveChars}}
{{user}}
{{char}}
{{day}}
{{hour}}
{{time}}
{{state}}
{{schedule}}
```

`{{user}}` resolves from the active persona name with the Lumiverse-style fallback of `User`. `{{char}}` resolves from the active character name with the fallback of `Character`.

## Permissions

LumiWorld requests:

- `interceptor` for reading the in-flight prompt and injecting private system blocks.
- `generation` for connection-profile access and controller/World Agent model calls.
- `chats` for active chat and character routing.
- `characters` for read-only character-card context.
- `personas` for read-only active persona context.
- `world_books` for activated World Info metadata and entry fetches.

LumiWorld does **not** request `chat_mutation`.

The extension does not append, edit, delete, hide, or swipe chat messages. It stores only settings, a privacy-safe recent-run log, and per-chat World Agent state.

## Privacy

Stored data:

- settings;
- recent run/activity log with status, timing, connection/model, error text, counts, and short previews;
- World Agent per-chat state.

Not stored:

- full prompts;
- raw controller inputs;
- API keys;
- full controller outputs;
- World Info entry content in run logs.

The selected LLM connections receive the enabled controller context required for each channel. Choose those connections with the same privacy expectations you would use for any model call.

## Development

```bash
bun install
bun run typecheck
bun test
bun run build
```

The repository ships built `dist/` files so direct install/update flows can load LumiWorld without a separate build step.
