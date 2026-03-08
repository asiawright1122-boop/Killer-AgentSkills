---
description: Validate a skill's structure and metadata quality (killer validate)
---

Validate a skill to ensure it meets quality standards before publishing.

1. If the user specified a skill path, use that. Otherwise default to the current directory.

// turbo
2. Run `killer validate <path>` in the terminal, replacing `<path>` with the skill directory path (or `.` for current).

3. Report any validation issues and suggest fixes.
