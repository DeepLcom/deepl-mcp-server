const gitlabProjectUrl = process.env.CI_PROJECT_URL;
const publicRepositoryUrl = "https://github.com/DeepL/deepl-mcp-server";

export default {
  branches: ["main"],
  repositoryUrl: gitlabProjectUrl ? `${gitlabProjectUrl}.git` : undefined,
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "build", release: false },
          { type: "ci", release: false },
          { type: "docs", release: false },
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "patch", release: "patch" },
        ],
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "build", hidden: true },
            { type: "ci", hidden: true },
            { type: "docs", hidden: true },
            { type: "feat", section: "Added" },
            { type: "patch", section: "Changed" },
            { type: "fix", section: "Fixed" },
          ],
          commitUrlFormat: `${publicRepositoryUrl}/commit/{{hash}}`,
          compareUrlFormat: `${publicRepositoryUrl}/compare/{{previousTag}}...{{currentTag}}`,
          issueUrlFormat: `${publicRepositoryUrl}/issues/{{id}}`,
        },
      },
    ],
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "package-lock.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/gitlab",
      {
        gitlabUrl: "https://gitlab.com",
        assets: [{ path: "CHANGELOG.md" }],
      },
    ],
  ],
};
