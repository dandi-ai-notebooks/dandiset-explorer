import PythonSessionClient from "../../jupyter/PythonSessionClient";
import { ToolExecutionContext } from "../allTools";
import { ORFunctionDescription } from "../openRouterTypes";

export const toolFunction: ORFunctionDescription = {
  name: "get_nwbfile_info",
  description: "Retrieve information about a specific NWB file, including how to load it using Python.",
  parameters: {
    type: "object",
    properties: {
      dandisetId: {
        type: "string",
        description: "The ID of the dandiset that contains the NWB file.",
      },
      dandisetVersion: {
        type: "string",
        description: "The version of the dandiset that contains the NWB file.",
      },
      assetId: {
        type: "string",
        description: "The ID of the NWB file asset.",
      }
    },
    required: ["dandisetId", "dandisetVersion", "assetId"],
  },
};

type GetNwbFileInfoParams = {
  dandisetId: string;
  dandisetVersion: string;
  assetId: string
};

export const execute = async (
  params: GetNwbFileInfoParams,
  o: ToolExecutionContext,
): Promise<string> => {
  const { assetId } = params;

  try {
    if (!o.jupyterConnectivity.jupyterServerIsAvailable) {
      throw new Error(
        "Jupyter server is not available. Please configure a Jupyter server to use this tool."
      );
    }
    const assetUrl = `https://api.dandiarchive.org/api/assets/${assetId}/download/`
    const client = new PythonSessionClient(o.jupyterConnectivity);
    const outputLines: string[] = [];
    client.onOutputItem((item) => {
      if (
        item.type === "iopub" &&
        "name" in item.iopubMessage.content &&
        (item.iopubMessage.content.name === "stdout" ||
          item.iopubMessage.content.name === "stderr")
      ) {
        if ('text' in item.iopubMessage.content) {
          outputLines.push(item.iopubMessage.content.text as string);
        }
      }
    });

    await client.initiate();
    await client.runCode(`
try:
  from get_nwbfile_info import get_nwbfile_usage_script
except ImportError:
  print("get_nwbfile_info module not found. Please install it first.")
  raise


usage_script = get_nwbfile_usage_script("${assetUrl}")
print(usage_script)
`);
    await client.waitUntilIdle();
    await client.shutdown();

    return outputLines.join("\n");
  } catch (error) {
    return JSON.stringify(
      { error: error instanceof Error ? error.message : "Unknown error" },
      null,
      2
    );
  }
};

export const getDetailedDescription = async () => {
  return `Retrieve information about an NWB file in a dandiset.

Includes information about what data is in the file, how to load it using Python, and any other relevant details.

If you get a message like "get_nwbfile_info module not found. Please install it first.",
you need to tell the user that they need to install the get-nwbfile-info package from source using
"pip install git+https://github.com/rly/get-nwbfile-info". In this case, don't make up usage information.
`;
}

export const requiresPermission = false;
