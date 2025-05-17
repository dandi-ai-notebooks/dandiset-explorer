/* eslint-disable @typescript-eslint/no-explicit-any */
import { AVAILABLE_MODELS } from "./availableModels";
import { ORMessage, ORRequest, ORToolCall } from "./openRouterTypes";
import { fetchCompletion } from "./sendChatMessage";

const getAutoFillUserMessage = async (
  messages: ORMessage[],
  o: {
    model: string;
    openRouterApiKey?: string;
    chatContextOpts: any;
  }
) => {
  const systemMessage: ORMessage = {
    role: "system",
    content: getSystemMessage({
      dandisetId: o.chatContextOpts.dandisetId,
      dandisetVersion: o.chatContextOpts.dandisetVersion,
    }),
  } as ORMessage;
  let allMessages = [systemMessage, ...messages];

  // important: in order to simulate what info a human would see;
  // we are going to remove all the tool messages, except for when the name is "execute_python_code"
  // remove all the assistant messages that have no content (e.g, tool calls) except for when the name of the tool is "execute_python_code"
  allMessages = allMessages.filter((m) => {
    if (m.role === "tool") {
      // get the tool call corresponding to this tool
      let toolCall: ORToolCall | undefined = undefined;
      for (const msg of messages) {
        if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls) {
          const x = msg.tool_calls.find((tc) => tc.id === m.tool_call_id);
          if (x) {
            toolCall = x;
            break;
          }
        }
      }
      if (toolCall && toolCall.function.name === "execute_python_code") {
        return true;
      }
      return false;
    } else if (m.role === "assistant") {
      if (!m.content && "tool_calls" in m) {
        if (m.tool_calls[0].function.name !== "execute_python_code") {
          return false;
        }
      }
    }
    return true;
  });

  // Before we swap user/assistant messages, we need to move tool calls to content.
  // This is important, because user messages should not have tool calls.
  // But we want to show the code that gets executed.
  allMessages = allMessages.map((m) => {
    if (m.role === "assistant") {
      if ("tool_calls" in m) {
        const contentSections: string[] = [];
        for (const tool_call of m.tool_calls) {
          if (tool_call.function.name === "execute_python_code") {
            const args = JSON.parse(tool_call.function.arguments);
            contentSections.push(`${args.code}`);
          } else {
            contentSections.push(`Tool call: ${tool_call.function.name}`);
          }
        }
        return {
          role: "assistant",
          content: contentSections.join("\n\n"),
        } as ORMessage;
      }
    }
    return m;
  });

  // We also need to move tool messages to assistant messages.
  allMessages = allMessages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "assistant",
        content: m.content,
      };
    }
    return m;
  });

  // map assistant to user and user to assistant
  allMessages = allMessages.map((m) => {
    if (m.role === "assistant") {
      return {
        ...m,
        role: "user",
      } as ORMessage;
    } else if (m.role === "user") {
      return {
        ...m,
        role: "assistant",
      } as ORMessage;
    } else {
      return m;
    }
  });

  // unfortunately, some models only allow image urls in user messages
  if (o.model.startsWith("openai/")) {
    allMessages = allMessages.map((m) => {
      if (m.role === "assistant" && m.content) {
        let hasImageUrl = false;
        if (typeof m.content === "string") {
          hasImageUrl = false;
        } else {
          for (const part of m.content) {
            if (part.type === "image_url") {
              hasImageUrl = true;
              break;
            }
          }
        }
        if (hasImageUrl) {
          return {
            ...m,
            role: "user",
          } as ORMessage;
        }
      }
      return m;
    });
  }

  console.info(allMessages);

  const request: ORRequest = {
    model: o.model,
    messages: allMessages,
    stream: false,
  };

  const result = await fetchCompletion(request, {
    openRouterKey: o.openRouterApiKey,
  });
  if (!result.choices) {
    return {
      userMessage: "Problem with auto fill (no choices)",
      prompt_tokens: 0,
      completion_tokens: 0,
      cost: 0,
    };
  }

  const choice = result.choices[0];

  if (!choice) {
    return {
      userMessage: "Problem with auto fill",
      prompt_tokens: 0,
      completion_tokens: 0,
      cost: 0,
    };
  }

  if (!("message" in choice)) {
    return {
      userMessage: "Problem with auto fill (no message)",
      prompt_tokens: 0,
      completion_tokens: 0,
      cost: 0,
    };
  }

  const prompt_tokens = !result.cacheHit ? result.usage?.prompt_tokens || 0 : 0;
  const completion_tokens = !result.cacheHit
    ? result.usage?.completion_tokens || 0
    : 0;

  const a = AVAILABLE_MODELS.find((m) => m.model === o.model);
  const cost =
    ((a?.cost.prompt || 0) * prompt_tokens) / 1_000_000 +
    ((a?.cost.completion || 0) * completion_tokens) / 1_000_000;

  const message = choice.message;

  if (!message.content) {
    return {
      userMessage: "Problem with auto fill (no content)",
      prompt_tokens,
      completion_tokens,
      cost,
    };
  }

  return {
    userMessage: message.content,
    prompt_tokens,
    completion_tokens,
    cost,
  };
};

const getSystemMessage = (o: {
  dandisetId: string;
  dandisetVersion: string;
}) => `
You are a scientist who is trying to understand Dandiset ${o.dandisetId} version ${o.dandisetVersion} from the DANDI archive. Your goal is to learn about the data inside, how to get started loading and visualizing the data in Python, and learn how you can begin to analyze the data.

You are interacting with a user who is an expert about the Dandiset.

You should prompt the user for information about the dandiset and how to load the data.

The first prompt should be "Tell me about this dandiset.".

Each time the user responds, you should evaluate whether their response sufficiently answers your question. You should pay careful attention to any plots that were provided to determine if there are any problems or mistakes. Then either ask for clarification or correction, or move on to the next question. Do not get stuck on one question for too long. In your response, before asking the next question, it would be helpful to summarize any plots that were provided so that you can make it clear that you are interpreting the data correctly.

Once you feel like you understand the Dandiset sufficiently, you should respond with "Thank you, that is all I need to know.".

Here's what you'll want to learn about specifically:

You'll want to learn what the Dandiset is about.

You'll want to learn what files are in the dandiset.

You'll want to learn how to load and visualize the data from an NWB file (start with one).

You should cover all the types of data in the NWB files, where possible and reasonable.

For the NWB file you'll want to learn about what types of data are in the file.

You'll want to be able to load and plot the data.

If there are errors with the code execution you'll want to follow up about that.

If there are issues with the visualizations, you'll want to follow up about that as well.

Stick to what is available in the Dandiset. The user does not have access to the internet or any other resources.

If you understand well enough one NWB file you may want to move on to another one.

The user is instructed: "If the assistant asks questions that are not related to DANDI, a Dandiset, or NWB, politely refuse to answer."

Be clear and concise in your prompts, not overly verbose. Be scientifically formal (no emojis, etc).

You can see things like "Load X from Y" or "Plot ..." or "Show how to ...".

It's important that the user provides actual Python code for loading and visualizing the data. If they provide pseudocode or a description of the code, ask them to provide actual code.

It's important that the user actually executes scripts and shows the resulting visualizations.

IMPORTANT: your role is to comment on the users response and to ask the questions. You do not provide any answers or assistance.
`;

// Note: the phrase "asks questions that are not related to DANDI, a Dandiset, or NWB, politely refuse to answer."
// is checked on the backend.

export default getAutoFillUserMessage;
