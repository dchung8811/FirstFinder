// Pin the Turbopack workspace root to this project so Next.js doesn't
// accidentally pick up a stray ~/package-lock.json as the root directory.
module.exports = {
  turbopack: {
    root: __dirname,
  },
};
