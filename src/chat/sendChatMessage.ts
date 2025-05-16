/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ORMessage,
  ORRequest,
  ORResponse,
  ORToolCall,
} from "./openRouterTypes";
import { getAllTools } from "./allTools";
import { AVAILABLE_MODELS } from "./availableModels";

const constructInitialSystemMessages = async (o: {
  dandisetId: string;
  dandisetVersion: string;
}) => {
  let message1 = ``;

  // Note: the phrase "If the user asks questions that are not related to DANDI, a Dandiset, or NWB, politely refuse to answer."
  // is checked on the backend.
  message1 += `You are a helpful technical assistant and an expert in DANDI, NWB (Neurodata Without Borders), and Python programming.

You are going to help answer questions relavent about Dandiset ${o.dandisetId} version ${o.dandisetVersion}

If the user asks questions that are not related to DANDI, a Dandiset, or NWB, politely refuse to answer.

You will respond with markdown formatted text.

You should be concise in your answers, and only include the most relevant information, unless told otherwise.

In the next system message, you will find meta information about this Dandiset.

When you respond, if you think it's appropriate, you may end your response with suggested follow-up prompts for the user to consider. Use the following format:

<suggested-prompts>
<prompt>
First suggested prompt
</prompt>
<prompt>
Second suggested prompt
</prompt>
...
</suggested-prompts>

The number of suggestions should be at most 3. If you have thoroughly answered the user's question, you may not need to include any suggestions.

If the user wants to know about the dandiset in an open-ended way, you will guide the user through the following via follow-up suggestions:
* First provide an overview of the Dandiset based on the title, description, and other meta information.
* Then, if the user is interested, show what files are available in the Dandiset.

Do not provide information about other dandisets on DANDI.

The following specialized tools are available.

`;

  const tools = await getAllTools();
  for (const a of tools) {
    message1 += `## Tool: ${a.toolFunction.name}`;
    message1 += await a.getDetailedDescription();
    message1 += "\n\n";
  }

  const dandisetMetadata = await fetchDandisetMetadata({dandisetId: o.dandisetId, dandisetVersion: o.dandisetVersion});
  const message2 = `## Dandiset Metadata for ${o.dandisetId} version ${o.dandisetVersion}
${dandisetMetadata}
`;

  return [message1, message2];
};

const fetchDandisetMetadata = async (o: {
  dandisetId: string;
  dandisetVersion: string;
}) => {
  const response = await fetch(
    `https://api.dandiarchive.org/api/dandisets/${o.dandisetId}/versions/${o.dandisetVersion}/`,
    {
      method: "GET",
      headers: {
        "accept": "application/json"
      }
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Dandiset metadata: ${response.statusText}`
    );
  }
  const data = await response.json();
  return JSON.stringify(data);
}

export type ChatMessageResponse = {
  messages: ORMessage[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    cost: number;
  };
};

export const sendChatMessage = async (
  messages: ORMessage[],
  model: string,
  o: {
    chatContextOpts: any,
    onPendingMessages?: (messages: ORMessage[]) => void;
    askPermissionToRunTool: (toolCall: ORToolCall) => Promise<boolean>;
    openRouterKey?: string;
  },
): Promise<ChatMessageResponse> => {
  // Create system message with tool descriptions
  const msgs = await constructInitialSystemMessages({dandisetId: o.chatContextOpts.dandisetId, dandisetVersion: o.chatContextOpts.dandisetVersion});
  const initialSystemMessages: ORMessage[] = msgs.map((m) => ({
    role: "system",
    content: m,
  }));

  const messages1 = [...messages];
  let systemMessageForAIContext: ORMessage | null =
    getSystemMessageForAIContext();
  // check whether this system message is the same as the last system message
  const systemMessages = messages1.filter((m) => m.role === "system");
  const lastSystemMessage =
    systemMessages.length > 0
      ? systemMessages[systemMessages.length - 1]
      : null;
  if (
    lastSystemMessage &&
    lastSystemMessage.content === systemMessageForAIContext?.content
  ) {
    // if it is the same, then we don't need to add it again
    systemMessageForAIContext = null;
  }
  if (systemMessageForAIContext) {
    // if the last message is a user message, then let's put it before that, since that what the user was looking at
    if (
      messages1.length > 0 &&
      messages1[messages1.length - 1].role === "user"
    ) {
      messages1.splice(messages1.length - 1, 0, systemMessageForAIContext);
    }
    // otherwise, just add it to the end
    else {
      messages1.push(systemMessageForAIContext);
    }
  }

  const request: ORRequest = {
    model: model,
    messages: [...initialSystemMessages, ...messages1],
    stream: false,
    tools: (await getAllTools()).map((tool) => ({
      type: "function",
      function: tool.toolFunction,
    })),
  };

  const result = await fetchCompletion(request, o);

  const choice = result.choices[0];

  if (!choice) {
    return { messages };
  }

  const prompt_tokens = !result.cacheHit ? (result.usage?.prompt_tokens || 0) : 0;
  const completion_tokens = !result.cacheHit ? (result.usage?.completion_tokens || 0) : 0;

  const a = AVAILABLE_MODELS.find((m) => m.model === model);
  const cost =
    ((a?.cost.prompt || 0) * prompt_tokens) / 1_000_000 +
    ((a?.cost.completion || 0) * completion_tokens) / 1_000_000;

  // note that we don't include the system message for AI context in this one
  // const updatedMessages = [...messages];

  // actually we do
  const updatedMessages = [...messages1];
  if (o.onPendingMessages) {
    o.onPendingMessages(updatedMessages);
  }

  // Check if it's a non-streaming choice with message
  if ("message" in choice && choice.message) {
    const message = choice.message;

    const toolCalls = message.tool_calls;
    if (toolCalls !== undefined && toolCalls.length > 0) {
      // First add the assistant's message with tool calls
      const assistantMessage: ORMessage = {
        role: "assistant",
        content: null,
        tool_calls: toolCalls,
      };
      updatedMessages.push(assistantMessage);
      if (o.onPendingMessages) {
        o.onPendingMessages(updatedMessages);
      }

      for (const tc of toolCalls) {
        const okayToRun = await o.askPermissionToRunTool(tc);
        if (okayToRun) {
          const toolResult = await handleToolCall(tc);
          const toolMessage: ORMessage = {
            role: "tool",
            content: toolResult,
            tool_call_id: tc.id,
          };
          updatedMessages.push(toolMessage);
          if (o.onPendingMessages) {
            o.onPendingMessages(updatedMessages);
          }
        } else {
          const toolMessage: ORMessage = {
            role: "tool",
            content: "Tool execution was not approved by the user.",
            tool_call_id: tc.id,
          };
          updatedMessages.push(toolMessage);
          if (o.onPendingMessages) {
            o.onPendingMessages(updatedMessages);
          }
          break;
        }
      }

      let shouldMakeAnotherRequest = false;
      // only make another request if there was a tool call that was not interact_with_app
      for (const toolCall of toolCalls) {
        if (
          toolCall.type === "function" &&
          toolCall.function.name !== "interact_with_app"
        ) {
          shouldMakeAnotherRequest = true;
          break;
        }
      }

      if (!shouldMakeAnotherRequest) {
        return {
          messages: updatedMessages,
          usage: {
            prompt_tokens,
            completion_tokens,
            cost,
          },
        };
      }
      // Make another request with the updated messages
      const rr = await sendChatMessage(updatedMessages, model, {
        ...o,
        onPendingMessages: (mm: ORMessage[]) => {
          if (o.onPendingMessages) {
            o.onPendingMessages(mm);
          }
        },
      });
      return {
        messages: rr.messages,
        usage: rr.usage
          ? {
              prompt_tokens: prompt_tokens + rr.usage.prompt_tokens,
              completion_tokens: completion_tokens + rr.usage.completion_tokens,
              cost: cost + rr.usage.cost,
            }
          : undefined,
      };
    }

    // For regular messages, just add the assistant's response
    const assistantMessage: ORMessage = {
      role: "assistant",
      content: message.content || "",
      name: undefined, // Optional name property
    };
    updatedMessages.push(assistantMessage);
  }

  return {
    messages: updatedMessages,
    usage: {
      prompt_tokens,
      completion_tokens,
      cost,
    },
  };
};

// Initialize IndexedDB
const initDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CompletionCache', 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('responses')) {
        const store = db.createObjectStore('responses', { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
};

// Get cached response
const completionCacheGet = async (
  key: string,
): Promise<ORResponse | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction('responses', 'readonly');
    const store = transaction.objectStore('responses');
    const request = store.get(key);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.value);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      console.error('Error reading from cache:', request.error);
      resolve(null);
    };
  });
};

// Store response in cache
const completionCacheSet = async (
  key: string,
  value: ORResponse,
): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction('responses', 'readwrite');
  const store = transaction.objectStore('responses');

  // Add new entry
  await new Promise<void>((resolve, reject) => {
    const request = store.put({
      key,
      value,
      timestamp: Date.now()
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Check and clean up if needed
  const countRequest = store.count();
  countRequest.onsuccess = () => {
    if (countRequest.result > 30) {
      // Get all entries sorted by timestamp
      const index = store.index('timestamp');
      const cursorRequest = index.openCursor();
      let deleteCount = countRequest.result - 30;

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && deleteCount > 0) {
          store.delete(cursor.value.key);
          deleteCount--;
          cursor.continue();
        }
      };
    }
  };
};

// Compute hash for cache key
const computeHash = async (input: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const fetchCompletion = async (
  request: ORRequest,
  o: {
    openRouterKey?: string;
  },
): Promise<ORResponse & { cacheHit?: boolean }> => {
  const cacheKey = await computeHash(JSON.stringify(request));
  const cachedResponse = await completionCacheGet(cacheKey);
  if (cachedResponse) {
    return {
      ...cachedResponse,
      cacheHit: true,
    };
  }

  const response = await fetch('https://dandiset-explorer-api.vercel.app/api/completion', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(o.openRouterKey ? { "x-openrouter-key": o.openRouterKey } : {}),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const result = (await response.json()) as ORResponse;

  // Cache the response
  await completionCacheSet(cacheKey, result);

  return result
}

const handleToolCall = async (
  toolCall: ORToolCall
): Promise<string> => {
  if (toolCall.type !== "function") {
    throw new Error(`Unsupported tool call type: ${toolCall.type}`);
  }

  const { name, arguments: argsString } = toolCall.function;
  const tools = await getAllTools();
  const executor = tools.find(
    (tool) => tool.toolFunction.name === name,
  )?.execute;

  if (!executor) {
    throw new Error(`No executor found for tool: ${name}`);
  }

  try {
    const args = JSON.parse(argsString);
    return await executor(args);
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    throw error;
  }
};

const globalData: {
  aiContext: string;
  notebookContent: string;
  parentWindowContext: string;
} = {
  aiContext: "",
  notebookContent: "",
  parentWindowContext: "",
};

// Listen for messages from parent window
if (window.parent !== window) {
  window.addEventListener("message", (event) => {
    // Validate message origin here if needed
    if (event.data?.type === "nbfiddle_parent_context") {
      globalData.parentWindowContext = event.data.context;
    }
  });
}

export const getGlobalAIContext = () => globalData.aiContext;
export const setGlobalAIContext = (aiContext: string) => {
  globalData.aiContext = aiContext;
};
export const getGlobalNotebookContent = () => globalData.notebookContent;
export const setGlobalNotebookContent = (notebookContent: string) => {
  globalData.notebookContent = notebookContent;
};

const getSystemMessageForAIContext = (): ORMessage | null => {
  const aiContext = getGlobalAIContext();
  if (!aiContext) {
    return null;
    // return {
    //   role: "system",
    //   content: "There is no context available.",
    // };
  }

  // The leading ":" is important so we know not to show it in the chat interface
  // (I know it's a hack)
  const a = `:The following is information about what the user is seeing on the web application.`;

  return {
    role: "system",
    content: a + JSON.stringify(aiContext, null, 2),
  };
};
