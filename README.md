## Overview

The Dandiset Explorer is an interactive chat interface where users can explore a dataset on the [DANDI Archive](https://dandiarchive.org/) using natural language. The chat agent is equipped with tools to query the DANDI API for dandiset-level metadata and to list the NWB files contained in a given dataset. For individual NWB files, the agent can retrieve a structured summary of their contents and Python usage documentation describing how to programmatically access data elements. The agent can generate and execute Python scripts in a sandboxed environment, allowing it to stream data directly from remote NWB files and produce both textual and visual outputs in response to user questions.
 
The notebook generation process begins with an initial prompt provided to the chat interface. The assistant then waits for user input. If the user replies with “proceed,” the assistant continues autonomously; otherwise, the user can interject at any point with corrections or instructions. This interaction loop enables a flexible balance between automation and human guidance. During exploration, the assistant enumerates NWB files, inspects their structure, and summarizes the types of data present. The agent generates and executes code to create visualizations illustrating key content. If execution raises any exceptions, the resulting error messages are returned to the LLM, which revises the code accordingly. This process can repeat multiple times, providing the agent with multiple attempts to create functioning code. The system is designed to accommodate human oversight in resolving issues such as data inconsistencies or ambiguous metadata. The process continues until the assistant determines that it has gathered sufficient information for notebook generation.

Following the exploration phase, a separate LLM is tasked with generating a complete Jupyter notebook based on the accumulated interaction history (Appendix A, first prompt). This includes summaries, visual outputs, and code produced during exploration. The LLM then produces a Jupyter notebook and executes it in a controlled environment. The agent engages in an execution and error correction loop, similar to that of the exploration phase, until a fully functioning notebook is produced without runtime errors. Because the code is adapted from already debugged exploration code, fewer errors and correction cycles are expected.

This work illustrates how AI can significantly reduce barriers to scientific data reuse and foster broader engagement with complex neurophysiology datasets.

## Try it out!
- Explore the International Brain Lab's Brain Wide Map ([DANDI:001533](https://dandiarchive.org/dandiset/001533))
  - https://dandi-ai-notebooks.github.io/dandiset-explorer/chat?dandisetId=001533&dandisetVersion=draft
- Explore the MICrONS Two Photon Functional Imaging ([DANDI:000402](https://dandiarchive.org/dandiset/000402))
  - https://dandi-ai-notebooks.github.io/dandiset-explorer/chat?dandisetId=000402&dandisetVersion=0.230307.2132
- Explore the Mesoscale Activity Map ([DANDI:000363](https://dandiarchive.org/dandiset/000363))
  - https://dandi-ai-notebooks.github.io/dandiset-explorer/chat?dandisetId=000363&dandisetVersion=0.231012.2129

## Example
Example of an interactive chat conversation for Dandiset 000402 where the user asks a specific question about a dandiset:

<img width="1275" height="984" alt="Screenshot 2025-07-15 at 4 41 19 PM" src="https://github.com/user-attachments/assets/67a5dbf7-33ad-4f82-845c-7157e423576c" />

<img width="1274" height="983" alt="Screenshot 2025-07-15 at 4 49 21 PM" src="https://github.com/user-attachments/assets/0f25428b-658c-45c2-8c48-46e9b3e2df43" />

<img width="1272" height="983" alt="Screenshot 2025-07-15 at 4 49 52 PM" src="https://github.com/user-attachments/assets/32d05799-a166-493a-b4cb-2e9bca3201be" />

<img width="1273" height="837" alt="Screenshot 2025-07-15 at 4 50 05 PM" src="https://github.com/user-attachments/assets/1ccfe5e8-da5e-4cb2-8d62-f20443bec1ab" />
