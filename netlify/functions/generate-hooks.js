// This file runs on Netlify's servers, NOT in the browser.
// It keeps your API key safe (hidden from users).

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { topic, language } = JSON.parse(event.body);

    if (!topic || topic.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Topic is required" }),
      };
    }

    const langInstruction =
      language === "hi"
        ? "Write the hooks in Hinglish (Hindi content, Roman/English script) since the creator's audience is Indian."
        : "Write the hooks in English.";

    const prompt = `You are a viral short-form video (Instagram Reels / YouTube Shorts) hook writer.

Topic/niche: "${topic}"

Generate exactly 10 scroll-stopping hooks (the first 1-2 spoken lines of a video) for this topic.
${langInstruction}

Rules:
- Each hook must be under 20 words
- Make them punchy, curiosity-driven, or pattern-interrupting
- Vary the styles: some questions, some bold claims, some "you're doing X wrong" angles, some numbered/list hooks
- No hashtags, no emojis, no explanations
- Return ONLY a JSON array of 10 strings, nothing else. Example format:
["hook 1", "hook 2", ...]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "AI request failed", detail: errText }),
      };
    }

    const data = await response.json();
    const rawText = data.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    // Clean up in case the model wraps the JSON in markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let hooks;
    try {
      hooks = JSON.parse(cleaned);
    } catch (e) {
      // Fallback: split by lines if JSON parsing fails
      hooks = cleaned
        .split("\n")
        .map((line) => line.replace(/^[-\d.\s"]+|"[,]?$/g, "").trim())
        .filter((line) => line.length > 5)
        .slice(0, 10);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hooks }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", detail: err.message }),
    };
  }
};
