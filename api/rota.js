import fs from "fs";
import path from "path";

// 4 flatmates, PIN passcodes, and garbage cycle fallback
const fallbackData = {
  members: {
    utensils: ["Aman", "Subhram", "Chinmaya", "Pritam"],
    garbage: ["Aman", "Subhram", "Chinmaya", "Pritam"],
  },
  passcodes: {
    Aman: "1001",
    Subhram: "1002",
    Chinmaya: "1003",
    Pritam: "1004",
  },
  adminSecret: "kitchen123",
  garbageCycle: {
    currentIndex: 0,
    approvals: {},
    history: [],
  },
};

const LOCAL_FILE_PATH = path.join(process.cwd(), "data", "rota.json");

function getConfig() {
  return {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    path: process.env.GITHUB_PATH || "data/rota.json",
  };
}

function readLocalJson() {
  try {
    if (fs.existsSync(LOCAL_FILE_PATH)) {
      const content = fs.readFileSync(LOCAL_FILE_PATH, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("Could not read local data/rota.json, using fallback:", err);
  }
  return fallbackData;
}

function writeLocalJson(data) {
  try {
    const dir = path.dirname(LOCAL_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_FILE_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
    return true;
  } catch (err) {
    console.error("Could not write to local data/rota.json:", err);
    return false;
  }
}

async function readGitHubJson() {
  const { token, owner, repo, path: filePath } = getConfig();

  if (!token || !owner || !repo) {
    const local = readLocalJson();
    return { data: local, sha: null, fallback: false };
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
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
  const { token, owner, repo, path: filePath } = getConfig();

  if (!token || !owner || !repo) {
    const ok = writeLocalJson(data);
    return { ok, fallback: false };
  }

  const current = await readGitHubJson();
  const message = "Update rota & garbage cycle from app";

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
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
    // -------------------------------------------------------------
    // POST /api/rota: Handles PIN verification & session validation
    // -------------------------------------------------------------
    if (req.method === "POST") {
      const { pin, member, token } = req.body || {};
      const { data } = await readGitHubJson();
      const passcodes = data?.passcodes || fallbackData.passcodes;

      // Auto-validation of stored token
      if (member && token) {
        const expectedPin = passcodes[member];
        if (expectedPin && token === Buffer.from(`${member}:${expectedPin}`).toString("base64")) {
          return res.status(200).json({ valid: true, member });
        }
        return res.status(401).json({ valid: false, error: "Invalid session token" });
      }

      // Manual PIN verification
      if (pin) {
        const foundMember = Object.keys(passcodes).find(
          (m) => String(passcodes[m]).trim() === String(pin).trim()
        );

        if (foundMember) {
          const generatedToken = Buffer.from(`${foundMember}:${pin.trim()}`).toString("base64");
          return res.status(200).json({
            valid: true,
            member: foundMember,
            token: generatedToken,
          });
        }
        return res.status(401).json({ valid: false, error: "Incorrect PIN" });
      }

      return res.status(400).json({ error: "Missing verification payload" });
    }

    // -------------------------------------------------------------
    // GET /api/rota: Returns safe rota state without exposing PINs
    // -------------------------------------------------------------
    if (req.method === "GET") {
      const { data, fallback } = await readGitHubJson();

      const safeState = {
        ...fallbackData,
        ...data,
        members: {
          ...fallbackData.members,
          ...(data?.members || {}),
        },
        garbageCycle: {
          ...fallbackData.garbageCycle,
          ...(data?.garbageCycle || {}),
        },
      };

      delete safeState.passcodes;
      delete safeState.adminSecret;

      return res.status(200).json({
        ...safeState,
        fallback,
      });
    }

    // -------------------------------------------------------------
    // PATCH/PUT /api/rota: Updates roster/garbage state safely
    // -------------------------------------------------------------
    if (req.method === "PATCH" || req.method === "PUT") {
      const incoming = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!incoming || typeof incoming !== "object") {
        return res.status(400).json({ error: "Invalid JSON payload" });
      }

      const current = await readGitHubJson();
      const currentData = current.data || {};

      const merged = {
        ...fallbackData,
        ...currentData,
        ...incoming,
        members: {
          ...(currentData.members || fallbackData.members),
          ...(incoming.members || {}),
        },
        garbageCycle: {
          ...(currentData.garbageCycle || fallbackData.garbageCycle),
          ...(incoming.garbageCycle || {}),
        },
        passcodes: currentData.passcodes || fallbackData.passcodes,
        adminSecret: currentData.adminSecret || fallbackData.adminSecret,
      };

      const result = await writeGitHubJson(merged);
      return res.status(200).json({ ok: result.ok, fallback: Boolean(result.fallback) });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "PUT"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected error" });
  }
}
