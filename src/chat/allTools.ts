/* eslint-disable @typescript-eslint/no-explicit-any */
// import * as retrievePynwbDocs from "./tools/retrievePynwbDocs";
import * as getDandisetAssets from "./tools/getDandisetAssets";
import * as getNwbFileInfo from "./tools/getNwbFileInfo";

import { ORFunctionDescription } from "./openRouterTypes";
import { JupyterConnectivityState } from "../jupyter/JupyterConnectivity";

export interface ToolExecutionContext {
  jupyterConnectivity: JupyterConnectivityState
}

interface NCTool {
  toolFunction: ORFunctionDescription;
  execute: (params: any, o: ToolExecutionContext) => Promise<string>;
  getDetailedDescription: () => Promise<string>;
  requiresPermission: boolean;
}

const staticTools: NCTool[] = [getDandisetAssets, getNwbFileInfo];

export const getAllTools = async () => {
  return [...staticTools] as const;
};

// For backward compatibility with existing imports
export default staticTools;
