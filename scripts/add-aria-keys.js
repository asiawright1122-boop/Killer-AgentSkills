
import fs from 'node:fs';
import path from 'node:path';

const messagesDir = path.join(process.cwd(), 'src/messages');
const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json'));

const ariaKeys = {
    "en": {
        "viewSkill": "View {name}",
        "switchLanguage": "Switch Language",
        "toggleTheme": "Toggle Theme",
        "toggleMenu": "Toggle Menu",
        "addToFavorites": "Add to favorites",
        "removeFromFavorites": "Remove from favorites",
        "shareSkill": "Share this skill",
        "backToSkills": "Back to skills",
        "copyCommand": "Copy command"
    },
    "zh": {
        "viewSkill": "查看 {name}",
        "switchLanguage": "切换语言",
        "toggleTheme": "切换主题",
        "toggleMenu": "切换菜单",
        "addToFavorites": "添加到收藏",
        "removeFromFavorites": "取消收藏",
        "shareSkill": "分享此技能",
        "backToSkills": "返回技能列表",
        "copyCommand": "复制指令"
    },
    "ja": {
        "viewSkill": "{name} を表示",
        "switchLanguage": "言語を切り替え",
        "toggleTheme": "テーマを切り替え",
        "toggleMenu": "メニューを切り替え",
        "addToFavorites": "おり気に入りに追加",
        "removeFromFavorites": "お気に入りから削除",
        "shareSkill": "このスキルを共有",
        "backToSkills": "スキル一覧に戻る",
        "copyCommand": "コマンドをコピー"
    },
    "ko": {
        "viewSkill": "{name} 보기",
        "switchLanguage": "언어 변경",
        "toggleTheme": "테마 변경",
        "toggleMenu": "메뉴 토글",
        "addToFavorites": "즐겨찾기에 추가",
        "removeFromFavorites": "즐겨찾기에서 삭제",
        "shareSkill": "이 스킬 공유",
        "backToSkills": "스킬 목록으로 돌아가기",
        "copyCommand": "명령어 복사"
    },
    // Default to English for others
    "default": {
        "viewSkill": "View {name}",
        "switchLanguage": "Switch Language",
        "toggleTheme": "Toggle Theme",
        "toggleMenu": "Toggle Menu",
        "addToFavorites": "Add to favorites",
        "removeFromFavorites": "Remove from favorites",
        "shareSkill": "Share this skill",
        "backToSkills": "Back to skills",
        "copyCommand": "Copy command"
    }
};

files.forEach(file => {
    const filePath = path.join(messagesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const lang = file.replace('.json', '');

    const keysToAdd = ariaKeys[lang] || ariaKeys['default'];

    // Ensure Aria object exists
    if (!content.Aria) {
        content.Aria = {};
    }

    // Add keys if missing
    Object.entries(keysToAdd).forEach(([key, value]) => {
        if (!content.Aria[key]) {
            content.Aria[key] = value;
        }
    });

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
    console.log(`Updated ${file}`);
});
