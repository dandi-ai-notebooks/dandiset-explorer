/* eslint-disable @typescript-eslint/no-explicit-any */
import { ORFunctionDescription } from "../openRouterTypes";

export const toolFunction: ORFunctionDescription = {
  name: "get_nwb_file_info",
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _o: any,
): Promise<string> => {
  const { dandisetId, dandisetVersion, assetId } = params;

  try {
    return `Not yet implemented: ${dandisetId}, ${dandisetVersion}, ${assetId}`;
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
`;
}

export const requiresPermission = false;
