/**
 * CLI Installation Component
 * 
 * A React component that displays CLI installation instructions.
 * Can be embedded in any website that uses React.
 */

import React, { useState } from 'react';

interface CLIInstallProps {
    theme?: 'light' | 'dark';
}

export const CLIInstall: React.FC<CLIInstallProps> = ({ theme = 'dark' }) => {
    const [copied, setCopied] = useState(false);
    const installCommand = 'npm install -g killer-skills';

    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(installCommand);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isDark = theme === 'dark';

    const styles = {
        container: {
            background: isDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : '#f8fafc',
            borderRadius: '16px',
            padding: '32px',
            border: `1px solid ${isDark ? '#2d3748' : '#e2e8f0'}`,
            maxWidth: '600px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        title: {
            color: isDark ? '#fff' : '#1a202c',
            fontSize: '24px',
            fontWeight: 700,
            marginBottom: '8px'
        },
        subtitle: {
            color: isDark ? '#a0aec0' : '#718096',
            fontSize: '14px',
            marginBottom: '24px'
        },
        codeBlock: {
            background: isDark ? '#0d1117' : '#1a202c',
            borderRadius: '8px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
        },
        code: {
            color: '#e2e8f0',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '15px'
        },
        copyBtn: {
            background: 'transparent',
            border: 'none',
            color: copied ? '#48bb78' : '#a0aec0',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px',
            transition: 'all 0.2s'
        },
        features: {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px'
        },
        feature: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: isDark ? '#e2e8f0' : '#4a5568',
            fontSize: '14px'
        },
        icon: {
            color: '#48bb78',
            fontSize: '16px'
        },
        link: {
            color: '#4299e1',
            textDecoration: 'none',
            fontSize: '14px',
            marginTop: '20px',
            display: 'inline-block'
        }
    };

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>📦 Install Killer-Skills CLI</h3>
            <p style={styles.subtitle}>Manage AI agent skills across all your IDEs</p>

            <div style={styles.codeBlock}>
                <code style={styles.code}>{installCommand}</code>
                <button
                    style={styles.copyBtn}
                    onClick={copyToClipboard}
                    title="Copy to clipboard"
                >
                    {copied ? '✓ Copied' : '📋 Copy'}
                </button>
            </div>

            <div style={styles.features}>
                <div style={styles.feature}>
                    <span style={styles.icon}>✓</span>
                    <span>18 powerful commands</span>
                </div>
                <div style={styles.feature}>
                    <span style={styles.icon}>✓</span>
                    <span>8+ IDE support</span>
                </div>
                <div style={styles.feature}>
                    <span style={styles.icon}>✓</span>
                    <span>MCP Server included</span>
                </div>
                <div style={styles.feature}>
                    <span style={styles.icon}>✓</span>
                    <span>Plugin system</span>
                </div>
            </div>

            <a
                href="https://www.npmjs.com/package/killer-skills"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
            >
                View on npm →
            </a>
        </div>
    );
};

export default CLIInstall;
