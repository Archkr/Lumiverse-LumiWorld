# LumiWorld

LumiWorld is a Lumiverse Spindle extension that prepares private Director notes before visible chat replies. It uses the selected Lumiverse connection profile through `spindle.generate.raw()` and does not read or store API keys.

## Version 0.4.0

LumiWorld has one compact drawer tab for Director status, connection and model selection, reply types, context settings, and a test action. Private notes and advanced settings expand in place; prompt templates are inside advanced settings. Changes save automatically, with a retry action if saving fails. The controls follow the active Lumiverse theme and use host shared components where available.

The former floating widget and World Agent simulation have been removed. Existing World Agent files and saved settings are left in extension storage for recovery by an older release. LumiWorld v0.4 does not read or run that data. Historical run entries remain stored. The drawer does not include an activity view. The former `agent_world.state.current` LumiState endpoint is no longer published.

## Director Note

For enabled visible generation types (`normal`, `continue`, `regenerate`, `swipe`, and `impersonate`), LumiWorld:

1. Builds controller-only context from the assembled prompt, recent chat history, and selected persona, character, activated World Info, and additional notes.
2. Sends that context to the selected Director connection.
3. Injects the returned note as a top system block named `LumiWorld Director` in Prompt Breakdown.

A duplicate Director call for the same user and chat passes through without delaying the visible reply; unrelated chats can proceed. Lumiverse caps prompt interceptors at five minutes, and the Director timeout setting follows that ceiling. If every generation type is unchecked, the Director does not run.

The **Test Director** action uses a short sample prompt and the current draft settings. It does not add a chat message or alter the active chat.

## Permissions

LumiWorld requests:

- `interceptor` to inspect assembled prompts and inject the private system block.
- `generation` to list connection profiles and run Director calls.
- `chats` to resolve character routing where needed.
- `characters` and `personas` to read enabled context cards.
- `world_books` to read activated World Info metadata and entries.

The drawer tab does not require `ui_panels`. LumiWorld no longer requests `chat_mutation`.

## Privacy

LumiWorld stores Director settings and privacy-safe run metadata. It does not store full prompts, raw controller inputs, API keys, complete controller outputs, or World Info content in run logs. The chosen Director connection receives the context sources that the user enables.

## Development

```bash
bun install
bun run typecheck
bun test
bun run build
```

Built `dist/` files are committed so Lumiverse can load the extension directly. Extension API usage follows the developer docs in the main Lumiverse repository.
