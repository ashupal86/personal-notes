import fs from 'fs';
const appShell = fs.readFileSync('src/components/AppShell.tsx', 'utf-8');
console.log("AppShell read successfully. Lines around sidebar toggle:");
console.log(appShell.split('\n').slice(540, 560).join('\n'));
