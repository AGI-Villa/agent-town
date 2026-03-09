import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#000000] p-8 text-[#fff1e8]">
      <div className="text-center space-y-6">
        <pre className="font-pixel text-[#ff004d] text-xs sm:text-sm leading-relaxed whitespace-pre">
{`
    ╭─────────────╮
    │  ┌─┐  ┌─┐  │
    │  │x│  │x│  │
    │  └─┘  └─┘  │
    │     ____    │
    │    ╱    ╲   │
    ╰─────────────╯
`}
        </pre>

        <h1 className="font-pixel text-4xl text-[#ffa300]">404</h1>
        <p className="font-pixel text-sm text-[#c2c3c7]">
          This agent wandered off the map.
        </p>
      </div>

      <Link
        href="/"
        className="font-pixel text-sm text-[#29adff] hover:text-[#00e436] underline decoration-dotted transition-colors"
      >
        ← Back to Town
      </Link>
    </main>
  );
}
