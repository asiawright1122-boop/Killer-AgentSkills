# Killer-Skills IDE Adapter Plugin Example

This example shows how to add support for a custom IDE to Killer-Skills CLI.

## Plugin Structure

```
ide-adapter-example/
├── plugin.json   # Plugin manifest (type: "ide-adapter")
├── adapter.js    # IDE adapter implementation
└── README.md     # Documentation
```

## Installation

```bash
killer plugin add ./ide-adapter-example
```

## Required Exports

| Export | Type | Description |
|--------|------|-------------|
| `config` | Object | IDE configuration (name, paths, etc.) |
| `generatePrompt` | Function | Generate AI prompt content |
| `installSkill` | Function | Custom skill installation logic |
| `getPromptPath` | Function | Return path to prompt config file |

## Config Object

```javascript
export const config = {
    name: 'my-ide',           // Internal identifier
    displayName: 'My IDE',    // User-facing name
    skillsDir: '/path/to/skills',
    configFile: '.myide-rules',
    isAvailable: () => true   // Check if IDE is installed
};
```

## Creating Your Own IDE Adapter

1. Create `plugin.json` with type `"ide-adapter"`
2. Export required functions from your adapter
3. Install with `killer plugin add ./your-adapter`
4. Your IDE will now appear in `killer list --ide` options
