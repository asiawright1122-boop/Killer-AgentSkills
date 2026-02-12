/**
 * Example Hook Plugin for Killer-Skills CLI
 * 
 * This plugin demonstrates how to create hooks that run
 * after skill installations or other CLI events.
 */

/**
 * Called after a skill is installed
 * @param {Object} context - Installation context
 * @param {string} context.skillName - Name of the installed skill
 * @param {string} context.skillPath - Path where skill was installed
 * @param {string} context.ide - Target IDE
 */
export async function onInstall(context) {
    console.log(`\n🎉 Hook: Skill "${context.skillName}" installed!`);
    console.log(`   Path: ${context.skillPath}`);
    console.log(`   IDE: ${context.ide}`);

    // Example: Send notification, update stats, etc.
}

/**
 * Called after skills are synced
 * @param {Object} context - Sync context
 * @param {number} context.skillCount - Number of skills synced
 * @param {string[]} context.ides - IDEs that were synced
 */
export async function onSync(context) {
    console.log(`\n🔄 Hook: ${context.skillCount} skills synced`);
    console.log(`   IDEs: ${context.ides.join(', ')}`);
}

/**
 * Called after a skill is updated
 * @param {Object} context - Update context
 * @param {string} context.skillName - Name of the updated skill
 * @param {string} context.oldVersion - Previous version
 * @param {string} context.newVersion - New version
 */
export async function onUpdate(context) {
    console.log(`\n⬆️ Hook: Skill "${context.skillName}" updated`);
    console.log(`   ${context.oldVersion} → ${context.newVersion}`);
}
