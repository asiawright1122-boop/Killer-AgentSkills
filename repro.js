
import path from 'path';

const skillFiles = [
    { path: 'skills/algorithmic-art/SKILL.md' },
    { path: 'skills/pdf/SKILL.md' },
    { path: 'skills/web-design/SKILL.md' }
];

const query = 'pdf';
const normalizedQuery = query.toLowerCase();

console.log('Query:', normalizedQuery);

const exactMatch = skillFiles.find(f => {
    const dir = path.dirname(f.path).toLowerCase();
    const isExact = dir === normalizedQuery;
    const isEndsWith = dir.endsWith(`/${normalizedQuery}`);

    console.log(`Checking ${f.path}:`);
    console.log(`  Dir: '${dir}'`);
    console.log(`  Exact: ${isExact}`);
    console.log(`  EndsWith: ${isEndsWith} (check '${dir}' ends with '/${normalizedQuery}')`);

    return isExact || isEndsWith;
});

console.log('Match result:', exactMatch);
