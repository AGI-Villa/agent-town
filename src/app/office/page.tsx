import dynamic from 'next/dynamic';

const GameCanvas = dynamic(
  () => import('@/components/game/GameCanvas'),
  { ssr: false }
);

export default function OfficePage() {
  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-white mb-6">Agent Town Office</h1>
      <div className="border-2 border-gray-700 rounded-lg overflow-hidden">
        <GameCanvas />
      </div>
      <p className="text-gray-500 mt-4 text-sm">
        Phaser.js game engine integration
      </p>
    </main>
  );
}
