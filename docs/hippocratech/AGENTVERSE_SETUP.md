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

ANTHROPIC_API_KEY=...    # optional: Claude words the agents' messages (otherwise labeled template sentences)
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
3. Send `simulate ransomware from MRI 2`. You should get, in order:
   - "Started a round from MRI 2 (session chat-…)…", right away;
   - a summary when the round ends: the Flow Agent's proposal, the Clinical Workflow Agent's rejection and what it needs, the revision, both acceptances, and the recommendation with "Security, Clinical engineering must sign off".
4. Send `status`, then something unrelated (you should get the help text), then `simulate ransomware from Toaster 9` (you should get "I don't know a device called…").

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
| Messages say "(template)" | `ANTHROPIC_API_KEY` is unset, or Claude's text failed a check (the agent logs why). |
| Profile text didn't update | Agentverse stores the profile when the agent connects. Reconnect (step 5) after changing `agents/profiles/*.md`. |
