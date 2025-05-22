import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { connectDB } from '../../../lib/mongodb';
import { Chat } from '../../../models/Chat';

const sha1Hash = (data: string) => {
    const hash = createHash('sha1');
    hash.update(data);
    return hash.digest('hex');
};

export async function POST(
    request: Request
) {
    try {
        const { chatId, chatKey, passcode } = await request.json();

        // Validate required fields
        if (!chatId || !chatKey) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const chatKeyHash = await sha1Hash(chatKey);
        if (chatKeyHash !== chatId) {
            return NextResponse.json({ error: 'Invalid chat key' }, { status: 401 });
        }

        if (!passcode || passcode !== process.env.CHAT_PASSCODE) {
            return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
        }

        // Update MongoDB document
        await connectDB();
        const result = await Chat.findOneAndUpdate(
            { chatId },
            { finalized: true },
            { new: true }
        );

        if (!result) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in finalize_chat:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
