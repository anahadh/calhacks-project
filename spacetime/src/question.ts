// Questions to humans (F1). The Inventory Agent decides in code whether to ask;
// the watcher writes the question here, and only a human in an allowed role
// answers it (AGENTS.md rules 8, 9). The answer watcher then resumes the round.

import { t } from "spacetimedb/server";

import { AGENT_NAMES, ANNOTATING_ROLES, TEXT_SOURCES } from "./constants";
import spacetimedb, { fail, getSession, isServer, requireServer } from "./schema";

function stringList(json: string, what: string): string[] {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    fail(`${what} is not valid JSON.`);
  }
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && x.length > 0)) fail(`${what} must be a list of strings.`);
  return v as string[];
}

export const question_add = spacetimedb.reducer(
  {
    session_id: t.string(), question_id: t.string(), round: t.u32(), agent: t.string(), target_id: t.string(),
    text: t.string(), text_source: t.string(), choices_json: t.string(), allowed_roles_json: t.string(),
  },
  (ctx, a) => {
    requireServer(ctx);
    getSession(ctx, a.session_id);
    if (!(AGENT_NAMES as readonly string[]).includes(a.agent)) fail(`Unknown agent "${a.agent}".`);
    if (!(TEXT_SOURCES as readonly string[]).includes(a.text_source)) fail("text_source must be claude or template.");
    if (!a.question_id || !a.text) fail("A question needs an id and text.");
    if (stringList(a.choices_json, "choices").length < 2) fail("A question needs at least two choices.");
    const roles = stringList(a.allowed_roles_json, "allowed_roles");
    if (!roles.length || roles.some((r) => !(ANNOTATING_ROLES as readonly string[]).includes(r))) {
      fail("Allowed roles are security, clinical_engineering or operations.");
    }
    const id = `${a.session_id}:${a.question_id}`;
    if (ctx.db.question.id.find(id)) fail(`Question "${a.question_id}" already exists.`);
    ctx.db.question.insert({
      id, ...a, answered: false, answer_choice: "", answer_author: "", answer_role: "", created_at: ctx.timestamp,
    });
  },
);

/** A human answers. Their name and role come from their presence row, never from the caller. */
export const question_answer = spacetimedb.reducer(
  { session_id: t.string(), question_id: t.string(), choice: t.string() },
  (ctx, { session_id, question_id, choice }) => {
    if (isServer(ctx)) fail("Only humans answer questions.");
    const q = ctx.db.question.id.find(`${session_id}:${question_id}`) ?? fail("That question does not exist.");
    if (q.answered) fail("This question has already been answered.");
    const p = ctx.db.presence.identity.find(ctx.sender);
    if (!p || p.session_id !== session_id) fail("Join the session before answering.");
    const roles = JSON.parse(q.allowed_roles_json) as string[];
    if (!roles.includes(p.role)) fail(`Only ${roles.join(" or ")} can answer this question.`);
    if (!(JSON.parse(q.choices_json) as string[]).includes(choice)) fail(`"${choice}" is not one of the choices.`);
    ctx.db.question.id.update({ ...q, answered: true, answer_choice: choice, answer_author: p.name, answer_role: p.role });
  },
);
