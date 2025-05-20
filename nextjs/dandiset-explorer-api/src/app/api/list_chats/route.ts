import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/mongodb';
import { Chat } from '../../../models/Chat';

export async function GET(
    request: Request
) {
    try {
        const { searchParams } = new URL(request.url);
        const passcode = searchParams.get('passcode');
        const dandisetId = searchParams.get('dandisetId');
        const dandisetVersion = searchParams.get('dandisetVersion');

        if (!dandisetId) {
            return NextResponse.json({ error: 'Dandiset ID is required' }, { status: 400 });
        }

        if (!dandisetVersion) {
            return NextResponse.json({ error: 'Dandiset version is required' }, { status: 400 });
        }

        if (!passcode || passcode !== process.env.CHAT_PASSCODE) {
            return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
        }

        // Query MongoDB for all chats matching the dandiset ID and version
        await connectDB();
        const chats = await Chat.find({
            dandisetId,
            dandisetVersion
        }).lean();

        // Transform results to remove MongoDB internals
        const transformedChats = chats.map(chat => {
            const { _id, __v, ...chatData } = chat;
            return chatData;
        });

        return NextResponse.json({ chats: transformedChats });
    } catch (error) {
        console.error('Error in list_chats:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
