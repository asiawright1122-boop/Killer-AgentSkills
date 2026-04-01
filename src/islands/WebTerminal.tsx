import React, { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface WebTerminalProps {
  owner: string;
  repo: string;
}

export default function WebTerminal({ owner, repo }: WebTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const webcontainerRef = useRef<WebContainer | null>(null);
  const termInstanceRef = useRef<Terminal | null>(null);

  const [status, setStatus] = useState<'initializing' | 'booting' | 'ready' | 'error'>('initializing');

  useEffect(() => {
    if (!terminalRef.current) return;

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
        term.writeln(`\x1b[1;33m[System] Preparing sandbox for skill: ${owner}/${repo}\x1b[0m`);

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

        term.writeln('\x1b[1;36m[System] Injecting starter files and typing your first command...\x1b[0m');

        // Simulate an interactive script setup by writing to the shell process
        const initScript = `echo "mkdir -p workspace && cd workspace" | sh\n`;
        const writer = shellProcess.input.getWriter();
        await writer.write(initScript);

        // Then we can run a simulated download or just give them a greeting note
        await writer.write(`echo "\\033[1;32mWelcome to the Sandbox! You can interact directly with Node.\\033[0m"\n`);

        // For demonstration, let's type `npx killer-skills add owner/repo` automatically but not run it so they can see it!
        // No, let's just let them run stuff.
        writer.releaseLock();

        setStatus('ready');

        // Clean up
        return () => {
          termInputHandler.dispose();
          shellProcess.kill();
        };
      } catch (e: any) {
        term.writeln(`\r\n\x1b[1;31m[Error] Failed to boot WebContainer: ${e.message}\x1b[0m`);
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
    <div className="w-full h-full p-4 relative flex flex-col">
      {status === 'initializing' || status === 'booting' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#00ffcc]/30 border-t-[#00ffcc] rounded-full animate-spin"></div>
            <p className="text-[#00ffcc] font-mono tracking-widest uppercase font-bold text-sm">
              {status === 'initializing' ? 'Initializing XTerm...' : 'Booting WebContainer v1...'}
            </p>
          </div>
        </div>
      ) : null}

      <div
        ref={terminalRef}
        className="flex-1 w-full rounded-sm overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,1)] border border-[#333]"
      />
    </div>
  );
}
