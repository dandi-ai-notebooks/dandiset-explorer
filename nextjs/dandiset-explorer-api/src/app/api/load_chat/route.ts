import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createSignedDownloadUrl } from '../../../lib/signedUrls';

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

export async function GET(
    request: Request
) {
    try {
        const { searchParams } = new URL(request.url);
        const passcode = searchParams.get('passcode');
        const chatId = searchParams.get('chatId');
        const dandisetId = searchParams.get('dandisetId');
        const dandisetVersion = searchParams.get('dandisetVersion');

        if (!chatId) {
            return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
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

        // Get the signed download URL
        const { signedDownloadUrl } = await createSignedDownloadUrl({
            zone,
            chatId,
            dandisetId,
            dandisetVersion
        });

        return NextResponse.json({ signedUrl: signedDownloadUrl });
    } catch (error) {
        console.error('Error in load_chat:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
