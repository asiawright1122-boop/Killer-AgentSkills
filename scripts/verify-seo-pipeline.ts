
import { AIService } from './lib/ai';

class TestAIService extends AIService {
    async callAI(prompt: string, jsonMode: boolean = false, skipNvidia: boolean = false): Promise<string | null> {
        console.log("\n\n--- GENERATED PROMPT PREVIEW ---");
        console.log(prompt);
        console.log("--------------------------------\n\n");

        // Return a valid dummy response to test parsing logic
        return JSON.stringify({
            seoTitle: { en: "Test Skill: Optimized for Agents" },
            description: { en: "Test Skill is a powerful library. It allows you to do X, Y, and Z." },
            definition: { en: "Test Skill is a library for..." },
            features: { en: ["Feature A", "Feature B"] },
            keywords: { en: ["keyword1", "keyword2"] }
        });
    }
}

async function verify() {
    // Initialize with dummy keys to bypass "hasNvidia" check
    const service = new TestAIService({
        nvidiaKeys: ["dummy"],
        siliconFlowKey: "dummy"
    });

    const mockContext = {
        name: "test-skill",
        topics: ["python", "ai", "agent"],
        bodyPreview: "This is a test readme content."
    };

    console.log("Running translateMetadata...");
    const result = await service.translateMetadata("Original description", mockContext);

    console.log("\n--- PARSED RESULT ---");
    console.log(JSON.stringify(result, null, 2));
}

verify();
