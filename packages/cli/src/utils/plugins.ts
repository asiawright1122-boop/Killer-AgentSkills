/**
 * Plugin System
 * 
 * Enables third-party extensions for the CLI.
 * Plugins can add new commands, IDE adapters, or post-install hooks.
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const PLUGINS_DIR = path.join(os.homedir(), '.killer-skills', 'plugins');

export interface Plugin {
    name: string;
    version: string;
    description: string;
    type: PluginType;
    entryPoint: string;
    config?: Record<string, unknown>;
}

export type PluginType = 'command' | 'ide-adapter' | 'hook';

export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    type: PluginType;
    main: string;
    config?: Record<string, unknown>;
}

/**
 * Load all installed plugins
 */
export async function loadPlugins(): Promise<Plugin[]> {
    const plugins: Plugin[] = [];

    try {
        await fs.ensureDir(PLUGINS_DIR);
        const entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const manifestPath = path.join(PLUGINS_DIR, entry.name, 'plugin.json');

                if (await fs.pathExists(manifestPath)) {
                    try {
                        const manifest: PluginManifest = await fs.readJson(manifestPath);
                        plugins.push({
                            name: manifest.name,
                            version: manifest.version,
                            description: manifest.description,
                            type: manifest.type,
                            entryPoint: path.join(PLUGINS_DIR, entry.name, manifest.main),
                            config: manifest.config
                        });
                    } catch {
                        // Invalid plugin, skip
                    }
                }
            }
        }
    } catch {
        // Plugins dir doesn't exist, that's fine
    }

    return plugins;
}

/**
 * Install a plugin from a path or URL
 */
export async function installPlugin(source: string): Promise<{ success: boolean; message: string }> {
    try {
        await fs.ensureDir(PLUGINS_DIR);

        // Local path
        if (await fs.pathExists(source)) {
            const manifestPath = path.join(source, 'plugin.json');

            if (!await fs.pathExists(manifestPath)) {
                return { success: false, message: 'Invalid plugin: missing plugin.json' };
            }

            const manifest: PluginManifest = await fs.readJson(manifestPath);
            const pluginDir = path.join(PLUGINS_DIR, manifest.name);

            await fs.copy(source, pluginDir);
            return { success: true, message: `Plugin "${manifest.name}" installed` };
        }

        // npm package (future)
        if (source.startsWith('npm:')) {
            return { success: false, message: 'npm plugins not yet supported' };
        }

        return { success: false, message: `Source not found: ${source}` };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}

/**
 * Uninstall a plugin
 */
export async function uninstallPlugin(name: string): Promise<{ success: boolean; message: string }> {
    try {
        const pluginDir = path.join(PLUGINS_DIR, name);

        if (!await fs.pathExists(pluginDir)) {
            return { success: false, message: `Plugin not found: ${name}` };
        }

        await fs.remove(pluginDir);
        return { success: true, message: `Plugin "${name}" uninstalled` };
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}

/**
 * Get plugin by name
 */
export async function getPlugin(name: string): Promise<Plugin | null> {
    const plugins = await loadPlugins();
    return plugins.find(p => p.name === name) || null;
}

/**
 * Execute plugin hooks
 */
export async function executeHooks(hookName: string, context: Record<string, unknown>): Promise<void> {
    const plugins = await loadPlugins();
    const hookPlugins = plugins.filter(p => p.type === 'hook');

    for (const plugin of hookPlugins) {
        try {
            // Dynamic import of hook
            const hook = await import(plugin.entryPoint);
            if (typeof hook[hookName] === 'function') {
                await hook[hookName](context);
            }
        } catch {
            // Hook failed, continue
        }
    }
}
