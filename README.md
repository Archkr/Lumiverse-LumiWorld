# Lumiverse AgentWorld

AgentWorld is a Lumiverse Spindle extension that acts as a pre-generation world director.

When enabled, it intercepts visible chat generations after Lumiverse finishes prompt assembly, sends the assembled prompt to a user-selected controller connection, asks that model how the world should react, then injects the result as a private system directive for the main model.

It is designed for Qwen-AgentWorld-style controller models, but it works with any Lumiverse LLM connection profile. API keys remain inside Lumiverse; the extension only references connection IDs.

## Features

- Prompt interceptor with Prompt Breakdown attribution: `AgentWorld Director`
- Per-user global settings
- Controller connection selector and optional model override
- Configurable temperature, max tokens, timeout, prompt character cap, and generation types
- Editable advanced system/user controller templates
- Recent run log with status, duration, connection/model, error, and directive preview only
- Graceful pass-through on missing config, permission denial, timeout, or controller failure

## Development

```bash
bun install
bun run typecheck
bun test
bun run build
```

Lumiverse can auto-build from `src/` during install, but committing `dist/` after `bun run build` is useful for direct install/update flows.

## Permissions

The manifest requests:

- `interceptor` to modify the assembled prompt before the main model call
- `generation` to call the selected controller connection and list connection profiles

It does not request `chats` or `chat_mutation`. The extension does not call chat CRUD APIs, inspect raw stored message history, or modify chat messages. It only receives the in-flight assembled prompt from the interceptor hook, whose context metadata is covered by the `interceptor` permission.

## Privacy

AgentWorld stores settings and a small recent-run ring buffer. It does not persist full prompts, full chat history, API keys, or raw controller inputs by default.
