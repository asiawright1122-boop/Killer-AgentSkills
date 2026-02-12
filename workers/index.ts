/**
 * Killer-Skills Workflows Entrypoint
 *
 * 独立的 Worker，包含所有 Workflow 定义
 */

// 导出 Workflow 类
export { TranslationWorkflow } from "./translation-workflow";
export { SkillValidationWorkflow } from "./skill-validation-workflow";
export { ContentProcessingWorkflow } from "./content-workflow";

import {
    type Workflow,
} from "cloudflare:workers";

interface Env {
    TRANSLATION_WORKFLOW: Workflow;
    SKILL_VALIDATION_WORKFLOW: Workflow;
    CONTENT_WORKFLOW: Workflow;
}

// Worker fetch handler
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/health") {
            return new Response(
                JSON.stringify({
                    status: "ok",
                    workflows: [
                        "translation-workflow",
                        "skill-validation-workflow",
                        "content-workflow"
                    ],
                }),
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // Trigger Workflows
        if (request.method === "POST" && url.pathname.startsWith("/workflows/")) {
            const workflowName = url.pathname.split("/")[2];
            let workflow: Workflow | undefined;

            switch (workflowName) {
                case "translation":
                    workflow = env.TRANSLATION_WORKFLOW;
                    break;
                case "validation":
                    workflow = env.SKILL_VALIDATION_WORKFLOW;
                    break;
                case "content":
                    workflow = env.CONTENT_WORKFLOW;
                    break;
                default:
                    return new Response("Workflow not found", { status: 404 });
            }

            if (workflow) {
                const body = await request.json();
                const instance = await workflow.create({ params: body });
                return new Response(
                    JSON.stringify({
                        success: true,
                        id: instance.id,
                        workflow: workflowName
                    }),
                    {
                        headers: { "Content-Type": "application/json" },
                        status: 202
                    }
                );
            }
        }

        return new Response(
            "Killer-Skills Workflows Worker\n\nEndpoints:\n- POST /workflows/translation\n- POST /workflows/validation\n- POST /workflows/content\n\nPayload: JSON object matching workflow params.",
            { status: 200 }
        );
    },
};
