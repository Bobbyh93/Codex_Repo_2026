# Definitions: Tools vs Skills vs Agents

## Tool
A tool is a capability an assistant or agent can call to do something it cannot do with plain text alone.
Examples:
- web search
- file search
- code execution
- spreadsheet editing
- an MCP connector
- a custom function like `get_weather()` or `update_crm_record()`

## Skill
A skill is a reusable workflow bundle that teaches ChatGPT how to do a task consistently.
A skill usually includes:
- a `SKILL.md` entrypoint
- instructions / workflow steps
- optional scripts
- optional schemas, templates, or references

A skill can tell ChatGPT which tools to use, in what order, and under what rules.

## Agent
An agent is the runtime system that actually works on the task.
At minimum an agent has:
- a model
- instructions
- tools

An agent may also use one or more skills as reusable playbooks.

## Relationship
- tools = capabilities
- skills = reusable task playbooks
- agents = systems that use a model plus tools and instructions, and can optionally load skills

## Simple examples
- Tool: `web_search`
- Skill: `nursing-crosswalk-agent`
- Agent: a crosswalk release agent that uses GPT-5, file search, spreadsheet editing, and the nursing-crosswalk-agent skill to build a release workbook
