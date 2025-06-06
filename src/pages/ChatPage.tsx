/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Tab, Tabs } from "@mui/material";
import ChatInterface from "../chat/ChatInterface";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { JupyterConnectivityProvider } from "../jupyter/JupyterConnectivityProvider";
import JupyterConfigurationView from "../jupyter/JupyterConfigurationView";
import ChatsView from "../chat/ChatsView";

interface ChatPageProps {
  width: number;
  height: number;
}

const maxWidth = 1500;

function ChatPage({ width, height }: ChatPageProps) {
  const [searchParams] = useSearchParams();
  const dandisetId = searchParams.get("dandisetId") || "";
  const dandisetVersion =
    searchParams.get("dandisetVersion") || "draft";
  const chatId = searchParams.get("chatId") || undefined;

  const navigate = useNavigate();
  const handleSetChatId = useCallback((chatId: string | undefined) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (chatId) {
      newSearchParams.set("chatId", chatId);
    } else {
      newSearchParams.delete("chatId");
    }
    navigate(`${window.location.pathname}?${newSearchParams.toString()}`);
  }, [navigate, searchParams]);

  const initialPromptUserChoices = useMemo(() => {
    return ["Tell me about this dandiset."];
  }, []);

  const [selectedTab, setSelectedTab] = useState(0);

  const handleChatUploaded = useCallback(
    (metadata: any) => {
      const dandisetId = metadata.dandisetId;
      const dandisetVersion = metadata.dandisetVersion;
      if (!dandisetId || !dandisetVersion) {
        return;
      }
      const newSearchParams = new URLSearchParams();
      newSearchParams.set("dandisetId", dandisetId);
      newSearchParams.set("dandisetVersion", dandisetVersion);
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${newSearchParams.toString()}`
      );
      setSelectedTab(0);
    }, []);


  const topBubbleContent = useMemo(() => {
    return `Ask me about [Dandiset ${dandisetId} (${dandisetVersion})](https://dandiarchive.org/dandiset/${dandisetId}/${dandisetVersion})`
  }, [dandisetId, dandisetVersion]);

  if (!dandisetId) {
    return (
      <div>
        You must provide a dandsetId in the URL.
      </div>
    )
  }

  return (
    <JupyterConnectivityProvider mode="jupyter-server">
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", padding: 0, gap: 0 }}>
          <Tabs
            value={selectedTab}
            onChange={(_, newValue) => setSelectedTab(newValue)}
            variant="scrollable"
            scrollButtons={true}
            allowScrollButtonsMobile={true}
            sx={{
              minHeight: 36,
              "& .MuiTab-root": {
                minHeight: 36,
                py: 0,
                px: 1.5,
                minWidth: "auto",
              },
            }}
          >
            <Tab label="Chat" />
            <Tab label="Jupyter Config" />
            <Tab label="Chats" />
          </Tabs>
        </Box>
      </Box>
      <Box
        sx={{
          display: selectedTab === 0 ? "block" : "none",
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: Math.min(width, maxWidth),
        }}
      >
        <ChatInterface
          width={Math.min(width, maxWidth)}
          height={height}
          topBubbleContent={topBubbleContent}
          initialUserPromptChoices={initialPromptUserChoices}
          onChatUploaded={handleChatUploaded}
          dandisetId={dandisetId}
          dandisetVersion={dandisetVersion}
          chatId={chatId}
          setChatId={handleSetChatId}
        />
      </Box>
      <Box
        sx={{
          display: selectedTab === 1 ? "block" : "none",
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: Math.min(width, maxWidth),
        }}
      >
        <JupyterConfigurationView
          width={Math.min(width, maxWidth)}
          height={height - 50}
         />
      </Box>
      <Box
        sx={{
          display: selectedTab === 2 ? "block" : "none",
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: Math.min(width, maxWidth),
        }}
      >
        <ChatsView
          width={Math.min(width, maxWidth)}
          height={height - 50}
          dandisetId={dandisetId}
          dandisetVersion={dandisetVersion}
          onChatSelect={(chatId) => {
            window.location.href = `?dandisetId=${dandisetId}&dandisetVersion=${dandisetVersion}&chatId=${chatId}`;
          }}
        />
      </Box>
    </JupyterConnectivityProvider>
  );
}

export default ChatPage;
