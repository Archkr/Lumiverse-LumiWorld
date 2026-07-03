# LumiWorld

LumiWorld is a Lumiverse Spindle extension that adds a controller-model pass before the main chat model replies.

When enabled, LumiWorld runs as a late prompt interceptor. It receives Lumiverse's in-flight message array, sends only the recent messages marked as chat history plus optional controller notes to a user-selected LLM connection, asks the controller model for a private world-director note, then injects that note as a top-level system message for the main generation.

LumiWorld is controller-model agnostic. Any Lumiverse LLM connection profile can be used as the controller, and API keys remain inside Lumiverse.

## At a glance

| | |
|---|---|
| Extension type | Prompt interceptor |
| Main use | Let a controller model decide how the world should react before the visible reply |
| Controller model | Any Lumiverse LLM connection profile |
| Prompt Breakdown label | `LumiWorld Director` |
| Runs on | `normal`, `continue`, `regenerate`, `swipe`, `impersonate` |
| Skips | `quiet` and any disabled generation type |
| Default permissions | `interceptor`, `generation`, `chats`, `characters`, `personas` |

## Features

- Late-running prompt interceptor with priority `150`, so it sees earlier prompt additions such as lore and retrieval.
- Controller connection selector powered by Lumiverse connection profiles.
- Optional model override, or use the selected connection's configured model.
- Configurable context sources, chat-history message count, temperature, max tokens, controller timeout, prompt character cap, and generation-type toggles.
- Sends recent chat history, activated standalone World Info entries, the active user persona, and the active character card to the controller when enabled.
- Editable controller-only additional notes plus advanced system/user templates for the controller prompt.
- Prompt Breakdown attribution through `LumiWorld Director`.
- Recent run log with status, timing, connection/model, error, and directive preview only.
- Graceful pass-through when disabled, unconfigured, missing permission, timed out, or errored.

## How it works

1. Lumiverse assembles the normal prompt for a visible chat generation.
2. LumiWorld receives the in-flight message array through the Spindle interceptor API.
3. LumiWorld filters that array to only Lumiverse-marked chat-history messages (`__isChatHistory`/source metadata), then keeps the configured recent message count.
4. LumiWorld can include activated standalone World Info entries marked with `__isWorldInfoEntry`.
5. LumiWorld optionally fetches the active persona and active character card through Lumiverse APIs and adds them to the controller-only context.
6. The selected controller connection is called through `spindle.generate.raw()`.
7. Controller output is parsed as JSON when possible. Plain text is accepted as a fallback.
8. A private system block is injected above the original prompt:

```text
[LumiWorld Director]
...
```

9. The main model receives the original prompt plus the private directive.

The controller should not write the visible assistant reply. Its job is to describe world state, NPC intent, environmental pressure, consequences, and constraints the main model should respect.

## Installation

1. Copy the repository URL:

```text
https://github.com/Archkr/Lumiverse-LumiWorld
```

2. In Lumiverse:

- Open `Extensions`
- Click `Install`
- Paste the repository URL
- Click `Install`

3. Enable LumiWorld and grant the requested permissions.
4. Open the `LumiWorld` drawer tab.
5. Select a controller LLM connection. Settings auto-save as you edit.

## Setup

1. Open the LumiWorld drawer tab.
2. Enable LumiWorld.
3. Pick a controller connection profile.
4. Optionally set a model override. Leave it blank to use the connection default.
5. Adjust chat-history message count, timeout, prompt cap, temperature, and output token cap if needed.
6. Click `Test` to run a sample controller call that does not use your real chat history.
7. Send a normal chat message and inspect Prompt Breakdown for `LumiWorld Director`.

## Controller output

LumiWorld prefers JSON but accepts plain text.

Preferred:

```json
{
  "director_note": "The observatory door should resist opening as pressure drops; have the NPC notice the storm reacting unnaturally, but do not reveal the hidden entity yet."
}
```

Accepted:

```text
The storm intensifies around the observatory. The main model should make the door feel heavy, show NPC alarm, and preserve the mystery.
```

If the controller returns malformed JSON, LumiWorld trims the raw text and uses it as the directive. If no usable directive is returned, the main generation continues unchanged.

## Settings reference

| Setting | Default | Notes |
|---|---|---|
| `enabled` | Off | Global master switch. |
| `connectionId` | None | Lumiverse LLM connection profile used for the controller. |
| `modelOverride` | Empty | Optional model id. Empty means use the connection default. |
| `temperature` | `0.35` | Sampling temperature for the controller call. |
| `maxTokens` | `420` | Output cap sent to the controller connection; the provider/model enforces its real maximum. |
| `timeoutMs` | `45000` | Controller-call timeout in milliseconds. LumiWorld does not impose a short cap. |
| `maxInputChars` | `60000` | Character cap for the serialized controller context snapshot. |
| `historyMessageLimit` | `12` | Number of recent Lumiverse-marked chat-history messages sent to the controller. |
| `generationTypes` | All visible types | Controls which visible generation modes LumiWorld intercepts. |
| `includeWorldInfoEntries` | Off | Sends standalone World Info entries marked with `__isWorldInfoEntry` to the controller. |
| `includeUserPersona` | On | Sends the active user persona to the controller only. |
| `includeCharacter` | On | Sends the active character card to the controller only. |
| `additionalNotes` | Empty | Controller-only context notes. Always sent to the LumiWorld/controller model as a separate private system message; never injected directly into the main model prompt. |
| `systemTemplate` | Built-in world-director prompt | Advanced controller system prompt. |
| `userTemplate` | Built-in chat-history wrapper | Advanced controller user prompt. |
| `runLogLimit` | `12` | Number of recent runs retained per user. |

Available template variables:

```text
{{prompt}}
{{generationType}}
{{chatId}}
{{connectionId}}
{{timestamp}}
{{maxDirectiveChars}}
```

## Permissions

LumiWorld requests:

- `interceptor` to receive the in-flight message array and inject the director block.
- `generation` to call `spindle.generate.raw()` and list/inspect Lumiverse LLM connection profiles.
- `personas` to read the active user persona for controller-only context.
- `chats` to read the active chat's `character_id`.
- `characters` to read the active character card for controller-only context.

LumiWorld does **not** request `chat_mutation`.

The extension does not append messages, edit messages, delete messages, hide messages, or mutate swipes. It only uses:

- the in-flight message array provided by the interceptor API;
- read-only generation context metadata such as `chatId` and `generationType`;
- a read-only chat lookup to resolve the active character ID;
- read-only persona and character lookups for controller-only context;
- frontend `CHAT_CHANGED` routing metadata so per-user settings can be resolved correctly.

If a future feature needs message edits or other mutation APIs, that should be treated as a permission expansion and documented explicitly.

## Privacy

LumiWorld stores:

- settings;
- a small recent-run ring buffer with status, timing, controller connection/model, error text, and directive preview.

LumiWorld does not persist:

- full prompts;
- full stored chat history beyond the configured recent message count;
- raw controller inputs;
- API keys;
- full controller outputs beyond the short preview in recent runs.

The controller call sends the capped controller-context snapshot, including enabled chat-history, standalone World Info entries, persona, character, and additional notes, to the selected LLM connection. Choose the controller connection with the same privacy expectations you would use for any other model call.

## Troubleshooting

### Connection selector is empty

Make sure the `generation` permission is granted. Lumiverse exposes connection profiles through the generation permission because the extension needs to call the selected controller model.

If the connection list fails to load, LumiWorld shows the connection-list error in the drawer instead of silently showing an empty selector.

### LumiWorld is enabled but nothing appears in Prompt Breakdown

Check:

- a controller connection is selected;
- the current generation type is enabled;
- the generation is not `quiet`;
- `interceptor`, `generation`, and any enabled context-source permissions are granted;
- the recent run log does not show a timeout or controller error.

### The main reply is delayed

LumiWorld runs before the main model call. Every controller call adds pre-generation latency. Lower the chat-history message count or prompt cap, reduce max tokens, choose a faster controller model, or lower the timeout.

### The controller writes prose instead of instructions

Open `Advanced Settings` and tighten the templates. The built-in prompt tells the controller not to write the visible assistant reply, but smaller or less instruction-following models may need stricter wording.

### Controller failure blocks the chat

It should not. LumiWorld is designed to pass the original messages through unchanged on missing config, permission denial, controller error, or timeout. If the main generation is blocked, check Lumiverse logs for a host-level interceptor error.

## Project layout

```text
src/
  backend.ts      Backend storage, permission checks, interceptor, controller calls
  frontend.ts     Drawer settings UI and recent-run display
  shared.ts       Defaults, normalization, prompt serialization, parsing helpers
  types.ts        Frontend/backend message contracts
  shared.test.ts  Unit tests for shared behavior

dist/
  backend.js
  frontend.js

spindle.json      Extension manifest
```

## Development

```bash
bun install
bun run typecheck
bun test
bun run build
```

Lumiverse can build from `src/` during install, but this repository also ships `dist/` so direct install/update flows can load the extension without an extra build step.
