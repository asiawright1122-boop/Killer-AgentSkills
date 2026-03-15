#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// 缺失的博客主题
const blogPosts = [
  {
    slug: 'mcp-server-not-working-troubleshooting-guide',
    title: 'MCP Server Not Working? Complete Troubleshooting Guide',
    description: 'Having issues with your MCP server? This comprehensive troubleshooting guide covers common errors, connection problems, and step-by-step solutions to get your Model Context Protocol server working again.',
    keywords: ['mcp server not working', 'mcp troubleshooting', 'mcp error fix', 'mcp connection issues'],
    intents: ['informational', 'problem-solving']
  },
  {
    slug: 'mcp-authentication-guide-secure-setup',
    title: 'MCP Authentication Guide: Secure Your Server Setup',
    description: 'Learn how to properly configure authentication for your MCP servers. This guide covers API keys, OAuth, token-based auth, and best practices for securing your AI agent integrations.',
    keywords: ['mcp authentication', 'mcp security', 'mcp api key', 'mcp oauth', 'secure mcp'],
    intents: ['informational', 'how-to']
  },
  {
    slug: 'mcp-vs-rest-api-comparison',
    title: 'MCP vs REST API: Which Should You Use for AI Agents?',
    description: 'A comprehensive comparison between Model Context Protocol (MCP) and traditional REST APIs. Learn when to use MCP servers vs REST endpoints for your AI agent applications.',
    keywords: ['mcp vs api', 'mcp vs rest', 'mcp protocol', 'when to use mcp', 'ai agent integration'],
    intents: ['comparative', 'informational']
  },
  {
    slug: 'deploy-mcp-server-to-cloudflare-workers',
    title: 'How to Deploy MCP Server to Cloudflare Workers',
    description: 'Step-by-step tutorial on deploying your MCP server to Cloudflare Workers. Save costs, improve latency, and scale automatically with edge computing.',
    keywords: ['deploy mcp server', 'cloudflare workers mcp', 'mcp edge deployment', 'serverless mcp'],
    intents: ['tutorial', 'how-to']
  },
  {
    slug: 'mcp-server-security-best-practices',
    title: 'MCP Server Security Best Practices for Production',
    description: 'Secure your MCP servers for production use. Covers input validation, rate limiting, audit logging, network security, and compliance considerations for enterprise deployments.',
    keywords: ['mcp security', 'mcp best practices', 'secure mcp server', 'mcp production'],
    intents: ['informational', 'how-to']
  },
  {
    slug: 'testing-mcp-servers-comprehensive-guide',
    title: 'Testing MCP Servers: Complete Guide for AI Developers',
    description: 'Learn various testing strategies for MCP servers including unit tests, integration tests, mocking, and CI/CD automation. Build reliable AI agent integrations.',
    keywords: ['testing mcp', 'mcp server test', 'mcp integration testing', 'mcp ci cd'],
    intents: ['tutorial', 'how-to']
  },
  {
    slug: 'claude-code-vs-cursor-mcp-comparison',
    title: 'Claude Code vs Cursor: Which MCP Server Support is Better?',
    description: 'Compare MCP server support between Claude Code and Cursor IDE. Find out which editor offers better AI agent integration, faster performance, and developer experience.',
    keywords: ['claude code mcp', 'cursor mcp', 'claude vs cursor', 'ai editor comparison'],
    intents: ['comparative']
  },
  {
    slug: 'langchain-vs-mcp-ai-integration',
    title: 'LangChain vs MCP: AI Integration Frameworks Compared',
    description: 'Compare LangChain with Model Context Protocol (MCP) for AI agent development. Understand the differences, use cases, and when to choose each approach.',
    keywords: ['langchain vs mcp', 'mcp ai framework', 'langchain alternative', 'ai agent protocol'],
    intents: ['comparative', 'informational']
  }
];

function generateBlogPost(post: typeof blogPosts[0]) {
  const year = new Date().getFullYear();
  
  const content = `---
title: "${post.title}"
description: "${post.description}"
pubDate: ${year}-01-15
author: Killer-Skills Team
heroImage: /images/blog/${post.slug}.webp
category: tutorial
featured: false
tags:
${post.keywords.map(k => `  - "${k}"`).join('\n')}
---

${post.description}

## Introduction

${post.description} This guide will walk you through everything you need to know.

## Prerequisites

Before getting started, make sure you have:

- Basic understanding of AI agents and LLMs
- Node.js or Python installed on your machine
- Access to your preferred code editor

## Main Content

### Getting Started

Let's begin by understanding the fundamentals. ${post.keywords[0]} is an important concept to grasp.

### Step-by-Step Guide

1. **First Step**: Install the required dependencies
2. **Second Step**: Configure your environment
3. **Third Step**: Test the integration

### Common Issues and Solutions

Here are some common problems you might encounter:

- **Issue 1**: Connection timeout
- **Issue 2**: Authentication errors
- **Issue 3**: Performance bottlenecks

## Best Practices

Follow these best practices for optimal results:

1. Always use secure authentication methods
2. Implement proper error handling
3. Monitor performance metrics
4. Keep dependencies updated

## Conclusion

By following this guide, you should now have a solid understanding of ${post.keywords[0]}. 

## FAQ

### What is MCP?
MCP (Model Context Protocol) is an open protocol that enables AI applications to connect to external data sources and tools securely.

### How do I get started with MCP?
Start by exploring our collection of MCP servers and follow our installation guides.

### Is MCP secure for production use?
Yes, when properly configured with authentication and security best practices, MCP servers are suitable for production environments.

---

*Have questions? Join our community on Discord or check out our documentation for more resources.*
`;

  return content;
}

function main() {
  const blogDir = 'src/content/blog/en';
  let created = 0;
  
  console.log('Creating missing blog posts...\n');
  
  blogPosts.forEach(post => {
    const filePath = path.join(blogDir, `${post.slug}.md`);
    
    if (fs.existsSync(filePath)) {
      console.log(`⏭️  Skipped: ${post.slug} (already exists)`);
      return;
    }
    
    const content = generateBlogPost(post);
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created: ${post.slug}.md`);
    created++;
  });
  
  console.log(`\n✨ Done! Created ${created} new blog posts.`);
}

main();
