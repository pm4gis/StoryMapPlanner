const CONFIG = {
  primaryModel: "@cf/meta/llama-3.1-8b-instruct",
  fallbackModel: "@cf/meta/llama-3-8b-instruct",
  maxBodyBytes: 24_000,
  maxContextChars: 10_000,
  rateLimitPerMinute: 12,
  allowedOps: new Set(["outline", "improve_key_message", "draft_section_text", "suggest_alt_text", "suggest_cta", "quality_check"])
};

const ipHits = new Map();

export async function onRequestPost(context) {
  let bodyText = "";
  try {
    bodyText = await context.request.text();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (bodyText.length > CONFIG.maxBodyBytes) {
    return json({ error: "Input too large" }, 413);
  }

  const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  try {
    const minuteAgo = now - 60_000;
    const hits = (ipHits.get(ip) || []).filter((t) => t > minuteAgo);
    if (hits.length >= CONFIG.rateLimitPerMinute) {
      return json({ error: "Rate limit reached. Please try again shortly." }, 429);
    }
    hits.push(now);
    ipHits.set(ip, hits);
  } catch {
    return json({ error: "Please try again." }, 429);
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return json({ error: "JSON required" }, 400);
  }

  const { operation, context: opContext } = payload || {};
  if (!CONFIG.allowedOps.has(operation)) {
    return json({ error: "Unsupported operation" }, 400);
  }
  if (!opContext || typeof opContext !== "object") {
    return json({ error: "Missing context object" }, 400);
  }

  const contextString = JSON.stringify(opContext);
  if (contextString.length > CONFIG.maxContextChars) {
    return json({ error: "Context too large" }, 413);
  }

  if (containsSensitiveRequest(contextString)) {
    return json({ error: "Request blocked by safety policy" }, 400);
  }

  if (!context.env?.AI) {
    return json({ error: "AI binding unavailable in this environment" }, 501);
  }

  const messages = [
    { role: "system", content: systemPrompt(operation) },
    { role: "user", content: JSON.stringify(minimizeContext(operation, opContext)) }
  ];

  let modelUsed = CONFIG.primaryModel;
  let answer;
  try {
    answer = await runModel(context.env.AI, modelUsed, messages);
  } catch {
    modelUsed = CONFIG.fallbackModel;
    try {
      answer = await runModel(context.env.AI, modelUsed, messages);
    } catch {
      return json({ error: "AI currently unavailable. Please try again." }, 503);
    }
  }

  return json({ result: answer, model: modelUsed });
}

function minimizeContext(operation, c) {
  switch (operation) {
    case "outline":
      return { meta: pick(c.meta, ["storyTitle", "audience", "goal", "geographicFocus", "tone", "primaryCta"]), templateStyle: String(c.templateStyle || "balanced") };
    case "improve_key_message":
      return pick(c, ["title", "purpose", "keyMessage"]);
    case "draft_section_text":
      return pick(c, ["title", "purpose", "keyMessage", "arcStage"]);
    case "suggest_alt_text":
      return { media: (Array.isArray(c.media) ? c.media : []).map((m) => pick(m, ["type", "source", "caption", "altText"])) };
    case "suggest_cta":
      return pick(c, ["goal", "audience", "currentCta"]);
    case "quality_check":
      return { meta: pick(c.meta, ["goal", "audience", "primaryCta"]), sections: (Array.isArray(c.sections) ? c.sections : []).map((s) => pick(s, ["type", "title", "keyMessage", "arcStage", "media"])) };
    default:
      return {};
  }
}

async function runModel(ai, model, messages) {
  const out = await ai.run(model, { messages, max_tokens: 650, temperature: 0.4 });
  if (typeof out === "string") return out;
  return out?.response || out?.result?.response || JSON.stringify(out);
}

function pick(obj, keys) {
  const src = obj && typeof obj === "object" ? obj : {};
  return keys.reduce((acc, key) => {
    if (src[key] !== undefined) acc[key] = src[key];
    return acc;
  }, {});
}

function containsSensitiveRequest(text) {
  const lowered = String(text).toLowerCase();
  const blocked = ["password", "api key", "secret", "token", "credit card", "social security", "ssn", "private key", "extract emails", "harvest", "scrape people"];
  return blocked.some((k) => lowered.includes(k));
}

function systemPrompt(operation) {
  const base = "You are a StoryMap planning assistant. Keep responses concise, practical, and safe. Do not request credentials or personal data.";
  const prompts = {
    outline: "Create an ordered StoryMap outline with section type, title, purpose, and key message.",
    improve_key_message: "Rewrite key message for clarity and brevity. Return 3 options.",
    draft_section_text: "Draft a concise narrative paragraph suitable for StoryMap section planning.",
    suggest_alt_text: "Suggest accessible alt text for media items missing alt text. Use concise, descriptive language.",
    suggest_cta: "Write a short call to action that matches audience and goal.",
    quality_check: "Return a bullet list of issues and suggested fixes for: text-heavy runs, missing Challenge/Outcome, missing alt text, missing CTA, overlong titles or vague key messages."
  };
  return `${base} ${prompts[operation] || ""}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
