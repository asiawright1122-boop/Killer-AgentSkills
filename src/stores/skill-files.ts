import { atom, map } from 'nanostores';

// Current selected file name
export const currentFile = atom<string>('SKILL.md');

// Content of all files (filename -> content)
export const fileContents = map<Record<string, string>>({});

// Helper to set file content
export function setFileContent(filename: string, content: string) {
    fileContents.setKey(filename, content);
}

// Helper to select a file
export function selectFile(filename: string) {
    currentFile.set(filename);
}
