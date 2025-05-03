import fs from 'fs/promises';
import CanvasContribMap from './canvas-map';

export default async function Page() {
  const raw = (await fs.readFile('public/map.txt', 'utf8')).trim();

  const grid = raw.split('\n').map(line => Array.from(line));

  return (
    <main className="w-full h-full">
      <CanvasContribMap grid={grid} imageSrc="/github.png" />
    </main>
  );
}
