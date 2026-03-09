"use client";

import { useEffect } from "react";

export function ConsoleBanner() {
  useEffect(() => {
    const styles = {
      title: "color: #00d4aa; font-size: 14px; font-weight: bold; font-family: monospace;",
      subtitle: "color: #f5a623; font-size: 11px; font-family: monospace;",
      slogan: "color: #888; font-size: 11px; font-style: italic; font-family: monospace;",
      link: "color: #6c5ce7; font-size: 11px; font-family: monospace;",
      secret: "color: #555; font-size: 10px; font-family: monospace;",
      pixel: "color: #e17055; font-size: 10px; font-family: monospace; line-height: 1.1;",
    };

    console.log(
      `%c
   █████   ██████  ███████ ███    ██ ████████
  ██   ██ ██       ██      ████   ██    ██
  ███████ ██   ███ █████   ██ ██  ██    ██
  ██   ██ ██    ██ ██      ██  ██ ██    ██
  ██   ██  ██████  ███████ ██   ████    ██
`,
      styles.title
    );

    console.log(
      `%c  ████████  ██████  ██     ██ ███    ██
     ██    ██    ██ ██     ██ ████   ██
     ██    ██    ██ ██  █  ██ ██ ██  ██
     ██    ██    ██ ██ ███ ██ ██  ██ ██
     ██     ██████   ███ ███  ██   ████
`,
      styles.subtitle
    );

    console.log(
      "%c  🏘️ Give your AI agents a life beyond the terminal.\n",
      styles.slogan
    );

    console.log(
      `%c     ♟        🏠  🏡  🏢        🌳  🐱  🐕

  ┌─────────────────────────────────────────┐
  │                                         │
  │  ╔══════════════════════════════════╗    │
  │  ║  🧑‍💻 Author: Darren (苏鹏)      ║    │
  │  ║  💬 WeChat: subranium           ║    │
  │  ║  🌐 github.com/AGI-Villa       ║    │
  │  ║                                 ║    │
  │  ║  If you like this project,      ║    │
  │  ║  feel free to add me on WeChat! ║    │
  │  ╚══════════════════════════════════╝    │
  │                                         │
  └─────────────────────────────────────────┘`,
      styles.pixel
    );

    console.log(
      "%c  ⭐ https://github.com/AGI-Villa/agent-town\n",
      styles.link
    );
  }, []);

  return null;
}
