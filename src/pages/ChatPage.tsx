/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Tab, Tabs } from "@mui/material";
import ChatInterface from "../chat/ChatInterface";
import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { JupyterConnectivityProvider } from "../jupyter/JupyterConnectivityProvider";
import JupyterConfigurationView from "../jupyter/JupyterConfigurationView";

interface ChatPageProps {
  width: number;
  height: number;
}

const maxWidth = 1500;

function ChatPage({ width, height }: ChatPageProps) {
  const [searchParams] = useSearchParams();
  const dandisetId = searchParams.get("dandisetId") || "001174";
  const dandisetVersion =
    searchParams.get("dandisetVersion") || "0.250331.2218";

  const chatContextOpts = useMemo(
    () => ({
      dandisetId,
      dandisetVersion,
    }),
    [dandisetId, dandisetVersion]
  );

  const metadataForChatJson = useMemo(() => {
    return {
      application: "dandiset-explorer",
      dandisetId,
      dandisetVersion,
    };
  }, [dandisetId, dandisetVersion]);

  const initialPromptUserChoices = useMemo(() => {
    return ["Tell me about this dandiset"];
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
          topBubbleContent={`Ask me questions about Dandiset ${dandisetId} version ${dandisetVersion}`}
          initialUserPromptChoices={initialPromptUserChoices}
          chatContextOpts={chatContextOpts}
          metadataForChatJson={metadataForChatJson}
          onChatUploaded={handleChatUploaded}
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
        <JupyterConfigurationView />
      </Box>
    </JupyterConnectivityProvider>
  );
}

export default ChatPage;
