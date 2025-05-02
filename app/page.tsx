import fs from 'fs/promises';
import path from 'path';
import CanvasContribMap from './canvas-map';

export default async function Page() {
  const filePath = path.join(process.cwd(), 'data', 'map.txt');
  const raw = (await fs.readFile(filePath, 'utf8')).trim();

  const grid = raw
    .split('\n')
    .map(line => Array.from(line).map(ch => (ch === '1' ? 1 : 0)));

  return (
    <main className="w-full h-full">
      <CanvasContribMap grid={grid} />
    </main>
  );
}
