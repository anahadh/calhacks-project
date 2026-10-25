# Agentverse setup (laptop)

Registers the four uAgents on Agentverse with their public profiles, and makes the Sign-off Coordinator reachable from ASI:One. Do this on a laptop: the cloud dev environment blocks `agentverse.ai`. Background and the details behind each step are in [`AGENT_NOTES.md`](AGENT_NOTES.md).

When you're done:
- all four agents show under **My Agents** on Agentverse with the **Mailbox** tag and their profiles;
- the agents still message each other directly at `127.0.0.1:8001`–`8004`;
- typing `simulate ransomware from MRI 2` to the Coordinator on ASI:One runs a real round.

## 1. Get the code

```bash
git clone https://github.com/anahadh/calhacks-project.git
cd calhacks-project
git checkout f1/agents
git config user.name "Your Name"
git config user.email "you@example.com"
```

## 2. Python environment

Python 3.11:

```bash
cd agents
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest          # all green before you go on
```

## 3. `agents/.env`

Create `agents/.env`. It is gitignored: check with `git check-ignore agents/.env`, which should print the path. **Never commit it.**

```bash
# One seed phrase per agent. The team shares these privately (not in the repo, not in chat
# logs that get pasted around). The agents' addresses are derived from them, so everyone
# who runs the agents must use the same four, or Agentverse sees four different agents.
INVENTORY_AGENT_SEED=...
FLOW_AGENT_SEED=...
CLINICAL_WORKFLOW_AGENT_SEED=...
COORDINATOR_AGENT_SEED=...

AGENT_MAILBOX=1          # register with an Agentverse mailbox (listed, reachable from ASI:One)
LOCAL_RESOLVE=1          # and keep the four agents talking to each other directly at 127.0.0.1
HIPPO_SIM_FIXTURES=1     # until hippo-sim exists: results from agents/fixtures/results/, labeled "fixture"

ASI1_API_KEY=...         # ASI:One: `asi1` reasons in chat (ASI1_CHAT_MODEL overrides), `asi1-mini` words the agents' round messages (ASI1_MODEL overrides)
ANTHROPIC_API_KEY=...    # optional: Claude words them when ASI1_API_KEY is unset (neither = the agents stop with an error; there is no fallback text)
AGENTVERSE_API_KEY=...   # optional: lets each agent connect its own mailbox (step 5, option B)
```

Seeds: if the team has none yet, generate four once (`python3 -c "import secrets; print(secrets.token_hex(24))"`, four times) and share them privately. Print the resulting addresses with `.venv/bin/python addresses.py`.

## 4. Start the agents

```bash
.venv/bin/python run_all.py
```

Each agent logs its address and an `Agent inspector available at https://agentverse.ai/inspect/?uri=…&address=…` line, and `run_all` says `all four agents are listening`. In a second terminal:

```bash
.venv/bin/python scripts/check_agentverse.py
```

It prints each agent's name, handle, address, port and Inspector URL, and checks that all four answer `GET /health` locally with `mailbox=on, local resolve=on`.

## 5. Connect each agent's mailbox

**Option A: the Inspector (four times).**

1. Sign in at [agentverse.ai](https://agentverse.ai) in **Chrome**.
2. Open an agent's Inspector URL, from `check_agentverse.py` or the agent's log line.
3. When Chrome asks to let agentverse.ai reach devices on your local network, choose **Allow**. That is Chrome's Local Network Access permission: the Inspector page talks to the agent at `127.0.0.1:<port>`. If you dismissed it, use the site settings (the icon left of the address bar) to allow **Local network access** for agentverse.ai, then reload.
4. Click **Connect → Mailbox**. The agent logs `Successfully registered as mailbox agent in Agentverse`.
5. Repeat for the other three ports.

**Option B: `AGENTVERSE_API_KEY` (no clicks).** Create an API key in Agentverse (in your account settings, under API keys; the exact menu name may differ) and put it in `agents/.env` as `AGENTVERSE_API_KEY`. With `AGENT_MAILBOX=1`, each agent POSTs it to its own local `/connect` at startup, which is exactly what the Inspector's button does. Each agent then logs `Agentverse: connected the mailbox with AGENTVERSE_API_KEY`. If you see `mailbox connect failed: …`, use option A and tell F1 what the detail said.

## 6. Confirm on Agentverse

Under **My Agents** you should see four agents, each with the **Mailbox** tag:

| Name | Handle |
|---|---|
| Hippocratech Inventory Agent | `@hippocratech-inventory` |
| Hippocratech Flow Agent | `@hippocratech-flow` |
| Hippocratech Clinical Workflow | `@hippocratech-clinical-workflow` |
| Hippocratech Coordinator | `@hippocratech-coordinator` |

Open each one: the description and README (from `agents/profiles/<agent>.md`) should be on its page, and the address should match `addresses.py`. Note each profile URL, and fill in the addresses and URLs in [`../README.md`](../README.md).

The `run_all` output should no longer show `Failed to connect to mailbox server`.

## 7. Test on ASI:One

1. Open [asi1.ai](https://asi1.ai), signed in with the same account.
2. Find the Coordinator: search for **Hippocratech Coordinator** or `@hippocratech-coordinator`, or open it from its Agentverse page (its chat button).

   Button and menu names here are from memory, not checked from this environment. Fix this page if they differ.
3. Send `what happens if ransomware starts at MRI 2?` (or just `simulate ransomware from MRI 2`). You should get, in order:
   - one sentence that the round started, right away;
   - the live narration, one line per event as it happens: `Baseline: … Asking @hippocratech-flow for a plan…`, `[ @hippocratech-flow · round 1 ] proposed "…"`, `[ @hippocratech-clinical-workflow · round 1 ] rejected: …`, the revision, the acceptances, `[ @hippocratech-coordinator ] the agents agree on "…"`;
   - a prose summary naming each agent by handle, with the recommendation card (before/after numbers, who must sign off, the live-room button).
4. Ask follow-ups in plain words: `why did clinical workflow reject the first plan?` (the Coordinator answers from the round's events), `ask the flow agent which plans it tested` (you see `Asking @hippocratech-flow: …` and then `@hippocratech-flow said: "…"`), `where can an attack start?` (the device picker), `what is PACS?`.
5. @-mention a specialist directly, e.g. `@hippocratech-inventory which devices can't you identify?`: it answers from its own state.

Meanwhile, `run_all` prints every agent message as usual. The chat round's rows are in `agents/logs/chat-<id>.jsonl`, and the chat lines in `agents/logs/asi1-chat.jsonl`.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `INVENTORY_AGENT_SEED is not set` | `agents/.env` is missing or not in `agents/`. |
| Addresses differ from a teammate's | Different seeds. Use the team's shared four. |
| `ports [...] are already in use` / `address already in use` | Another `run_all.py` is running. Stop it, or find the process: `lsof -i :8001`. |
| Inspector page can't see the agent | Chrome blocked local network access: allow it for agentverse.ai (step 5). Brave and Safari may block `127.0.0.1` from a website entirely; use Chrome. Check the agent is up with `check_agentverse.py`. |
| `Failed to connect to mailbox server` keeps repeating | The mailbox isn't connected yet (do step 5), or no internet. Local rounds still work. |
| Connect succeeds but the agent isn't under My Agents | Signed in to a different Agentverse account or team. Reload My Agents. |
| `Agentverse: mailbox connect failed: …` | The API key is wrong or lacks access. Use the Inspector instead (option A). |
| ASI:One gets no answer | Check the Coordinator's log for `Received` lines. If nothing arrives, its mailbox isn't connected. If it logs `chat reply … not delivered`, the reply couldn't be routed back. Restart `run_all.py` and reconnect. |
| ASI:One: "I couldn't start a round from CT 1: fixture results exist only for an attack starting at MRI 2" | Expected with `HIPPO_SIM_FIXTURES=1`: fixtures exist only for MRI 2. Use MRI 2 until hippo-sim exists. |
| The round stops with "The … agent failed: …" | Neither `ASI1_API_KEY` nor `ANTHROPIC_API_KEY` is set, the model API failed, or its text failed the checks twice. The error is the round's status; there is no fallback text. |
| Profile text didn't update | Agentverse stores the profile when the agent connects. Reconnect (step 5) after changing `agents/profiles/*.md`. |

## 7. A public link for the room page

The Coordinator's chat replies link to the round's live room (`HIPPO_WEB_URL/room/<session>`). On a judge's phone `localhost` goes nowhere, so before a demo over ASI:One put the web app behind a public URL and point the agents at it:

```sh
brew install cloudflared
cloudflared tunnel --url http://localhost:3000   # prints https://<random>.trycloudflare.com
```

Then set `HIPPO_WEB_URL=https://<random>.trycloudflare.com` in `agents/.env` and restart `run_all.py`. A deployed web app works the same way. The link is the one click that takes a judge from Fetch.ai's chat into the app, so check it from a phone.

## 8. Chatting with the specialists

Inventory, Flow and Clinical Workflow also speak the chat protocol (`agents/agent_chat.py`), on the same reasoning loop as the Coordinator (`agents/brain.py`) with their own tools over the state they keep per round (the plans Flow tested, the devices Inventory can't confirm and the questions it asked, the verdicts Clinical Workflow gave and the flows a plan broke) plus the hospital's MCP tools (`agents/mcp_server.py`). They never start rounds themselves; the Coordinator reaches them with `ask_agent`. Their READMEs carry the `innovationlab` and `hackathon` tags, and the Coordinator's README lists all four handles and addresses.

