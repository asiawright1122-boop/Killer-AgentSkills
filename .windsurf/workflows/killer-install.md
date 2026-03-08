---
description: Install a skill via Killer-Skills CLI (killer install <skill-name>)
---

Install a skill from the registry, GitHub, or a local path.

1. Ask the user which skill they want to install. If they already provided a skill name in their message, use that.

// turbo
2. Run `killer install <skill-name> -i windsurf -y` in the terminal, replacing `<skill-name>` with the actual skill name.

3. After installation, run `killer sync -i windsurf -y` to update the rules file so skills are discoverable.

4. Report the installation result to the user.
