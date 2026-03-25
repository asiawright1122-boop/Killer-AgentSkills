---
title: "MCP Server Not Working? Complete Troubleshooting Guide"
description: "Troubleshoot MCP server failures by isolating transport, auth, tool registration, runtime, and downstream dependency issues."
pubDate: 2026-01-15
author: Killer-Skills Team
heroImage: /images/blog/mcp-server-not-working-troubleshooting-guide.webp
category: tutorial
featured: false
tags:
  - "mcp server not working"
  - "mcp troubleshooting"
  - "mcp error fix"
  - "mcp connection issues"
---

When an MCP server breaks, the highest-leverage move is to identify whether the failure lives in transport, auth, tool registration, runtime execution, or the downstream system behind the tool. This guide walks through a systematic triage process with concrete diagnostic commands and fixes.

## The 5-Layer Triage Framework

MCP failures happen at one of five layers. Working through them in order eliminates the most common causes first and avoids wasting time on unlikely problems.

```
Layer 1: Connection → Can the client reach the server?
Layer 2: Authentication → Is the request authorized?
Layer 3: Discovery → Does the server expose the expected tools?
Layer 4: Execution → Does the tool run without errors?
Layer 5: Downstream → Does the external system respond correctly?
```

## Layer 1: Connection Issues

Connection failures are the most common cause of "MCP server not working" and the easiest to fix.

### Symptoms
- Editor shows "Server disconnected" or "Connection refused"
- Tools panel is empty or shows a loading spinner indefinitely
- No log output from the MCP server process

### Diagnostic Steps

**For stdio transport** (local MCP servers):

1. Verify the server command runs directly in your terminal:
```bash
node /path/to/your/mcp-server/dist/index.js
```
If this fails, the problem is in the server code itself, not the MCP connection.

2. Check your editor's MCP configuration points to the correct path:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/your/mcp-server/dist/index.js"]
    }
  }
}
```

3. Verify the server binary is executable and dependencies are installed:
```bash
ls -la /path/to/your/mcp-server/dist/index.js
cd /path/to/your/mcp-server && npm ls --depth=0
```

**For SSE transport** (remote MCP servers):

1. Test the endpoint with curl:
```bash
curl -N https://your-mcp-server.example.com/sse
```
You should see SSE event streams. A connection reset or timeout indicates a network or server issue.

2. Check for CORS issues if connecting from a browser-based client:
```bash
curl -I -X OPTIONS https://your-mcp-server.example.com/sse \
  -H "Origin: https://your-editor.com"
```

3. Verify DNS resolution and TLS certificates:
```bash
nslookup your-mcp-server.example.com
openssl s_client -connect your-mcp-server.example.com:443 -brief
```

### Common Fixes
- **Wrong path**: update the `command` or `args` in your MCP config to match the actual server location.
- **Missing build step**: run `npm run build` or `tsc` if the server needs compilation before running.
- **Port conflict**: if the server binds to a port, check if another process is already using it with `lsof -i :3000`.
- **Node version mismatch**: some MCP servers require Node 18+ or 20+. Check with `node --version`.

## Layer 2: Authentication Issues

If the connection works but tools fail or return 401/403 errors, authentication is likely the problem.

### Symptoms
- Server connects but tools return "Unauthorized" or "Forbidden"
- Some tools work but others fail with permission errors
- Tools worked yesterday but stopped working today

### Diagnostic Steps

1. Check that environment variables for credentials are set:
```bash
echo $MCP_API_KEY
echo $GITHUB_TOKEN
```

2. Verify the credential is being passed in the correct header or format. Check your MCP config for headers:
```json
{
  "mcpServers": {
    "my-server": {
      "transport": "sse",
      "url": "https://mcp.example.com/sse",
      "headers": {
        "Authorization": "Bearer ${MCP_TOKEN}"
      }
    }
  }
}
```

3. Test the credential directly:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://mcp.example.com/health
```

### Common Fixes
- **Expired token**: regenerate the API key or refresh the OAuth token.
- **Wrong environment variable name**: ensure the variable name in your config matches what is set in your shell profile.
- **Scope mismatch**: some MCP servers require specific scopes. Check the server's documentation for required permissions.
- **Editor restart needed**: some editors cache credentials at startup. Restart the editor after changing environment variables.

## Layer 3: Tool Discovery Issues

The connection and auth work, but the expected tools do not appear in your editor.

### Symptoms
- Tools panel shows the server as connected but lists no tools
- Some tools are missing from the expected set
- Tool names do not match what you expect

### Diagnostic Steps

1. Check the server's tool registration code. Tools must be registered before the server starts listening:
```typescript
server.tool('search-docs', 'Search documentation', {
  query: { type: 'string', description: 'Search query' },
}, async ({ query }) => {
  // handler
});
```

2. Verify tool registration order—tools registered after the server starts may not be discoverable.

3. Check for typos in tool names. MCP tool names are case-sensitive.

4. If the server uses dynamic tool registration, verify the data source (database, config file) is accessible.

### Common Fixes
- **Missing tool registration**: add the tool definition before calling `server.listen()` or `server.connect()`.
- **Conditional registration failing**: if tools are registered based on environment variables or feature flags, verify those conditions are met.
- **Server version mismatch**: update the MCP SDK to ensure client-server protocol compatibility.

## Layer 4: Tool Execution Issues

Tools appear and can be selected, but they fail when invoked.

### Symptoms
- Tool calls return error messages
- Tool calls hang without returning a result
- Tool calls return unexpected or empty results

### Diagnostic Steps

1. Check the server logs for stack traces or error messages:
```bash
# For local servers, check stderr output
node /path/to/server/index.js 2>&1 | tee server.log

# For Cloudflare Workers
npx wrangler tail --format=json
```

2. Test the tool handler in isolation by calling it directly:
```typescript
// Add a test endpoint to your server
const result = await searchDocsHandler({ query: 'test' });
console.log(JSON.stringify(result));
```

3. Check for missing dependencies or environment variables that the tool handler requires.

4. Verify the tool's input schema matches what the client is sending. Schema mismatches cause silent validation failures.

### Common Fixes
- **Missing environment variable**: the tool handler depends on a config value that is not set in the server's environment.
- **Dependency failure**: a required npm package is not installed or has a version conflict.
- **Timeout**: the tool handler takes too long. Add timeouts and return partial results when possible.
- **Schema validation error**: update the tool's input schema to match the actual expected arguments.

## Layer 5: Downstream System Issues

The tool handler runs but the external system it connects to fails.

### Symptoms
- Tool returns "Service unavailable" or "Connection timeout" errors
- Tool returns stale or incorrect data
- Tool works intermittently

### Diagnostic Steps

1. Test the downstream system directly:
```bash
# For database connections
psql -h your-db-host -U your-user -d your-db -c "SELECT 1"

# For API endpoints
curl -v https://api.example.com/health
```

2. Check rate limits—MCP tool calls during active coding sessions can generate bursts of API requests.

3. Verify network connectivity from the server's environment to the downstream system. Edge deployments (Cloudflare Workers, Vercel Edge) may have different network access than local development.

### Common Fixes
- **Rate limiting**: add caching or request batching to reduce downstream API calls.
- **Network isolation**: configure VPN, Cloudflare Tunnel, or IP allowlists to enable connectivity from the server's runtime environment.
- **Stale connection pool**: restart the server to clear stale database connections.

## Quick Reference Checklist

When an MCP server stops working, run through this checklist:

- [ ] Can you run the server command directly in a terminal?
- [ ] Does the editor show the server as "connected"?
- [ ] Are environment variables for credentials set and current?
- [ ] Do tools appear in the editor's tool list?
- [ ] Does a simple tool call (like a health check) succeed?
- [ ] Do server logs show any errors or warnings?
- [ ] Can the server reach its downstream dependencies?
- [ ] Has anything changed recently (editor update, server code change, credential rotation)?

## Prevention

Reduce future troubleshooting by adding these to your MCP server:

- **Health check tool**: a simple tool that returns server status, connected services, and version info.
- **Structured logging**: log every tool invocation with tool name, duration, and outcome.
- **Startup validation**: check all required environment variables and downstream connections at server startup, failing fast with clear error messages.
- **Version compatibility**: pin MCP SDK versions in your dependencies and test upgrades before deploying.

Good troubleshooting should narrow the fault domain quickly enough that you can decide whether the fix is configuration, auth, runtime code, or an upstream dependency problem—and apply the right fix in minutes, not hours.

