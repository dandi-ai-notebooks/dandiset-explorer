/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ORMessage,
  ORNonStreamingChoice,
  ORRequest,
  ORResponse,
  ORToolCall,
} from "./openRouterTypes";
import { getAllTools } from "./allTools";
import { AVAILABLE_MODELS } from "./availableModels";
import { JupyterConnectivityState } from "../jupyter/JupyterConnectivity";

const constructInitialSystemMessages = async (o: {
  dandisetId: string;
  dandisetVersion: string;
  doSuggestedPrompts?: boolean;
}) => {
  const include1 = false;
  let message1 = ``;

  // Note: the phrase "asks questions that are not related to DANDI, a Dandiset, or NWB, politely refuse to answer"
  // is checked on the backend.
  message1 += `You are a helpful technical assistant and an expert in DANDI, NWB (Neurodata Without Borders), and Python programming.

You are going to help answer questions relavent about Dandiset ${o.dandisetId} version ${o.dandisetVersion}

If the user asks questions that are not related to DANDI, a Dandiset, or NWB, politely refuse to answer and include the following annotation at the end of your response:
<irrelevant>

You will respond with markdown formatted text.

You should be concise in your answers, and only include the most relevant information, unless told otherwise.

In the next system message, you will find meta information about this Dandiset.

You have the ability to execute Python code using the execute_python_code tool (see below).

${
  include1 ? `
To get a list of assets/files for the dandiset, the most straightforward way is to use the get_dandiset_assets tool (see below). However,
if the user is interested in how to do this from Python, you can also provide them with a code snippet (or execute it if you wish) using the following method:
` : ""
}


To get a list of assets/files for the dandiset use the execute_python_code tool and use the dandi Python API. Here's an example:

\`\`\`python
from dandi.dandiapi import DandiAPIClient

client = DandiAPIClient()
dandiset = client.get_dandiset("${o.dandisetId}", "${o.dandisetVersion}")

# List some assets in the Dandiset
assets = dandiset.get_assets_by_glob("*.nwb")
print("\nFirst 10 assets:")
for asset in islice(assets, 10):
    print(f"- {asset.path}")
\`\`\`

We'll only be interested in .nwb files.

Some dandisets may have a very large number of files, so it is good practice to limit the number of files you are loading. If there are not too many files, you can use list(dandiset.get_assets()). Otherwise, respect the iterator, and make use of get_assets_by_glob as described below.

For the asset object you can get the size of the file in bytes via \`asset.size\`.

You can also search for assets by glob, which can be useful if you are looking for specific files. Here's an example:
\`\`\`python
assets = dandiset.get_assets_by_glob("sub-*/ses-*/**/*.nwb")
\`\`\`

To load a remote NWB file using pynwb, you can use the following code:

\`\`\`python
import h5py
import pynwb
import remfile

path = "... the asset path ..."
asset = next(dandiset.get_assets_by_glob(path))

remote_file = remfile.File(asset.download_url)
h5_file = h5py.File(remote_file)
io = pynwb.NWBHDF5IO(file=h5_file)
nwb = io.read()
\`\`\`

However, before you do that, it's important that you first use the get_nwbfile_info tool (described below) in order to understand the contents of the NWB file and learn how to load it. The output of get_nwbfile_info will contain a usage script. That script is not meant to be shown to the user, but is meant to guide you in knowing how to construct scripts and know what data are available.

IMPORTANT: Do not attempt to load data from the NWB file until after you have gotten the usage info using the get_nwbfile_info tool.

Do not use the get_nwbfile_info tool until you find out the paths of files in the Dandiset using the dandi api as above.

It's important to get the dandiset assets as shown above so you know what asset path to use when loading the NWB file.

If the user asks to load or download a file, you should use the above method.
You should not just give them the URL because the file will usually be too large to conveniently download.
Be sure to use the get_nwbfile_info tool to get the usage script for the file before you provide the script to load it.

# Neurosift

The first time you refer to an .nwb asset, you should always provide a neurosift link to allow the user to browse the contents of an NWB file and visualize neurodata items, you can do so as follows:
[path/to/file.nwb](https://neurosift.app/nwb?dandisetId=${o.dandisetId}&dandisetVersion=${o.dandisetVersion}&path=path/to/file.nwb)

where path/to/file.nwb is the path to the file in the Dandiset. You should choose the name of the link appropriately.

# Execution of code

Sometimes it is appropriate to provide example scripts for the user to read,
and at other times it is appropriate to execute code to generate text output and plot images.
In general you should choose to execute code whenever it seems like that could work in the situation.

If you would like to execute code, use the execute_python_code tool.

IMPORTANT: When providing code to execute make sure that the script is fully self-contained. You can not pick up where you left off with previous code execution. Each time you execute code, it uses a new kernel.

If the user says something like "execute such and such" or "run such and such" or "plot such and such" etc, they mean that they want you make a tool call to execute_python_code.

After code is executed and the tool returns, you should respond to the output as appropriate in the context of the conversation.
If there are notable issues you should mention them and/or try to correct the problems with additional tool calls.

You should not repeat the code that you executed in your response since the user will be able to see the content of the tool call.
However, for other tool calls, you should assume that the content of the tool call is NOT visible to the user.

When you refer to images that were generated, you should refer to them as "the image above" or "the plot above" or "the figure above".

When you use the execute_python_code tool, the user can see the code, so there is no need to repeat it in your response.
`;

  if (o.doSuggestedPrompts) {
    message1 += `
# Suggested follow-up prompts

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

Frame the prompts from the perspective of the user, such as "Tell me more about ..."

If the user wants to know about the dandiset in an open-ended way, you will guide the user through the following via follow-up suggestions:
* First provide an overview of the Dandiset based on the title, description, and other meta information.
* Then suggest "Show some of files in this Dandiset"
* Then suggest "Show how to load one of these files in Python"
`;
  }

  message1 += `

# Notes

If the user wants to load an NWB file, you should first use the get_nwbfile_info tool to get the usage script for the file. You should not provide this usage script to the user - this is meant for you to understand how to load it. Then you can choose how to communicate the information to the user as relevant.

Do not make the same tool call more than once. For example, if you call get_nwbfile_info, you should not call it again for the same chat. You already have that information.

When you are setting the figsize in matplotlib, as a rule of thumb, use a width of 10.

Do not provide information about other dandisets on DANDI.

While you should generally stick to responding to requests about the Dandiset, if the user wants to test out plotting or something simple, you may oblige.

Note that it doesn't work to try to index an h5py.Dataset with a numpy array of indices.

Note that you cannot do operations like np.sum over a h5py.Dataset. You need to get a numpy array using something like dataset[:]

If you are going to load a subset of data, it doesn't make sense to load all of the timestamps in memory and then select a subset. Instead, you should load the timestamps for the subset of data you are interested in. So we shouldn't ever see something like \`dataset.timestamps[:]\` unless we intend to load all the timestamps.

When loading data for illustration, be careful about the size of the data, since the files are hosted remotely and datasets are streamed over the network. You may want to load subsets of data. But if you do, please be sure to indicate that you are doing so, so the reader doesn't get the wrong impression about the data.

When showing unit IDs or channel IDs, be sure to use the actual IDs rather than just the indices.

The correct way to load spike times for a unit (for example first unit) is nwb.units.spike_times_index[0]. nwb.units.spike_times_index[i] is the vector of spike times. It is not actually an index. You should not use nwb.units.spike_times.

\`plt.style.use('seaborn')\` is deprecated. If you want to use seaborn styling, use:
\`\`\`
import seaborn as sns
sns.set_theme()
\`\`\`

Do not use seaborn styling for plotting images.

Don't forget to import numpy in your scripts.

Image masks values range from 0 to 1. If you are plotting all image masks superimposed on each other in a single figure, use a heatmap with np.max on the image masks.

For raw extracellular electrophysiology data, you shouldn't try to do spike detection, spike sorting, or anything like that in the notebook because it's too computationally intensive. Getting anything useful from extracullular electrophysiology data requires a lot of processing and is not something that can be done in a notebook. Instead, you should focus on showing how to load a reasonable amount of data and how to visualize it.

The following specialized tools are available.

`;

  const tools = await getAllTools();
  for (const a of tools) {
    message1 += `## Tool: ${a.toolFunction.name}\n`;
    message1 += await a.getDetailedDescription() + "\n";
    message1 += "\n";
  }

  const dandisetMetadata = await fetchDandisetMetadata({
    dandisetId: o.dandisetId,
    dandisetVersion: o.dandisetVersion,
  });
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
        accept: "application/json",
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Dandiset metadata: ${response.statusText}`
    );
  }
  const data = await response.json();
  return JSON.stringify(data);
};

export type ChatMessageResponse = {
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
    jupyterConnectivity: JupyterConnectivityState;
    dandisetId: string;
    dandisetVersion: string;
    onUpdate: (pendingMessages: ORMessage[], newMessages: ORMessage[]) => void;
    askPermissionToRunTool: (toolCall: ORToolCall) => Promise<boolean>;
    setToolCallForCancel: (toolCall: ORToolCall | "completion" | undefined, onCancel: (() => void) | undefined) => void;
    openRouterKey?: string;
  }
): Promise<ChatMessageResponse> => {
  // Create system message with tool descriptions
  const msgs = await constructInitialSystemMessages({
    dandisetId: o.dandisetId,
    dandisetVersion: o.dandisetVersion,
  });
  const initialSystemMessages: ORMessage[] = msgs.map((m) => ({
    role: "system",
    content: m,
  }));

  const messages1 = [...messages];

  const request: ORRequest = {
    model: model,
    messages: [...initialSystemMessages, ...messages],
    stream: false,
    tools: (await getAllTools()).map((tool) => ({
      type: "function",
      function: tool.toolFunction,
    })),
  };

  let result;
  const controller = new AbortController();
  o.setToolCallForCancel("completion", () => {
    controller.abort();
  });
  try {
    result = await fetchCompletion(request, {
      openRouterKey: o.openRouterKey,
      signal: controller.signal,
    });
    o.setToolCallForCancel(undefined, undefined);
  }
  catch (e) {
    o.onUpdate(messages1, [
      {
        role: "system",
        content: `Error in call to OpenRouter API: ${e}`,
      },
    ]);
    o.setToolCallForCancel(undefined, undefined);
    return {};
  }

  const choice = result.choices[0];

  if (!choice) {
    const msg: ORMessage = {
      role: "system",
      content: "Error in call to OpenRouter API. No choices returned.",
    }
    messages1.push(msg);
    o.onUpdate(messages1, [msg]);
    return {};
  }

  const prompt_tokens = !result.cacheHit ? result.usage?.prompt_tokens || 0 : 0;
  const completion_tokens = !result.cacheHit
    ? result.usage?.completion_tokens || 0
    : 0;

  const a = AVAILABLE_MODELS.find((m) => m.model === model);
  const cost =
    ((a?.cost.prompt || 0) * prompt_tokens) / 1_000_000 +
    ((a?.cost.completion || 0) * completion_tokens) / 1_000_000;

  // note that we don't include the system message for AI context in this one
  // const updatedMessages = [...messages];

  // actually we do
  let updatedMessages = [...messages1];
  const newMessages: ORMessage[] = [];
  o.onUpdate(updatedMessages, newMessages);

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
      newMessages.push(assistantMessage);
      o.onUpdate(updatedMessages, newMessages);

      const tools = await getAllTools();
      let canceled = false;
      for (const tc of toolCalls) {
        if (canceled) {
          break;
        }
        const tool = tools.find(
          (tool) => tool.toolFunction.name === tc.function.name
        );
        o.setToolCallForCancel(undefined, undefined);
        if (!tool) {
          console.error(`Tool ${tc.function.name} not found`);
          continue;
        }
        const okayToRun = await o.askPermissionToRunTool(tc);
        if (okayToRun) {
          const onCancelRef: {
            onCancel?: () => void
          } = {
            onCancel: undefined
          };
          if (tool.isCancelable) {
            o.setToolCallForCancel(tc, () => {
              if (onCancelRef.onCancel) {
                canceled = true;
                onCancelRef.onCancel(); // communicates the cancel to the tool execution
              }
            });
          }
          const toolResult = await handleToolCall(tc, {
            jupyterConnectivity: o.jupyterConnectivity,
            // imageUrlsNeedToBeUser: model.startsWith("openai/") || model.startsWith("anthropic/"),
            imageUrlsNeedToBeUser: true,
            onCancelRef
          });
          const toolMessage: ORMessage = {
            role: "tool",
            content: toolResult.result,
            tool_call_id: tc.id,
          };
          updatedMessages.push(toolMessage);
          newMessages.push(toolMessage);
          if (toolResult.newMessages) {
            updatedMessages.push(...toolResult.newMessages);
            newMessages.push(...toolResult.newMessages);
          }
          o.onUpdate(updatedMessages, newMessages);
        } else {
          const toolMessage: ORMessage = {
            role: "tool",
            content: "Tool execution was not approved by the user.",
            tool_call_id: tc.id,
          };
          updatedMessages.push(toolMessage);
          newMessages.push(toolMessage);
          o.onUpdate(updatedMessages, newMessages);
          break;
        }
      }
      o.setToolCallForCancel(undefined, undefined);

      let shouldMakeAnotherRequest = false;
      // only make another request if not canceled and there was a tool call that was not interact_with_app
      if (!canceled) {
        for (const toolCall of toolCalls) {
          if (
            toolCall.type === "function" &&
            toolCall.function.name !== "interact_with_app"
          ) {
            shouldMakeAnotherRequest = true;
            break;
          }
        }
      }

      if (!shouldMakeAnotherRequest) {
        o.onUpdate(updatedMessages, newMessages);
        return {
          usage: {
            prompt_tokens,
            completion_tokens,
            cost,
          },
        };
      }
      // Make another request with the updated messages
      let newMessagesFromNextRequest: ORMessage[] = [];
      const rr = await sendChatMessage(updatedMessages, model, {
        ...o,
        onUpdate: (pendingMessages0: ORMessage[], newMessages0: ORMessage[]) => {
          newMessagesFromNextRequest = newMessages0;
          updatedMessages = pendingMessages0;
          o.onUpdate(pendingMessages0, [...newMessages, ...newMessages0]);
        }
      });
      o.onUpdate(updatedMessages, [...newMessages, ...newMessagesFromNextRequest]);
      return {
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
      content: message.content || "[NO CONTENT]",
      name: undefined, // Optional name property
    };
    updatedMessages.push(assistantMessage);
    newMessages.push(assistantMessage);
  }

  o.onUpdate(updatedMessages, newMessages);
  return {
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
    const request = indexedDB.open("CompletionCache", 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("responses")) {
        const store = db.createObjectStore("responses", { keyPath: "key" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
};

// Get cached response
const completionCacheGet = async (key: string): Promise<ORResponse | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction("responses", "readonly");
    const store = transaction.objectStore("responses");
    const request = store.get(key);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.value);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      console.error("Error reading from cache:", request.error);
      resolve(null);
    };
  });
};

// Store response in cache
const completionCacheSet = async (
  key: string,
  value: ORResponse
): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction("responses", "readwrite");
  const store = transaction.objectStore("responses");

  // Add new entry
  await new Promise<void>((resolve, reject) => {
    const request = store.put({
      key,
      value,
      timestamp: Date.now(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Check and clean up if needed
  const countRequest = store.count();
  countRequest.onsuccess = () => {
    if (countRequest.result > 300) {
      // Get all entries sorted by timestamp
      const index = store.index("timestamp");
      const cursorRequest = index.openCursor();
      let deleteCount = countRequest.result - 300;

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
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const fetchCompletion = async (
  request: ORRequest,
  o: {
    openRouterKey?: string;
    signal?: AbortSignal;
  }
): Promise<ORResponse & { cacheHit?: boolean }> => {
  const cacheKey = await computeHash(JSONStringifyDeterministic(request));
  const cachedResponse = await completionCacheGet(cacheKey);
  if (cachedResponse) {
    return {
      ...cachedResponse,
      cacheHit: true,
    };
  }

  let response;
  if (o.openRouterKey) {
    // directly hit the OpenRouter API
    const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
    response = await fetch(
      OPENROUTER_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${o.openRouterKey}`,
        },
        body: JSON.stringify(request),
        signal: o.signal,
      }
    );
  }
  else {
    response = await fetch(
      "https://dandiset-explorer-api.vercel.app/api/completion",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(o.openRouterKey ? { "x-openrouter-key": o.openRouterKey } : {}), // leave this as is in case we want to always route through the api
        },
        body: JSON.stringify(request),
        signal: o.signal,
      }
    );
  }

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const result = (await response.json()) as ORResponse;

  // important to do these checks prior to caching
  if (!result.choices) {
    console.warn(result);
    throw new Error("No choices in response");
  }
  if (result.choices.length === 0) {
    console.warn(result);
    throw new Error("No choices in response (length 0)");
  }

  // don't cache empty responses
  const choice = result.choices[0] as ORNonStreamingChoice;
  if (!choice.message.content && !choice.message.tool_calls) {
    console.warn(choice);
    console.warn("Got empty response");
  }
  else {
    // Cache the response if not empty
    await completionCacheSet(cacheKey, result);
  }

  return result;
};

const handleToolCall = async (
  toolCall: ORToolCall,
  o: {
    jupyterConnectivity: JupyterConnectivityState;
    imageUrlsNeedToBeUser: boolean;
    onCancelRef: {
      onCancel?: () => void;
    }
  }
): Promise<{
  result: string;
  newMessages?: ORMessage[];
}> => {
  if (toolCall.type !== "function") {
    throw new Error(`Unsupported tool call type: ${toolCall.type}`);
  }

  const { name, arguments: argsString } = toolCall.function;
  const tools = await getAllTools();
  const executor = tools.find(
    (tool) => tool.toolFunction.name === name
  )?.execute;

  if (!executor) {
    throw new Error(`No executor found for tool: ${name}`);
  }

  try {
    const args = JSON.parse(argsString);
    return await executor(args, {
      jupyterConnectivity: o.jupyterConnectivity,
      imageUrlsNeedToBeUser: o.imageUrlsNeedToBeUser,
      onCancelRef: o.onCancelRef
    });
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

function JSONStringifyDeterministic(value: any): string {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      // Arrays keep their natural order
      return '[' + value.map(JSONStringifyDeterministic).join(',') + ']';
    }
    // Objects → keys sorted lexicographically
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k =>
      JSON.stringify(k) + ':' + JSONStringifyDeterministic(value[k])
    ).join(',') + '}';
  }
  // Primitives & null
  return JSON.stringify(value);
}