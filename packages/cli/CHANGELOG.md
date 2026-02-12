# Changelog

All notable changes to Killer-Skills CLI will be documented in this file.

## [1.7.1] - 2026-02-12

### Changed
- **Documentation**: README updated to be bilingual (English/Chinese)
- **Metadata**: Homepage updated to killer-skills.com, repository field removed for privacy

## [1.6.2] - 2026-02-11

### Added
- **Deep MCP**: "Self-Evolving" Agent Capabilities
  - `install_skill` tool exposed via MCP
  - Agents can now programmatically install skills to upgrade themselves
  - Headless installer logic refactored for non-interactive use

## [1.6.1] - 2026-01-31

### Fixed
- Fixed registry publishing conflict for v1.6.0

## [1.6.0] - 2026-01-31

### Added
- **MCP Server**: Expose CLI as MCP server for AI agents
  - `killer-skills-mcp` binary for stdio transport
  - 5 Tools: list_skills, read_skill, search_skills, match_task, get_skill_info
  - 2 Resources: skills://list, skills://{name}

- **submit command**: Submit skills to registry
  - `killer submit ./skill --dry-run` - Validate before submission
  - Parses and validates SKILL.md metadata

- **stats command**: CLI usage statistics
  - Track installs and command usage
  - `killer stats --json` - Export as JSON

- **plugin command**: Plugin management
  - `killer plugin list` - List installed plugins
  - `killer plugin add ./path` - Install plugin
  - `killer plugin remove name` - Uninstall plugin

- **Plugin system**: Extensible architecture
  - Command plugins, IDE adapter plugins, hook plugins
  - Plugin manifest format (plugin.json)

- **UI UX PRO MAX**: Visual Overhaul
  - **Glass Ribbon CLI**: New "Stellar Horizon" Install Component with physical keycap feel
  - **Integrated Dashboard**: Unified Ecosystem Stats with embedded metrics
  - **Solar Flare Theme**: High-energy Orange/Amber visualization theme
  - **Smart Visuals**: Green growth indicators, high-contrast tooltips, pulse animations

### Changed
- Version bumped to 1.6.0
- Total commands: 18

## [1.5.0] - 2026-01-31

### Added
- **do command**: Natural language task execution
  - `killer do "处理PDF文件"` - Auto-match and execute skills
  - `killer do "..." --list` - List matches without executing
  - `killer do "..." -y` - Auto-execute best match

- **outdated command**: Check for skill updates
  - `killer outdated` - Show all skills with available updates
  - `killer outdated -v` - Show detailed update info

- **deps command**: Dependency management
  - `killer deps` - Check all skill dependencies
  - `killer deps <skill>` - Check specific skill
  - `killer deps --tree` - Show dependency tree

- **Auto-sync option**: `killer install <source> --sync`
  - Automatically runs sync after installation

- **Unit tests**: 24 test cases covering core utilities
  - Dependencies parsing tests
  - GitHub utilities tests  
  - Platform utilities tests

### Changed
- Version bumped to 1.5.0
- Total commands: 15

## [1.4.0] - 2026-01-31


### Added
- **search command**: Search for skills on GitHub and the registry
  - `killer search <query>` - Search all sources
  - `killer search <query> -s github` - Search GitHub only
  - `killer search <query> -s registry` - Search registry only
  
- **publish command**: Validate and prepare skills for publication
  - `killer publish <path>` - Validate skill structure
  - `killer publish <path> --dry-run` - Validate without changes
  - `killer publish <path> --github` - Initialize as GitHub repo

- **init command**: Initialize skills in a project
  - `killer init` - Interactive IDE selection
  - `killer init -i <ide>` - Specify IDE
  - Creates skills directory and IDE config file

- **config command**: Manage CLI configuration
  - `killer config` - List all settings
  - `killer config <key> <value>` - Set a value
  - `killer config --reset` - Reset to defaults

- **completion command**: Shell auto-completion
  - `killer completion bash` - Generate bash completion
  - `killer completion zsh` - Generate zsh completion
  - `killer completion fish` - Generate fish completion

## [1.3.0] - 2026-01-31

### Added
- **Unified install command**: Single entry point for all installation sources
  - GitHub: `killer install owner/repo`
  - Local: `killer install ./path` or `~/path`
  - Registry: `killer install skill-name`

- **IDE-specific prompt templates**: Different formats for different IDEs
  - Claude/Antigravity: XML format (OpenSkills compatible)
  - Cursor: Markdown list format
  - Windsurf: Markdown table format

- **Improved create command**:
  - `killer create <name> -t minimal` - Single SKILL.md only
  - `killer create <name> -t standard` - With scripts/ and references/
  - `killer create <name> -t full` - Full structure with examples/
  - `killer create <name> --from <skill>` - Clone existing skill

### Changed
- Converted entire codebase to TypeScript
- Removed legacy JavaScript files
- Removed old installers directory (logic merged into install.ts)

## [1.2.0] - 2026-01-31

### Added
- **manage command**: Interactive skill management
  - `killer manage` - Select skills to remove
  - `killer manage --remove-all` - Remove all skills

### Changed
- **list command** completely refactored:
  - Groups by project/global location
  - Added `--verbose` flag for detailed info
  - Added `--ide <ide>` filter
  - Shows summary statistics

- **skills.ts**: Added symbolic link support for local development

## [1.1.0] - 2026-01-31

### Added
- **sync command**: Generate AI-discoverable prompts
  - `killer sync` - Sync to appropriate file
  - `killer sync -i <ide>` - Specify target IDE
  - `killer sync --remove` - Remove skills section

- **read command**: Output skill content to stdout
  - `killer read <name>` - Single skill
  - `killer read skill1,skill2` - Multiple skills

- **update command**: Update skills from their source
  - `killer update` - Update all skills
  - `killer update <name>` - Update specific skill

- **Metadata tracking**: `.killer-meta.json` for each installed skill
  - Tracks installation source (git, local, registry)
  - Enables update functionality

## [1.0.0] - Initial Release

### Commands
- `install` - Install skills from registry
- `list` - List installed skills
