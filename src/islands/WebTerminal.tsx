import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { getSafeSandboxSkillRef } from '../lib/sandbox-skill-ref';

interface WebTerminalProps {
  owner: string;
  repo: string;
}

const PUBLIC_WEBCONTAINER_BOOT_ERROR = 'Failed to boot WebContainer. Please refresh and try again.';

export default function WebTerminal({ owner, repo }: WebTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const webcontainerRef = useRef<WebContainer | null>(null);
  const termInstanceRef = useRef<Terminal | null>(null);

  const [status, setStatus] = useState<'initializing' | 'booting' | 'ready' | 'error'>('initializing');

  useEffect(() => {
    if (!terminalRef.current) return;
    const skillRef = getSafeSandboxSkillRef(owner, repo);

    // 1. Initialize Xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#000000',
        foreground: '#e0e0e0',
        cursor: '#00ffcc',
        selectionBackground: 'rgba(0, 255, 204, 0.3)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    termInstanceRef.current = term;

    // Handle window resize for xterm
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    const bootWebContainer = async () => {
      try {
        term.writeln('\x1b[1;36m[System] Booting WebContainer Engine...\x1b[0m');
        setStatus('booting');

        // Boot the environment
        const webcontainerInstance = await WebContainer.boot();
        webcontainerRef.current = webcontainerInstance;

        term.writeln('\x1b[1;32m[System] Node.js Environment Ready!\x1b[0m');

        // Setup JSH shell session
        term.writeln(`\x1b[1;33m[System] Preparing sandbox for skill: ${skillRef}\x1b[0m`);

        // Spawn the shell
        const shellProcess = await webcontainerInstance.spawn('jsh', {
          terminal: {
            cols: term.cols,
            rows: term.rows,
          },
        });

        // Pipe Shell output to XTerm
        shellProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              term.write(data);
            },
          }),
        );

        // Pipe XTerm input to Shell
        const termInputHandler = term.onData((data) => {
          shellProcess.input.getWriter().write(data);
        });

        term.writeln('\x1b[1;36m[System] Launching automated skill installation pipeline...\x1b[0m');

        // Simulate an interactive script setup by writing to the shell process
        const initScript = `mkdir -p try-skill && cd try-skill && npm init -y > /dev/null && echo '\\x1b[1;32m[System] Initializing Agent Sandbox...\\x1b[0m' && npx killer-skills add ${skillRef}\n`;
        const writer = shellProcess.input.getWriter();
        await writer.write(initScript);

        writer.releaseLock();

        setStatus('ready');

        // Clean up
        return () => {
          termInputHandler.dispose();
          shellProcess.kill();
        };
      } catch (error) {
        console.error('[WebTerminal] Failed to boot WebContainer:', error);
        term.writeln(`\r\n\x1b[1;31m[Error] ${PUBLIC_WEBCONTAINER_BOOT_ERROR}\x1b[0m`);
        setStatus('error');
      }
    };

    bootWebContainer();

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      webcontainerRef.current?.teardown();
    };
  }, [owner, repo]);

  return (
    <div className="w-full h-[calc(100vh-80px)] min-h-[500px] p-4 relative flex flex-col bg-[var(--background)]">
      {status === 'initializing' || status === 'booting' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/90 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-5">
            <div className="w-14 h-14 border-[5px] border-dashed border-[var(--primary)] rounded-full animate-[spin_4s_linear_infinite]" />
            <p className="text-[var(--foreground)] font-mono tracking-widest uppercase font-black text-sm bg-[var(--primary)] px-3 py-1.5 border-[3px] border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)]">
              {status === 'initializing' ? 'INITIALIZING XTERM...' : 'BOOTING WEBCONTAINER ENGINE...'}
            </p>
          </div>
        </div>
      ) : null}

      <div
        ref={terminalRef}
        className="flex-1 w-full overflow-hidden border-[4px] border-[var(--border)] shadow-[8px_8px_0px_0px_var(--border)] bg-[#000000] p-3 transition-opacity duration-300"
        style={{ opacity: status === 'ready' ? 1 : 0.5 }}
      />
    </div>
  );
}
