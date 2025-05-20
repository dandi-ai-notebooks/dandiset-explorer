import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Chat } from '../chat/Chat';

const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
};

const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
};

const getUniqueModels = (chat: Chat) => {
    const models = new Set(chat.messageMetadata.map(m => m.model));
    return Array.from(models).join(', ');
};

interface AdminChatsPageProps {
    width: number;
    height: number;
}

const AdminChatsPage = ({ width, height }: AdminChatsPageProps) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const passcode = "default-chat-passcode";

    useEffect(() => {
        const fetchChats = async () => {
            const response = await fetch(
                `https://dandiset-explorer-api.vercel.app/api/list_chats?passcode=${passcode}`
            );

            if (!response.ok) {
                console.error("Failed to fetch chats");
                return;
            }

            const data = await response.json();
            setChats(data.chats);
        };

        fetchChats();
    }, []);

    return (
        <TableContainer
            component={Paper}
            sx={{
                width,
                height,
                overflow: 'auto'
            }}
        >
            <Table stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell>Created</TableCell>
                        <TableCell>Last Updated</TableCell>
                        <TableCell>Dandiset</TableCell>
                        <TableCell>Version</TableCell>
                        <TableCell>Messages</TableCell>
                        <TableCell>Est. Cost</TableCell>
                        <TableCell>Models</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {chats.map((chat) => (
                        <TableRow key={chat.chatId}>
                            <TableCell>{formatTimestamp(chat.timestampCreated)}</TableCell>
                            <TableCell>{formatTimestamp(chat.timestampUpdated)}</TableCell>
                            <TableCell>{chat.dandisetId}</TableCell>
                            <TableCell>{chat.dandisetVersion}</TableCell>
                            <TableCell>{chat.messageMetadata.length}</TableCell>
                            <TableCell>{formatCost(chat.estimatedCost)}</TableCell>
                            <TableCell>{getUniqueModels(chat)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default AdminChatsPage;
