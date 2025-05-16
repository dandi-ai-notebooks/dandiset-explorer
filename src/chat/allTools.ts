/* eslint-disable @typescript-eslint/no-explicit-any */
import * as getDandisetAssets from "./tools/getDandisetAssets";
import * as getNwbFileInfo from "./tools/getNwbFileInfo";
import * as executePythonCode from "./tools/executePythonCode";

import { ORFunctionDescription, ORMessage } from "./openRouterTypes";
import { JupyterConnectivityState } from "../jupyter/JupyterConnectivity";

export interface ToolExecutionContext {
  jupyterConnectivity: JupyterConnectivityState
}

interface NCTool {
  toolFunction: ORFunctionDescription;
  execute: (params: any, o: ToolExecutionContext) => Promise<{
    result: string,
    newMessages?: ORMessage[]
  }>
  getDetailedDescription: () => Promise<string>;
  requiresPermission: boolean;
}

const staticTools: NCTool[] = [getDandisetAssets, getNwbFileInfo, executePythonCode];

export const getAllTools = async () => {
  return [...staticTools] as const;
};

// For backward compatibility with existing imports
export default staticTools;
