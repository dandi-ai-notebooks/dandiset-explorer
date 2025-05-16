import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  Radio,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { FunctionComponent, useEffect, useState, useCallback } from "react";
import ScrollY from "../components/ScrollY";
import { useJupyterConnectivity } from "./JupyterConnectivity";
import { testPythonSession, TestResult } from "./pythonSessionTester";
import { publicServers } from "./publicServers";
import {
  JupyterServer,
  JupyterServerConfig,
  builtInLocalServers,
  isJupyterServerConfig,
} from "./types";

type JupyterViewProps = {
  width?: number;
  height?: number;
};

const ServerStatusIndicator = ({ isAvailable }: { isAvailable: boolean }) => (
  <Box
    component="span"
    sx={{
      display: "inline-block",
      width: 10,
      height: 10,
      borderRadius: "50%",
      backgroundColor: isAvailable ? "success.main" : "error.main",
      marginRight: 1,
    }}
  />
);

const STORAGE_KEY = "jupyterServers";

const loadServerConfigFromLocalStorage = (): JupyterServerConfig => {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      const x = JSON.parse(stored);
      if (!isJupyterServerConfig(x)) {
        throw new Error("Invalid server config");
      }
      return x;
    } catch (e) {
      console.error("Failed to load server config from localStorage", e);
    }
  }

  return {
    selectedServerUrl: "",
    servers: builtInLocalServers,
  };
};

const loadServerConfig = (): JupyterServerConfig => {
  const config = loadServerConfigFromLocalStorage();

  // remember the tokens for built-in servers
  const tokensForBuiltInServers: {
    [url: string]: string;
  } = {};
  for (const server of config.servers) {
    if (server.isBuiltIn) {
      tokensForBuiltInServers[server.url] = server.token;
    }
  }

  // remove the built-in servers and add them back
  config.servers = config.servers.filter((s) => !s.isBuiltIn);
  config.servers.push(...builtInLocalServers);
  config.servers.push(
    ...publicServers.map((s) => ({
      url: s.url,
      name: s.name,
      isBuiltIn: true,
      token: tokensForBuiltInServers[s.url] || "",
    })),
  );

  return config;
};

const saveServerConfigToLocalStorage = (config: JupyterServerConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

const JupyterConfigurationView: FunctionComponent<JupyterViewProps> = ({
  width,
  height,
}) => {
  const connectivity = useJupyterConnectivity();
  const {
    jupyterServerUrl,
    jupyterServerIsAvailable,
    numActiveKernels,
    setJupyterServerUrl,
    setJupyterServerToken,
    refreshJupyter,
  } = connectivity;

  // Load server config from localStorage on mount
  const [serverConfig, setServerConfig] = useState<JupyterServerConfig | null>(
    null,
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | undefined>();

  const handleTest = useCallback(async () => {
    if (!serverConfig) return;

    setIsTesting(true);
    setTestResult(undefined);
    try {
      const result = await testPythonSession(connectivity);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsTesting(false);
    }
  }, [connectivity, serverConfig]);

  const [isAddServerDialogOpen, setIsAddServerDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] =
    useState(false);
  const [serverToDelete, setServerToDelete] = useState<string | null>(null);
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerName, setNewServerName] = useState("");

  useEffect(() => {
    const config = loadServerConfig();
    setServerConfig(config);
  }, []);
  useEffect(() => {
    if (serverConfig) {
      setJupyterServerUrl(serverConfig.selectedServerUrl);
      setJupyterServerToken(
        serverConfig.servers.find(
          (s) => s.url === serverConfig.selectedServerUrl,
        )?.token || "",
      );
    }
  }, [serverConfig, setJupyterServerUrl, setJupyterServerToken]);

  // Save server config to local storage when it changes
  useEffect(() => {
    if (!serverConfig) {
      return;
    }
    if (serverConfig.servers.length > 0) {
      // but only if it has been loaded
      saveServerConfigToLocalStorage(serverConfig);
    }
  }, [serverConfig]);

  useEffect(() => {
    setJupyterServerUrl(serverConfig?.selectedServerUrl || "");
    setJupyterServerToken(
      serverConfig?.servers.find(
        (s) => s.url === serverConfig.selectedServerUrl,
      )?.token || "",
    );
  }, [serverConfig, setJupyterServerUrl, setJupyterServerToken]);

  const handleServerSelect = useCallback((url: string) => {
    setServerConfig((prev) => {
      if (prev) {
        return {
          ...prev,
          selectedServerUrl: url,
        };
      }
      return prev;
    });
  }, []);

  const handleAddServer = useCallback(() => {
    if (newServerUrl) {
      const newServer: JupyterServer = {
        url: newServerUrl,
        name: newServerName,
        token: "",
        isBuiltIn: false,
      };
      setServerConfig((prev) => {
        if (prev) {
          return {
            ...prev,
            servers: [...prev.servers, newServer],
          };
        }
        return prev;
      });
      setNewServerUrl("");
      setNewServerName("");
      setIsAddServerDialogOpen(false);
    }
  }, [newServerUrl, newServerName]);

  const handleDeleteConfirm = useCallback(() => {
    if (serverToDelete) {
      setServerConfig((prev) => {
        if (prev) {
          return {
            ...prev,
            servers: prev.servers.filter((s) => s.url !== serverToDelete),
          };
        }
        return prev;
      });
    }
    setIsDeleteConfirmDialogOpen(false);
    setServerToDelete(null);
  }, [serverToDelete]);

  const handleRemoveServer = useCallback((url: string) => {
    setServerToDelete(url);
    setIsDeleteConfirmDialogOpen(true);
  }, []);

  const handleSetToken = useCallback(async (url: string) => {
    const token = prompt("Enter the token for this server");
    if (token === null) {
      return;
    }
    setServerConfig((prev) => {
      if (prev) {
        return {
          ...prev,
          servers: prev.servers.map((s) =>
            s.url === url ? { ...s, token } : s,
          ),
        };
      }
      return prev;
    });
  }, []);

  const originToAllow = window.location.origin;

  const currentServer = serverConfig?.servers.find(
    (s) => s.url === serverConfig.selectedServerUrl,
  );
  const servers = serverConfig?.servers || [];

  return (
    <ScrollY width={width || 600} height={height || 600}>
      <Box sx={{ p: 2 }}>
        {/* Status Section */}
        <Paper elevation={2} sx={{ mb: 3, p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <ServerStatusIndicator isAvailable={jupyterServerIsAvailable} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Jupyter Connection
              {currentServer?.name && ` - ${currentServer.name}`}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Current Server Status
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                wordBreak: "break-all",
                mb: 1,
              }}
            >
              {jupyterServerUrl}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              {jupyterServerIsAvailable ? (
                <>
                  <Typography variant="body2" color="success.main">
                    Connected - {numActiveKernels} active{" "}
                    {numActiveKernels === 1 ? "kernel" : "kernels"}
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleTest}
                    disabled={isTesting}
                  >
                    {isTesting ? "Testing..." : "Test Connection"}
                  </Button>
                  {testResult && (
                    <Typography
                      variant="body2"
                      color={testResult.success ? "success.main" : "error.main"}
                    >
                      {testResult.message}
                    </Typography>
                  )}
                </>
              ) : (
                <>
                  <Typography variant="body2" color="error.main">
                    Not connected - see instructions below to host a server
                  </Typography>
                  <Button size="small" onClick={refreshJupyter}>
                    Retry Connection
                  </Button>
                </>
              )}
            </Stack>
          </Box>
        </Paper>

        {/* Server Selection Table */}
        <Paper elevation={2} sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Server Selection
          </Typography>
          <TableContainer
            sx={{ "& table": { tableLayout: "auto", width: "auto" } }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: "48px" }} />
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    URL (name)
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", width: "150px" }}>
                    Token
                  </TableCell>
                  <TableCell padding="checkbox" sx={{ width: "48px" }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {servers.map((server) => (
                  <TableRow key={server.url}>
                    <TableCell padding="checkbox">
                      <Radio
                        checked={jupyterServerUrl === server.url}
                        onChange={() => handleServerSelect(server.url)}
                      />
                    </TableCell>
                    <TableCell
                      onClick={() => handleServerSelect(server.url)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      {server.url} {server.name ? `(${server.name})` : ""}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {server.token ? "******" : ""}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => handleSetToken(server.url)}
                        >
                          {server.token ? "Change token" : "Set token"}
                        </Button>
                      </Stack>
                    </TableCell>
                    <TableCell padding="checkbox">
                      {!server.isBuiltIn && (
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveServer(server.url)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 2 }}>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setIsAddServerDialogOpen(true)}
            >
              Add Server
            </Button>
          </Box>
        </Paper>

        {/* Delete Server Confirmation Dialog */}
        <Dialog
          open={isDeleteConfirmDialogOpen}
          onClose={() => {
            setIsDeleteConfirmDialogOpen(false);
            setServerToDelete(null);
          }}
        >
          <DialogTitle>Confirm Server Deletion</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this server?
              {serverToDelete && (
                <Box component="div" sx={{ mt: 1, wordBreak: "break-all" }}>
                  {serverToDelete}
                </Box>
              )}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setIsDeleteConfirmDialogOpen(false);
                setServerToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Server Dialog */}
        <Dialog
          open={isAddServerDialogOpen}
          onClose={() => setIsAddServerDialogOpen(false)}
        >
          <DialogTitle>Add New Server</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Server URL"
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
                fullWidth
                placeholder="http://localhost:8890"
              />
              <TextField
                label="Server Name (optional)"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                fullWidth
                placeholder="My Custom Server"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsAddServerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddServer} disabled={!newServerUrl}>
              Add
            </Button>
          </DialogActions>
        </Dialog>

        {/* Host Instructions */}
        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Hosting Instructions
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            To run a local Jupyter server:
          </Typography>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Box
              component="pre"
              sx={{
                bgcolor: "background.paper",
                p: 2,
                borderRadius: 1,
                overflowX: "auto",
                fontSize: "0.8rem",
              }}
            >
              pip install jupyterlab
            </Box>
          </Stack>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Then start Jupyter lab with:
          </Typography>
          <Stack spacing={1}>
            <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
              <Tooltip title="Copy command">
                <IconButton
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `jupyter lab --NotebookApp.allow_origin='${originToAllow}' --NotebookApp.token='' --NotebookApp.disable_check_xsrf="True" --no-browser --port=${jupyterServerUrl.split(":")[2] || "8888"} --MappingKernelManager.cull_interval="300" --MappingKernelManager.cull_idle_timeout="300" --MappingKernelManager.cull_connected="True"`,
                    );
                  }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              component="pre"
              sx={{
                bgcolor: "background.paper",
                p: 2,
                borderRadius: 1,
                overflowX: "auto",
                fontSize: "0.8rem",
              }}
            >
              jupyter lab --NotebookApp.allow_origin='{originToAllow}'{" "}
              --NotebookApp.token='' --NotebookApp.disable_check_xsrf="True"{" "}
              --no-browser --port={jupyterServerUrl.split(":")[2] || "8888"}{" "}
              --MappingKernelManager.cull_interval="300"
            </Box>
          </Stack>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Finally, update the above URL and optional token in the form above.
          </Typography>
        </Paper>
      </Box>
    </ScrollY>
  );
};

export default JupyterConfigurationView;
