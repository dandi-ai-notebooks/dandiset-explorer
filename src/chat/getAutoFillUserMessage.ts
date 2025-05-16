/* eslint-disable @typescript-eslint/no-explicit-any */
import { AVAILABLE_MODELS } from "./availableModels";
import { parseSuggestedPrompts } from "./ChatInterface";
import { ORMessage, ORRequest } from "./openRouterTypes";
import { fetchCompletion } from "./sendChatMessage";

const getAutoFillUserMessage = async (
  messages: ORMessage[],
  o: {
    model: string;
    openRouterApiKey?: string;
    chatContextOpts: any
  }
) => {
  const systemMessage: ORMessage = {
    role: "system",
    content: getSystemMessage({
        dandisetId: o.chatContextOpts.dandisetId,
        dandisetVersion: o.chatContextOpts.dandisetVersion,
    }),
  } as ORMessage;
  const userMessage = {
    role: "user",
    content: "Now please respond with what the user should say next",
  } as ORMessage;
  let allMessages = [systemMessage, ...messages, userMessage];

  // important: in order to simulate what info a human would see;
  // we are going to remove all the tool messages, except for when the name is "execute_python_code"
  // remove all the assistant messages that have no content (e.g, tool calls)
  allMessages = allMessages.filter((m) => {
    if (m.role === "tool") {
      if (m.name !== "execute_python_code") {
        return false;
      }
    } else if (m.role === "assistant") {
      if (!m.content) {
        return false;
      }
    }
    return true;
  });

  // we don't want to provide the suggestions
  allMessages = allMessages.map((m) => {
    if (typeof m.content === "string") {
      const { newContent } = parseSuggestedPrompts(m.content);
      return {
        ...m,
        content: newContent,
      };
    } else {
      return m;
    }
  });

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

  const ind1 = message.content.indexOf("<prompt>");
  const ind2 = message.content.indexOf("</prompt>");
  if (ind1 === -1 || ind2 === -1) {
    return {
      userMessage: "Problem with auto fill (cannot parse prompt)",
      prompt_tokens,
      completion_tokens,
      cost,
    };
  }

  return {
    userMessage: message.content
      .substring(ind1 + "<prompt>".length, ind2)
      .trim(),
    prompt_tokens,
    completion_tokens,
    cost,
  };
};

const getSystemMessage = (o: {
    dandisetId: string;
    dandisetVersion: string;
}) => `
You are a scientist who is trying to understand Dandiset ${o.dandisetId} version ${o.dandisetVersion} from the DANDI archive.

You are interacting with an AI assistant. You are the user. The assistant is the other AI who is helping you.

Your goal is to learn about the dandiset and how to load and visualize data from it.

You should respond with a prompt that the user should say next in order to accomplish this goal in the following format

<prompt>
...
</prompt>

IMPORTANT: Only respond in this format. No other text should be included.

The first prompt should be "Tell me about this dandiset".

Then you'll want to follow up with questions if things are unclear.

You'll want to learn what files are in the dandiset.

You'll also want to learn how to load the data from an NWB file (start with one).

For the NWB file you'll want to learn about what types of data are in the file.

You'll want to be able to load and plot the data.

If there are errors with the code execution you'll want to follow up about that.

If there are issues with the visualizations, you'll want to follow up about that as well.

Overall, you need to be able to understand the Dandiset and how to get started analyzing the data.

If the assistant is providing code but not actually executing it, then you can request that it execute the code.

Your prompts should be relatively short.
You are not the one trying to debug things, you are the one trying to learn about the data and the assistant will debug and troubleshoot.
As the user, your job is to point out problems and seek to learn.
You should not be providing blocks of code.

Stick to what is available in the Dandiset. You don't have access to the internet or any other resources.

If you understand well enough one NWB file you may want to move on to another one.

If you understand the Dandiset and its data well enough, then you can end the conversation by saying "Thank you, that is all I need to know".

The assistant is instructed: "If the user asks questions that are not related to DANDI, a Dandiset, or NWB, politely refuse to answer."
`;

// Note: the phrase "If the user asks questions that are not related to DANDI, a Dandiset, or NWB, politely refuse to answer."
// is checked on the backend.

export default getAutoFillUserMessage;
