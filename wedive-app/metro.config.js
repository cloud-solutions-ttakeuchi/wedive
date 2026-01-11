const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the workspace root to allow importing shared modules
config.watchFolders = [workspaceRoot];

// 2. Resolve node_modules from both the app and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Ensure correct resolution in monorepo structure
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
