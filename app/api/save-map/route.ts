import { NextResponse } from 'next/server';
import fs from 'fs/promises';

export async function POST(request: Request) {
  try {
    const { grid } = await request.json();
    const content = grid.join('\n');
    await fs.writeFile('public/map.txt', content, 'utf8');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error saving map:', err);
    return NextResponse.error();
  }
}
