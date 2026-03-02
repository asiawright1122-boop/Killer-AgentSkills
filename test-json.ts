import { robustParseJSON } from './scripts/lib/utils.js';
const result = "```json\n{ \"title\": \"a\" }\n```";
console.log("Output:");
console.dir(robustParseJSON(result));
