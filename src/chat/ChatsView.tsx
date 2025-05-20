import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Stack } from '@mui/material';
import { Chat } from './Chat';
import { getAllStoredChatKeys, removeChatKeyInfo } from './chatKeyStorage';

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

interface ChatsViewProps {
    dandisetId: string;
    dandisetVersion: string;
    onChatSelect: (chatId: string) => void;
    width: number;
    height: number;
}

const ChatsView = ({ dandisetId, dandisetVersion, onChatSelect, width, height }: ChatsViewProps) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const passcode = "default-chat-passcode";
    const storedChatKeys = getAllStoredChatKeys();

    useEffect(() => {
        const fetchChats = async () => {
            // Using passcode from component scope
            const response = await fetch(
                `https://dandiset-explorer-api.vercel.app/api/list_chats?dandisetId=${dandisetId}&dandisetVersion=${dandisetVersion}&passcode=${passcode}`
            );

            if (!response.ok) {
                console.error("Failed to fetch chats");
                return;
            }

            const data = await response.json();
            setChats(data.chats);
        };

        fetchChats();
    }, [dandisetId, dandisetVersion, passcode]);

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
                        <TableCell>Messages</TableCell>
                        <TableCell>Est. Cost</TableCell>
                        <TableCell>Models</TableCell>
                        <TableCell>Action</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {chats.map((chat) => (
                        <TableRow key={chat.chatId}>
                            <TableCell>{formatTimestamp(chat.timestampCreated)}</TableCell>
                            <TableCell>{formatTimestamp(chat.timestampUpdated)}</TableCell>
                            <TableCell>{chat.messageMetadata.length}</TableCell>
                            <TableCell>{formatCost(chat.estimatedCost)}</TableCell>
                            <TableCell>{getUniqueModels(chat)}</TableCell>
                            <TableCell>
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="outlined"
                                        onClick={() => onChatSelect(chat.chatId)}
                                    >
                                        Open
                                    </Button>
                                    {storedChatKeys[chat.chatId] && (
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            onClick={async () => {
                                                const confirmed = window.confirm('Are you sure you want to delete this chat?');
                                                if (!confirmed) return;

                                                const chatKeyInfo = storedChatKeys[chat.chatId];
                                                const response = await fetch(
                                                    `https://dandiset-explorer-api.vercel.app/api/delete_chat?chatId=${chat.chatId}&chatKey=${chatKeyInfo.chatKey}&passcode=${passcode}`,
                                                    {
                                                        method: 'DELETE'
                                                    }
                                                );

                                                if (!response.ok) {
                                                    alert('Failed to delete chat');
                                                    return;
                                                }

                                                // Remove chat key from local storage
                                                removeChatKeyInfo(chat.chatId);

                                                // Refresh the chats list
                                                const fetchResponse = await fetch(
                                                    `https://dandiset-explorer-api.vercel.app/api/list_chats?dandisetId=${dandisetId}&dandisetVersion=${dandisetVersion}&passcode=${passcode}`
                                                );

                                                if (fetchResponse.ok) {
                                                    const data = await fetchResponse.json();
                                                    setChats(data.chats);
                                                }
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    )}
                                </Stack>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ChatsView;
