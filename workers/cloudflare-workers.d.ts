/**
 * Type declarations for Cloudflare Workers Workflows runtime
 * 
 * These types are provided by the Cloudflare Workers runtime at deploy time.
 * This file provides IDE support during local development.
 * 
 * @see https://developers.cloudflare.com/workflows/
 */

declare module "cloudflare:workers" {
    export interface WorkflowEvent<T = unknown> {
        payload: T;
        id: string;
        timestamp: Date;
    }

    export interface StepConfig {
        retries?: {
            limit: number;
            delay: string;
            backoff?: "constant" | "linear" | "exponential";
        };
        timeout?: string;
    }

    export interface WorkflowStep {
        do<T>(
            name: string,
            callback: () => Promise<T> | T
        ): Promise<T>;
        do<T>(
            name: string,
            config: StepConfig,
            callback: () => Promise<T>
        ): Promise<T>;
        sleep(name: string, duration: string): Promise<void>;
        sleepUntil(name: string, timestamp: Date | string): Promise<void>;
        waitForEvent<T = unknown>(
            name: string,
            options: { event: string; timeout?: string }
        ): Promise<T>;
    }

    export abstract class WorkflowEntrypoint<Env = unknown> {
        protected env: Env;
        abstract run(
            event: WorkflowEvent<unknown>,
            step: WorkflowStep
        ): Promise<unknown>;
    }

    export interface Workflow {
        create(options: { params: unknown }): Promise<{ id: string }>;
        get(id: string): Promise<WorkflowInstance>;
    }

    export interface WorkflowInstance {
        id: string;
        status: "running" | "completed" | "errored" | "paused";
        pause(): Promise<void>;
        resume(): Promise<void>;
        terminate(): Promise<void>;
    }
}

// Cloudflare KV Namespace
declare interface KVNamespace {
    get(key: string, type?: "text"): Promise<string | null>;
    get(key: string, type: "json"): Promise<unknown | null>;
    get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
    get(key: string, type: "stream"): Promise<ReadableStream | null>;
    put(
        key: string,
        value: string | ArrayBuffer | ReadableStream,
        options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }
    ): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: {
        prefix?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; cursor?: string; list_complete: boolean }>;
}

// Cloudflare Workers AI binding
declare interface Ai {
    run(
        model: string,
        inputs: {
            messages?: Array<{ role: string; content: string }>;
            prompt?: string;
            max_tokens?: number;
            temperature?: number;
        }
    ): Promise<{ response?: string }>;
}
