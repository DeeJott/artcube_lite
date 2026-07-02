import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { publicId, timestamp } = await request.json();

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'artcube';

    if (!apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary API secret not configured' },
        { status: 500 }
      );
    }

    // Create signature string
    const signatureString = `public_id=${publicId}&timestamp=${timestamp}&upload_preset=${uploadPreset}${apiSecret}`;

    // Generate SHA-1 signature
    const crypto = require('crypto');
    const signature = crypto
      .createHash('sha1')
      .update(signatureString)
      .digest('hex');

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      uploadPreset,
    });
  } catch (error) {
    console.error('Cloudinary sign error:', error);
    return NextResponse.json(
      { error: 'Failed to generate signature' },
      { status: 500 }
    );
  }
}
