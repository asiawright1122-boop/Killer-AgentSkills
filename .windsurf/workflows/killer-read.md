---
description: Read and load a skill's content (npx killer-skills read <skill-name>)
---

Read a skill's content and load its instructions into context.

1. If the user didn't specify a skill name, run `npx killer-skills list` first to show available skills and ask which one to load.

// turbo
2. Run `npx killer-skills read <skill-name>` in the terminal, replacing `<skill-name>` with the actual skill name.

3. Parse the output and follow the skill's instructions for the current task.
