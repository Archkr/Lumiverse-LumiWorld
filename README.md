# AgentWorld

AgentWorld is a Lumiverse Spindle extension that adds a controller-model pass before the main chat model replies.

When enabled, AgentWorld runs as a late prompt interceptor. It receives the already-assembled Lumiverse prompt, sends a capped snapshot of that prompt to a user-selected LLM connection, asks the controller model for a private world-director note, then injects that note as a top-level system message for the main generation.

AgentWorld is controller-model agnostic. Any Lumiverse LLM connection profile can be used as the controller, and API keys remain inside Lumiverse.

## At a glance

| | |
|---|---|
| Extension type | Prompt interceptor |
| Main use | Let a controller model decide how the world should react before the visible reply |
| Controller model | Any Lumiverse LLM connection profile |
| Prompt Breakdown label | `AgentWorld Director` |
| Runs on | `normal`, `continue`, `regenerate`, `swipe`, `impersonate` |
| Skips | `quiet` and any disabled generation type |
| Default permissions | `interceptor`, `generation` |

## Features

- Late-running prompt interceptor with priority `150`, so it sees earlier prompt additions such as lore and retrieval.
- Controller connection selector powered by Lumiverse connection profiles.
- Optional model override, or use the selected connection's configured model.
- Configurable temperature, max tokens, controller timeout, prompt character cap, and generation-type toggles.
- Editable advanced system/user templates for the controller prompt.
- Prompt Breakdown attribution through `AgentWorld Director`.
- Recent run log with status, timing, connection/model, error, and directive preview only.
- Graceful pass-through when disabled, unconfigured, missing permission, timed out, or errored.

## How it works

1. Lumiverse assembles the normal prompt for a visible chat generation.
2. AgentWorld receives the in-flight message array through the Spindle interceptor API.
3. AgentWorld serializes a capped snapshot of the prompt, preserving leading system context and recent tail content.
4. The selected controller connection is called through `spindle.generate.raw()`.
5. Controller output is parsed as JSON when possible. Plain text is accepted as a fallback.
6. A private system block is injected above the original prompt:

```text
[AgentWorld Director]
...
```

7. The main model receives the original prompt plus the private directive.

The controller should not write the visible assistant reply. Its job is to describe world state, NPC intent, environmental pressure, consequences, and constraints the main model should respect.

## Installation

1. Copy the repository URL:

```text
https://github.com/Archkr/Lumiverse-AgentWorld
```

2. In Lumiverse:

- Open `Extensions`
- Click `Install`
- Paste the repository URL
- Click `Install`

3. Enable AgentWorld and grant the requested permissions.
4. Open the `AgentWorld` drawer tab.
5. Select a controller LLM connection and save.

## Setup

1. Open the AgentWorld drawer tab.
2. Enable AgentWorld.
3. Pick a controller connection profile.
4. Optionally set a model override. Leave it blank to use the connection default.
5. Adjust timeout, prompt cap, temperature, and output token cap if needed.
6. Click `Test` to run a sample controller call that does not use your real chat history.
7. Click `Save`.
8. Send a normal chat message and inspect Prompt Breakdown for `AgentWorld Director`.

## Controller output

AgentWorld prefers JSON but accepts plain text.

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

If the controller returns malformed JSON, AgentWorld trims the raw text and uses it as the directive. If no usable directive is returned, the main generation continues unchanged.

## Settings reference

| Setting | Default | Notes |
|---|---|---|
| `enabled` | Off | Global master switch. |
| `connectionId` | None | Lumiverse LLM connection profile used for the controller. |
| `modelOverride` | Empty | Optional model id. Empty means use the connection default. |
| `temperature` | `0.35` | Sampling temperature for the controller call. |
| `maxTokens` | `420` | Output cap sent to the controller connection; the provider/model enforces its real maximum. |
| `timeoutMs` | `45000` | Controller-call timeout in milliseconds. AgentWorld does not impose a short cap. |
| `maxInputChars` | `60000` | Character cap for the serialized prompt snapshot. |
| `generationTypes` | All visible types | Controls which visible generation modes AgentWorld intercepts. |
| `systemTemplate` | Built-in world-director prompt | Advanced controller system prompt. |
| `userTemplate` | Built-in assembled-prompt wrapper | Advanced controller user prompt. |
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

AgentWorld requests:

- `interceptor` to receive and modify the in-flight assembled prompt.
- `generation` to call `spindle.generate.raw()` and list/inspect Lumiverse LLM connection profiles.

AgentWorld does **not** request `chats` or `chat_mutation`.

The extension does not call chat CRUD APIs, inspect raw stored message history, append messages, edit messages, delete messages, hide messages, or mutate swipes. It only uses:

- the in-flight message array provided by the interceptor API;
- read-only generation context metadata such as `chatId` and `generationType`;
- frontend `CHAT_CHANGED` routing metadata so per-user settings can be resolved correctly.

If a future feature needs stored chat reads or message edits, that should be treated as a permission expansion and documented explicitly.

## Privacy

AgentWorld stores:

- settings;
- a small recent-run ring buffer with status, timing, controller connection/model, error text, and directive preview.

AgentWorld does not persist:

- full prompts;
- full chat history;
- raw controller inputs;
- API keys;
- full controller outputs beyond the short preview in recent runs.

The controller call still sends the capped prompt snapshot to the selected LLM connection. Choose the controller connection with the same privacy expectations you would use for any other model call.

## Troubleshooting

### Connection selector is empty

Make sure the `generation` permission is granted. Lumiverse exposes connection profiles through the generation permission because the extension needs to call the selected controller model.

If the connection list fails to load, AgentWorld shows the connection-list error in the drawer instead of silently showing an empty selector.

### AgentWorld is enabled but nothing appears in Prompt Breakdown

Check:

- a controller connection is selected and saved;
- the current generation type is enabled;
- the generation is not `quiet`;
- `interceptor` and `generation` permissions are both granted;
- the recent run log does not show a timeout or controller error.

### The main reply is delayed

AgentWorld runs before the main model call. Every controller call adds pre-generation latency. Lower the prompt cap, reduce max tokens, choose a faster controller model, or lower the timeout.

### The controller writes prose instead of instructions

Open `Advanced controller prompt` and tighten the templates. The built-in prompt tells the controller not to write the visible assistant reply, but smaller or less instruction-following models may need stricter wording.

### Controller failure blocks the chat

It should not. AgentWorld is designed to pass the original messages through unchanged on missing config, permission denial, controller error, or timeout. If the main generation is blocked, check Lumiverse logs for a host-level interceptor error.

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
