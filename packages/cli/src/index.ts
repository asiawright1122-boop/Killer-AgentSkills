#!/usr/bin/env node
import { Command } from 'commander';

// Core commands
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { createCommand } from './commands/create.js';

// Skill management commands
import { syncCommand } from './commands/sync.js';
import { readCommand } from './commands/read.js';
import { updateCommand } from './commands/update.js';
import { manageCommand } from './commands/manage.js';
import { validateCommand } from './commands/validate.js';

// Discovery commands
import { searchCommand } from './commands/search.js';
import { publishCommand } from './commands/publish.js';
import { loginCommand } from './commands/login.js';

// Project commands
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { completionCommand } from './commands/completion.js';

// Advanced commands
import { doCommand } from './commands/do.js';
import { outdatedCommand } from './commands/outdated.js';
import { depsCommand } from './commands/deps.js';

// v1.6.0 new commands
import { submitCommand } from './commands/submit.js';
import { statsCommand } from './commands/stats.js';
import { pluginCommand } from './commands/plugin.js';

const program = new Command();

program
    .name('killer')
    .description('Killer-Skills CLI - Install and manage Agent Skills')
    .version('1.7.0');

// Core commands
program.addCommand(installCommand);
program.addCommand(listCommand);
program.addCommand(createCommand);

// Skill management commands
program.addCommand(syncCommand);
program.addCommand(readCommand);
program.addCommand(updateCommand);
program.addCommand(manageCommand);
program.addCommand(validateCommand);

// Discovery commands
program.addCommand(searchCommand);
program.addCommand(publishCommand);
program.addCommand(loginCommand);

// Project commands
program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(completionCommand);

// Advanced commands
program.addCommand(doCommand);
program.addCommand(outdatedCommand);
program.addCommand(depsCommand);

// v1.6.0 new commands
program.addCommand(submitCommand);
program.addCommand(statsCommand);
program.addCommand(pluginCommand);

program.parse();
