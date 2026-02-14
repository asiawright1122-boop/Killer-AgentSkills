/**
 * Completion Command
 * 
 * Generate shell completion scripts for bash, zsh, and fish.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SUPPORTED_IDES } from '../config/ides.js';

export const completionCommand = new Command('completion')
    .description('Generate shell completion scripts')
    .argument('<shell>', 'Shell type: bash, zsh, fish')
    .action(async (shell: string) => {
        const scripts: Record<string, string> = {
            bash: generateBashCompletion(),
            zsh: generateZshCompletion(),
            fish: generateFishCompletion()
        };

        if (!scripts[shell]) {
            console.error(chalk.red(`Unknown shell: ${shell}`));
            console.log(chalk.dim('Supported shells: bash, zsh, fish'));
            process.exit(1);
        }

        console.log(scripts[shell]);
    });

function generateBashCompletion(): string {
    const idesStr = SUPPORTED_IDES.join(' ');

    return `# Killer-Skills bash completion
# Add to ~/.bashrc:
#   source <(killer completion bash)
# Or save to:
#   killer completion bash > /etc/bash_completion.d/killer

_killer_completions() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    local commands="install list create sync read update manage search publish init config completion help"
    
    # IDE options
    local ides="${idesStr}"
    
    case "\${prev}" in
        killer)
            COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}"))
            return 0
            ;;
        install)
            # Could add skill name completion here
            return 0
            ;;
        -i|--ide)
            COMPREPLY=($(compgen -W "\${ides}" -- "\${cur}"))
            return 0
            ;;
        -s|--scope)
            COMPREPLY=($(compgen -W "project global" -- "\${cur}"))
            return 0
            ;;
        -t|--template)
            COMPREPLY=($(compgen -W "minimal standard full" -- "\${cur}"))
            return 0
            ;;
        completion)
            COMPREPLY=($(compgen -W "bash zsh fish" -- "\${cur}"))
            return 0
            ;;
        *)
            ;;
    esac
    
    # Handle options
    case "\${cur}" in
        -*)
            local opts="--help --version --ide --scope --yes --verbose"
            COMPREPLY=($(compgen -W "\${opts}" -- "\${cur}"))
            return 0
            ;;
    esac
}

complete -F _killer_completions killer
`;
}

function generateZshCompletion(): string {
    const idesStr = SUPPORTED_IDES.join(' ');

    return `#compdef killer

# Killer-Skills zsh completion
# Add to ~/.zshrc:
#   source <(killer completion zsh)
# Or save to:
#   killer completion zsh > ~/.zsh/completions/_killer

_killer() {
    local -a commands
    commands=(
        'install:Install a skill from registry, GitHub, or local path'
        'list:List all installed skills'
        'create:Create a new skill from template'
        'sync:Sync installed skills to AGENTS.md'
        'read:Read skill content to stdout'
        'update:Update installed skills from their source'
        'manage:Interactively manage installed skills'
        'search:Search for skills on GitHub and registry'
        'publish:Publish a skill to GitHub or registry'
        'init:Initialize skills configuration'
        'config:Manage CLI configuration'
        'completion:Generate shell completion scripts'
        'help:Display help for command'
    )
    
    local -a ides
    ides=(${idesStr})
    
    local -a scopes
    scopes=(project global)
    
    local -a templates
    templates=(minimal standard full)
    
    local -a shells
    shells=(bash zsh fish)
    
    _arguments -C \\
        '1: :->command' \\
        '*: :->args' \\
        && return 0
    
    case $state in
        command)
            _describe -t commands 'killer commands' commands
            ;;
        args)
            case $words[2] in
                install)
                    _arguments \\
                        '-i[Target IDE]:ide:($ides)' \\
                        '--ide[Target IDE]:ide:($ides)' \\
                        '-s[Installation scope]:scope:($scopes)' \\
                        '--scope[Installation scope]:scope:($scopes)' \\
                        '--all[Install to all IDEs]' \\
                        '-y[Skip prompts]' \\
                        '--yes[Skip prompts]' \\
                        '*:source:_files'
                    ;;
                create)
                    _arguments \\
                        '-t[Template type]:template:($templates)' \\
                        '--template[Template type]:template:($templates)' \\
                        '-d[Description]:description:' \\
                        '--description[Description]:description:' \\
                        '-p[Path]:path:_files -/' \\
                        '--path[Path]:path:_files -/' \\
                        '--from[Clone from skill]:skill:' \\
                        '-y[Skip prompts]' \\
                        '*:name:'
                    ;;
                list)
                    _arguments \\
                        '-i[Target IDE]:ide:($ides)' \\
                        '--ide[Target IDE]:ide:($ides)' \\
                        '-v[Show verbose output]' \\
                        '--verbose[Show verbose output]'
                    ;;
                sync)
                    _arguments \\
                        '-i[Target IDE]:ide:($ides)' \\
                        '--ide[Target IDE]:ide:($ides)' \\
                        '-o[Output path]:path:_files' \\
                        '--output[Output path]:path:_files' \\
                        '-y[Skip prompts]' \\
                        '--remove[Remove skills section]'
                    ;;
                completion)
                    _describe -t shells 'shell' shells
                    ;;
                *)
                    ;;
            esac
            ;;
    esac
}

_killer "$@"
`;
}

function generateFishCompletion(): string {
    const idesStr = SUPPORTED_IDES.join(' ');

    return `# Killer-Skills fish completion
# Save to: ~/.config/fish/completions/killer.fish

# Disable file completion by default
complete -c killer -f

# Commands
complete -c killer -n __fish_use_subcommand -a install -d 'Install a skill'
complete -c killer -n __fish_use_subcommand -a list -d 'List installed skills'
complete -c killer -n __fish_use_subcommand -a create -d 'Create a new skill'
complete -c killer -n __fish_use_subcommand -a sync -d 'Sync skills to AGENTS.md'
complete -c killer -n __fish_use_subcommand -a read -d 'Read skill content'
complete -c killer -n __fish_use_subcommand -a update -d 'Update skills'
complete -c killer -n __fish_use_subcommand -a manage -d 'Manage skills'
complete -c killer -n __fish_use_subcommand -a search -d 'Search for skills'
complete -c killer -n __fish_use_subcommand -a publish -d 'Publish a skill'
complete -c killer -n __fish_use_subcommand -a init -d 'Initialize project'
complete -c killer -n __fish_use_subcommand -a config -d 'Manage configuration'
complete -c killer -n __fish_use_subcommand -a completion -d 'Generate shell completion'
complete -c killer -n __fish_use_subcommand -a help -d 'Display help'

# IDEs
set -l ides ${idesStr}

# install options
complete -c killer -n '__fish_seen_subcommand_from install' -s i -l ide -xa "$ides" -d 'Target IDE'
complete -c killer -n '__fish_seen_subcommand_from install' -s s -l scope -xa 'project global' -d 'Scope'
complete -c killer -n '__fish_seen_subcommand_from install' -l all -d 'Install to all IDEs'
complete -c killer -n '__fish_seen_subcommand_from install' -s y -l yes -d 'Skip prompts'

# create options
complete -c killer -n '__fish_seen_subcommand_from create' -s t -l template -xa 'minimal standard full' -d 'Template'
complete -c killer -n '__fish_seen_subcommand_from create' -s d -l description -d 'Description'
complete -c killer -n '__fish_seen_subcommand_from create' -s p -l path -rF -d 'Path'
complete -c killer -n '__fish_seen_subcommand_from create' -l from -d 'Clone from skill'
complete -c killer -n '__fish_seen_subcommand_from create' -s y -l yes -d 'Skip prompts'

# list options
complete -c killer -n '__fish_seen_subcommand_from list' -s i -l ide -xa "$ides" -d 'Filter by IDE'
complete -c killer -n '__fish_seen_subcommand_from list' -s v -l verbose -d 'Verbose output'

# sync options
complete -c killer -n '__fish_seen_subcommand_from sync' -s i -l ide -xa "$ides" -d 'Target IDE'
complete -c killer -n '__fish_seen_subcommand_from sync' -s o -l output -rF -d 'Output file'
complete -c killer -n '__fish_seen_subcommand_from sync' -s y -l yes -d 'Skip prompts'
complete -c killer -n '__fish_seen_subcommand_from sync' -l remove -d 'Remove section'

# completion shell options
complete -c killer -n '__fish_seen_subcommand_from completion' -xa 'bash zsh fish' -d 'Shell'

# config options
complete -c killer -n '__fish_seen_subcommand_from config' -l list -d 'List all config'
complete -c killer -n '__fish_seen_subcommand_from config' -l reset -d 'Reset config'
complete -c killer -n '__fish_seen_subcommand_from config' -l path -d 'Show config path'
`;
}
