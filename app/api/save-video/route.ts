import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File | null;
    const customFilename = (formData.get('filename') as string) || `artwork_finale_${Date.now()}.mp4`;

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), 'nft_imageupload_test');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeFilename = path.basename(customFilename);
    const targetFilePath = path.join(uploadDir, safeFilename);

    await fs.promises.writeFile(targetFilePath, buffer);

    console.log(`[save-video] Video successfully saved to ${targetFilePath} (${buffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      filename: safeFilename,
      size: buffer.length,
      savedTo: targetFilePath,
    });
  } catch (error) {
    console.error('Error saving video in /api/save-video:', error);
    return NextResponse.json(
      { error: 'Failed to save video to nft_imageupload_test' },
      { status: 500 }
    );
  }
}
