import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createSignedUploadUrl } from '../../../lib/signedUrls';

const s3BucketUri = process.env.S3_BUCKET_URI;
const s3Credentials = process.env.S3_CREDENTIALS;

if (!s3BucketUri) {
    throw new Error('S3_BUCKET_URI is not defined');
}
if (!s3Credentials) {
    throw new Error('S3_CREDENTIALS is not defined');
}

const zone = {
    bucketUri: s3BucketUri,
    credentials: s3Credentials,
    directory: 'dandiset-explorer-chats'
};

const sha1Hash = (data: string) => {
    const hash = createHash('sha1');
    hash.update(data);
    return hash.digest('hex');
};

export async function GET(
    request: Request
) {
    try {
        const { searchParams } = new URL(request.url);
        const passcode = searchParams.get('passcode');
        const chatId = searchParams.get('chatId');
        const chatKey = searchParams.get('chatKey');
        const dandisetId = searchParams.get('dandisetId');
        const dandisetVersion = searchParams.get('dandisetVersion');
        const size = parseInt(searchParams.get('size') || "");

        if (!chatId) {
            return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
        }

        if (!chatKey) {
            return NextResponse.json({ error: 'Chat key is required' }, { status: 400 });
        }

        const chatKeyHash = await sha1Hash(chatKey);
        if (chatKeyHash !== chatId) {
            return NextResponse.json({ error: 'Invalid chat key' }, { status: 401 });
        }

        if (!dandisetId) {
            return NextResponse.json({ error: 'Dandiset ID is required' }, { status: 400 });
        }

        if (!dandisetVersion) {
            return NextResponse.json({ error: 'Dandiset version is required' }, { status: 400 });
        }

        if (!passcode || passcode !== process.env.CHAT_PASSCODE) {
            return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
        }

        if (!size) {
            return NextResponse.json({ error: 'Size is required' }, { status: 400 });
        }

        if (size > 1024 * 1024 * 100) {
            return NextResponse.json({ error: 'File size exceeds limit' }, { status: 400 });
        }

        // Generate the signed upload URL
        const { signedUploadUrl } = await createSignedUploadUrl({
            zone,
            chatId,
            dandisetId,
            dandisetVersion,
            size
        });

        return NextResponse.json({ signedUrl: signedUploadUrl });
    } catch (error) {
        console.error('Error in save_chat:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
