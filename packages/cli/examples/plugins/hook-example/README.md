# Killer-Skills Hook Plugin Example

This is an example hook plugin that demonstrates how to create plugins for the Killer-Skills CLI.

## Plugin Structure

```
hook-example/
├── plugin.json   # Plugin manifest
├── index.js      # Hook implementations
└── README.md     # Documentation
```

## Installation

```bash
killer plugin add ./hook-example
```

## Available Hooks

| Hook | Trigger | Context |
|------|---------|---------|
| `onInstall` | After skill installation | skillName, skillPath, ide |
| `onSync` | After skills sync | skillCount, ides |
| `onUpdate` | After skill update | skillName, oldVersion, newVersion |

## Creating Your Own Plugin

1. Create a `plugin.json` with type `"hook"`
2. Export hook functions from `index.js`
3. Install with `killer plugin add ./your-plugin`

## Example Use Cases

- **Notifications**: Send Slack/Discord messages on install
- **Analytics**: Track skill usage statistics  
- **Backup**: Auto-backup skills before updates
- **Validation**: Run custom checks after sync
