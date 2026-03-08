---
description: Check and manage skill dependencies (killer deps)
---

Check skill dependencies and identify missing ones.

// turbo
1. Run `killer deps --tree` in the terminal to show the full dependency tree.

2. If there are missing dependencies, ask the user if they want to install them.

// turbo
3. If yes, run `killer deps --install` to install missing dependencies.
