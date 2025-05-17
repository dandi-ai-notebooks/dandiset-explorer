/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, CircularProgress, Stack } from "@mui/material";
import { FunctionComponent, useEffect, useMemo, useRef, useState } from "react";
import { useJupyterConnectivity } from "../jupyter/JupyterConnectivity";
import { getAllTools } from "./allTools";
import { AVAILABLE_MODELS } from "./availableModels";
import getAutoFillUserMessage from "./getAutoFillUserMessage";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import OpenRouterKeyDialog from "./OpenRouterKeyDialog";
import { ORMessage, ORToolCall } from "./openRouterTypes";
import { sendChatMessage } from "./sendChatMessage";
import StatusBar from "./StatusBar";

const MAX_CHAT_COST = 0.75;

const cheapModels = ["google/gemini-2.5-flash-preview", "openai/gpt-4o-mini"];

type ChatInterfaceProps = {
  width: number;
  height: number;
  topBubbleContent: string;
  initialUserPromptChoices?: string[];
  chatContextOpts: any;
  metadataForChatJson?: Record<string, any>;
  onChatUploaded: (metadata: any) => void;
};

const recommendedModels = [
  "google/gemini-2.5-pro-preview"
]

const ChatInterface: FunctionComponent<ChatInterfaceProps> = ({
  width,
  height,
  topBubbleContent,
  initialUserPromptChoices,
  chatContextOpts,
  metadataForChatJson,
  onChatUploaded
}) => {
  const [selectedModel, setSelectedModel] = useState(
    () =>
      localStorage.getItem("selectedModel") || "google/gemini-2.5-flash-preview"
  );

  // Save model choice to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedModel", selectedModel);
  }, [selectedModel]);
  const [messages, setMessages] = useState<ORMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<
    ORMessage[] | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [tokensUp, setTokensUp] = useState(0);
  const [tokensDown, setTokensDown] = useState(0);
  const [cost, setCost] = useState(0);
  const [toolCallForPermission, setToolCallForPermission] = useState<
    ORToolCall | undefined
  >(undefined);
  const approvedToolCalls = useRef<
    { toolCall: ORToolCall; approved: boolean }[]
  >([]);

  const jupyterConnectivity = useJupyterConnectivity();

  const handleSendMessage = async (content: string) => {
    const userMessage: ORMessage = {
      role: "user",
      content,
    };

    // as soon as user has submitted something, we enable scrolling to bottom on each new message
    setScrollToBottomEnabled(true);

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        content ? [...messages, userMessage] : [...messages],
        selectedModel,
        {
          jupyterConnectivity,
          chatContextOpts,
          onPendingMessages: (mm: ORMessage[]) => {
            setPendingMessages(mm);
          },
          askPermissionToRunTool: async (toolCall: ORToolCall) => {
            const allTools = await getAllTools();
            const tool = allTools.find(
              (t) => t.toolFunction.name === toolCall.function.name
            );
            if (!tool) {
              throw new Error(`Tool not found: ${toolCall.function.name}`);
            }
            if (!tool.requiresPermission) {
              return true;
            }

            // important: while this is set here, it is not going to take effect in this scope
            setToolCallForPermission(toolCall);
            while (true) {
              for (const {
                toolCall: toolCall2,
                approved,
              } of approvedToolCalls.current) {
                if (toolCall2 === toolCall) {
                  setToolCallForPermission(undefined);
                  approvedToolCalls.current = approvedToolCalls.current.filter(
                    (x) => x.toolCall !== toolCallForPermission
                  );
                  return approved;
                }
              }
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          },
          openRouterKey,
        }
      );
      setPendingMessages(undefined);

      if (response.usage) {
        setTokensUp((prev) => prev + response.usage!.prompt_tokens);
        setTokensDown((prev) => prev + response.usage!.completion_tokens);
        setCost((prev) => prev + response.usage!.cost);
      }

      setMessages(response.messages);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Could add error handling UI here
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // used in the settings view
    localStorage.setItem("chatCost", cost.toString());
  }, [cost]);

  const handleUploadChat = (chatData: any) => {
    // Validate uploaded data structure
    if (!chatData.messages || !Array.isArray(chatData.messages)) {
      alert("Invalid chat data: missing or invalid messages array");
      return;
    }

    // // Handle files if present
    // const nonImageFiles: string[] = [];
    // if (chatData.files) {
    //   for (const [key, value] of Object.entries(chatData.files)) {
    //     if (typeof value === "string" && value.startsWith("base64:")) {
    //       const base64Content = value.substring(7);
    //       const fileExtension = key.split(".").pop()?.toLowerCase();

    //       if (fileExtension === "png") {
    //         globalOutputItems[key] = {
    //           type: "image",
    //           format: "png",
    //           content: base64Content,
    //         };
    //       } else {
    //         nonImageFiles.push(key);
    //       }
    //     }
    //   }
    // }

    // Update chat state
    // upon initial load, we are not going to scroll to the bottom
    setScrollToBottomEnabled(false);
    setMessages(chatData.messages);
    setPendingMessages(undefined);
    setToolCallForPermission(undefined);
    approvedToolCalls.current = [];

    // Update metadata if available
    if (chatData.metadata) {
      if (chatData.metadata.tokensUp) setTokensUp(chatData.metadata.tokensUp);
      if (chatData.metadata.tokensDown)
        setTokensDown(chatData.metadata.tokensDown);
      if (chatData.metadata.totalCost) setCost(chatData.metadata.totalCost);
      if (
        chatData.metadata.model &&
        AVAILABLE_MODELS.some((m) => m.model === chatData.metadata.model)
      ) {
        setSelectedModel(chatData.metadata.model);
      }
    }

    if (chatData.metadata) {
      onChatUploaded(chatData.metadata)
    }

    // // Show warning for non-image files
    // if (nonImageFiles.length > 0) {
    //   alert(
    //     `Warning: The following files were not loaded because they are not PNG images: ${nonImageFiles.join(", ")}`,
    //   );
    // }
  };

  const handleDeleteChat = () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete the entire chat?"
    );
    if (!confirmed) return;

    setMessages([]);
    setPendingMessages(undefined);
    setToolCallForPermission(undefined);
    approvedToolCalls.current = [];
    setTokensUp(0);
    setTokensDown(0);
    setCost(0);
  };

  const [currentPromptText, setCurrentPromptText] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState<string | undefined>(() => {
    return localStorage.getItem("openRouterKey") || undefined;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSaveOpenRouterKey = (key: string) => {
    if (key) {
      localStorage.setItem("openRouterKey", key);
      setOpenRouterKey(key);
    } else {
      localStorage.removeItem("openRouterKey");
      setOpenRouterKey(undefined);
    }
  };

  const handleAutoFill = async () => {
    const { userMessage, prompt_tokens, completion_tokens, cost } = await getAutoFillUserMessage(
      messages,
      {
        model: selectedModel,
        openRouterApiKey: openRouterKey,
        chatContextOpts
      }
    )
    setCost((prev) => prev + cost);
    setTokensUp((prev) => prev + prompt_tokens);
    setTokensDown((prev) => prev + completion_tokens);
    if (!userMessage) {
      console.error("Failed to get autofill message.");
      return;
    }
    handleSendMessage(userMessage);
  }

  const [scrollToBottomEnabled, setScrollToBottomEnabled] = useState(false);

  const topBubbleContent2 = useMemo(() => {
    let ret = topBubbleContent;

    // Warn that this is an experimental app.
    const warning = "⚠️";
    ret += `\n\n${warning} This is an experimental app and is under construction. Please report any issues to the Neurosift team.`;

    if (!jupyterConnectivity.jupyterServerIsAvailable) {
      const warning = "⚠️";
      ret += `\n\n${warning} You are not connected to a Jupyter server. I will not be able to execute any code or get information about NWB files. Use the JUPYTER CONFIG tab to connect to a Jupyter server.`;
    }
    else {
      const checkmark = "✅";
      ret += `\n\n${checkmark} You are connected to a Jupyter server.`;
    }
    if (!recommendedModels.includes(selectedModel)) {
      const warning = "⚠️";
      if (cheapModels.includes(selectedModel)) {
        if (openRouterKey) {
          ret += `\n\n${warning} You are using ${selectedModel}. The recommended model is ${recommendedModels[0]}.`;
        }
        else {
          ret += `\n\n${warning} You are using ${selectedModel}, which is free for limited use. However, the recommended model is ${recommendedModels[0]} which requires an OpenRouter key. See the settings bar at the bottom of the chat.`;
        }
      }
      else {
        if (openRouterKey) {
          ret += `\n\n${warning} You are using ${selectedModel}. The recommended model is ${recommendedModels[0]}.`;
        }
        else {
          ret += `\n\n${warning} You are using ${selectedModel}. To use this model, you need to provide your own OpenRouter key. Click the gear icon to enter it.`;
        }
      }
    } else {
      const checkmark = "✅";
      ret += `\n\n${checkmark} You are using the recommended model: ${selectedModel}.`;
    }
    return ret;
  }, [topBubbleContent, jupyterConnectivity, selectedModel]);


  const messagesForUi = useMemo(() => {
    const m = [...(pendingMessages ? pendingMessages : messages)];
    let ret: ORMessage[] = [];
    const introMessage: ORMessage = {
      role: "assistant",
      content: topBubbleContent2,
    };
    ret.push(introMessage);

    ret = [...ret, ...m];

    const isFirstMessage = m.length === 0;
    if (isFirstMessage) {
      if (initialUserPromptChoices) {
        const userPromptChoicesMessage: ORMessage = {
          role: "assistant",
          content: initialUserPromptChoices
            .map(
              (choice) =>
                `[${choice}](?userPrompt=${encodeURIComponent(choice)})`
            )
            .join(" | "),
        };
        ret.push(userPromptChoicesMessage);
      }
    } else {
      const lastMessage = m[m.length - 1];

      // check for suggested prompts in assistant message
      if (
        lastMessage.role === "assistant" &&
        typeof lastMessage.content === "string"
      ) {
        const { suggestedPrompts, newContent } = parseSuggestedPrompts(
          lastMessage.content
        );
        if (suggestedPrompts && suggestedPrompts.length > 0) {
          const userPromptChoicesMessage: ORMessage = {
            role: "assistant",
            content: suggestedPrompts
              .map(
                (choice) =>
                  `[${choice}](?userPrompt=${encodeURIComponent(choice)})`
              )
              .join(" | "),
          };
          ret.push(userPromptChoicesMessage);
          ret[ret.length - 2] = {
            ...lastMessage,
            content: newContent,
          };
        }
      }

      // if the last message is a system (such as execution output), the suggested prompt is "proceed"
      if (lastMessage.role === "system") {
        const userPromptChoicesMessage: ORMessage = {
          role: "assistant",
          content: `[Continue](?userPrompt=continue)`,
        };
        ret.push(userPromptChoicesMessage);
      }
    }

    // remove the xml stuff from all of the assistant messages
    ret = ret.map((msg) => {
      if (msg.role === "assistant" && typeof msg.content === "string") {
        const { newContent } = parseSuggestedPrompts(msg.content);
        return {
          ...msg,
          content: newContent,
        };
      } else {
        return msg;
      }
    });

    return ret;
  }, [messages, pendingMessages, topBubbleContent2, initialUserPromptChoices]);

  return (
    <Box
      sx={{
        position: "relative",
        width,
        height,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MessageList
        messages={messagesForUi}
        scrollToBottomEnabled={scrollToBottomEnabled}
        toolCallForPermission={toolCallForPermission}
        onSetToolCallApproval={(toolCall, approved) => {
          approvedToolCalls.current.push({ toolCall, approved });
        }}
        onSpecialLinkClicked={(link) => {
          if (link.startsWith("?userPrompt=")) {
            const userPrompt = decodeURIComponent(link.substring(12));
            handleSendMessage(userPrompt);
          } else {
            console.warn("Unknown special link clicked:", link);
          }
        }}
        height={height - 65} // Reduced to accommodate input and compact status bar
        onDeleteMessage={
          !isLoading
            ? (msg) => {
                const confirmed = window.confirm(
                  "Are you sure you want to delete this message and all subsequent messages?"
                );
                if (!confirmed) {
                  return;
                }
                const messageIndex = messages.findIndex((m) => m === msg);
                const index =
                  messageIndex === -1 ? messages.length : messageIndex;
                setMessages(messages.slice(0, index));
                setPendingMessages(undefined);
                setToolCallForPermission(undefined);
                approvedToolCalls.current = [];
                setCurrentPromptText(
                  typeof msg.content === "string" ? msg.content : ""
                );
              }
            : undefined
        }
      />
      <Stack spacing={1} sx={{ p: 1 }}>
        {cost > MAX_CHAT_COST && (
          <Box sx={{ color: "error.main", textAlign: "center", mb: 1 }}>
            Chat cost has exceeded ${MAX_CHAT_COST.toFixed(2)}. Please start a
            new chat.
          </Box>
        )}
        {!cheapModels.includes(selectedModel) && !openRouterKey && (
          <Box sx={{ color: "error.main", textAlign: "center", mb: 1 }}>
            To use this model you need to provide your own OpenRouter key. Click
            the gear icon to enter it.
          </Box>
        )}
        <MessageInput
          currentPromptText={currentPromptText}
          setCurrentPromptText={setCurrentPromptText}
          onSendMessage={handleSendMessage}
          disabled={
            isLoading ||
            cost > MAX_CHAT_COST ||
            (!cheapModels.includes(selectedModel) && !openRouterKey)
          }
        />
        {isLoading && (
          <CircularProgress size={20} sx={{ alignSelf: "center" }} />
        )}
      </Stack>
      <StatusBar
        selectedModel={selectedModel}
        onModelChange={(model) => setSelectedModel(model)}
        tokensUp={tokensUp}
        tokensDown={tokensDown}
        totalCost={cost}
        isLoading={isLoading}
        messages={messages}
        onDeleteChat={handleDeleteChat}
        onUploadChat={handleUploadChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onAutoFill={handleAutoFill}
        metadataForChatJson={metadataForChatJson}
      />
      <OpenRouterKeyDialog
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentKey={openRouterKey}
        onSave={handleSaveOpenRouterKey}
      />
    </Box>
  );
};

export function parseSuggestedPrompts(content: string): {
  suggestedPrompts: string[] | undefined;
  newContent: string;
} {
  // 1. Initialize variables
  let suggestedPrompts: string[] | undefined = undefined;
  let newContent = content;

  // 2. Find outer XML tags
  const startTag = "<suggested-prompts>";
  const endTag = "</suggested-prompts>";
  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag);

  // 3. If both tags found, process the content
  if (startIndex !== -1 && endIndex !== -1) {
    // Extract XML content
    const xmlContent = content.slice(startIndex + startTag.length, endIndex);

    // Extract individual prompts
    const promptRegex = /<prompt>([\s\S]*?)<\/prompt>/g;
    const prompts: string[] = [];
    let match;
    while ((match = promptRegex.exec(xmlContent)) !== null) {
      prompts.push(match[1].trim());
    }

    if (prompts.length > 0) {
      suggestedPrompts = prompts;
    }
    newContent = content.slice(0, startIndex) + content.slice(endIndex + endTag.length);
  }

  return { suggestedPrompts, newContent };
}

export default ChatInterface;
