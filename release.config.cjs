module.exports = {
    branches: ["main"],
    plugins: [
        "@semantic-release/release-notes-generator",
        "@semantic-release/changelog",
        "@semantic-release/npm",
        "@semantic-release/github",
        "@semantic-release/git"
    ]
};
