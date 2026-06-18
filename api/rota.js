const fallbackData = {
  members: {
    utensils: ["Alice", "Bob", "Charlie", "David", "Emma"],
    garbage: ["Rahul", "Priya", "Amit", "Sneha", "Vikram"],
  },
};

function getConfig() {
  return {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    path: process.env.GITHUB_PATH || "data/rota.json",
  };
}

async function readGitHubJson() {
  const { token, owner, repo, path } = getConfig();

  if (!token || !owner || !repo) {
    return { data: fallbackData, sha: null, fallback: true };
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { data: fallbackData, sha: null, fallback: true };
    }

    throw new Error(`GitHub read failed with status ${response.status}`);
  }

  const payload = await response.json();
  const decoded = Buffer.from(payload.content, "base64").toString("utf8");

  return {
    data: JSON.parse(decoded),
    sha: payload.sha,
    fallback: false,
  };
}

async function writeGitHubJson(data) {
  const { token, owner, repo, path } = getConfig();

  if (!token || !owner || !repo) {
    return { ok: false, fallback: true };
  }

  const current = await readGitHubJson();
  const message = "Update rota JSON from app";

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(data, null, 2) + "\n").toString("base64"),
      sha: current.sha || undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub write failed with status ${response.status}: ${errorText}`);
  }

  return { ok: true, fallback: false };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data } = await readGitHubJson();
      return res.status(200).json(data);
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      const incoming = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!incoming || typeof incoming !== "object") {
        return res.status(400).json({ error: "Invalid JSON payload" });
      }

      const result = await writeGitHubJson(incoming);
      return res.status(200).json({ ok: true, fallback: Boolean(result.fallback) });
    }

    res.setHeader("Allow", ["GET", "PATCH", "PUT"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected error" });
  }
}