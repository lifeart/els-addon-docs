const fs = require("fs");
const path = require("path");
const walkSync = require("walk-sync");

function isProjectAddonRoot(root) {
  const pack = getPackageJSON(root);
  return isEmberAddon(pack);
}

function safeWalkSync(filePath, opts) {
  if (!filePath) {
    return [];
  }
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return walkSync(filePath, opts);
}

module.exports.getProjectAddonsInfo = function getProjectAddonsInfo(root) {
  const roots = [
    ...getProjectAddonsRoots(root),
    ...getProjectInRepoAddonsRoots(root)
  ].filter(pathItem => typeof pathItem === "string");

  const meta = [];
  roots.forEach(packagePath => {
    let package = getPackageJSON(packagePath);
    if (isEmberAddon(package) && hasDependency(package, 'ember-cli-addon-docs')) {
      meta.push(package);
    }
  });
  return meta;
};

function hasDependency(package, depName) {
  let deps =  [
    ...Object.keys(package.dependencies || {}),
    ...Object.keys(package.peerDependencies || {}),
    ...Object.keys(package.devDependencies || {})
  ];
  return deps.includes(depName);
}

function getProjectInRepoAddonsRoots(root) {
  const addons = safeWalkSync(path.join(root, 'lib'), {
    directories: true,
    globs: ["**/package.json"]
  });
  const roots = [];
  addons
    .map(relativePath => {
      return path.dirname(path.join(root, prefix, relativePath));
    })
    .filter(packageRoot => isProjectAddonRoot(packageRoot))
    .forEach(validRoot => {
      roots.push(validRoot);
      getProjectAddonsRoots(validRoot, roots).forEach(relatedRoot => {
        if (!roots.includes(relatedRoot)) {
          roots.push(relatedRoot);
        }
      });
    });
  return roots;
}

function getProjectAddonsRoots(
  root,
  resolvedItems = [],
  packageFolderName = "node_modules"
) {
  const pack = getPackageJSON(root);
  if (resolvedItems.length) {
    if (!isEmberAddon(pack)) {
      return [];
    }
  }
  const items = resolvedItems.length
    ? [
        ...Object.keys(pack.dependencies || {}),
        ...Object.keys(pack.peerDependencies || {})
      ]
    : [
        ...Object.keys(pack.dependencies || {}),
        ...Object.keys(pack.peerDependencies || {}),
        ...Object.keys(pack.devDependencies || {})
      ];

  const roots = items
    .map(item => {
      return resolvePackageRoot(root, item, packageFolderName);
    })
    .filter(p => {
      return p !== false;
    });
  const recursiveRoots = resolvedItems.slice(0);
  roots.forEach(rootItem => {
    if (!recursiveRoots.includes(rootItem)) {
      recursiveRoots.push(rootItem);
      getProjectAddonsRoots(
        rootItem,
        recursiveRoots,
        packageFolderName
      ).forEach(item => {
        if (!recursiveRoots.includes(item)) {
          recursiveRoots.push(item);
        }
      });
    }
  });
  return recursiveRoots;
}

function getPackageJSON(file) {
  try {
    const result = JSON.parse(
      fs.readFileSync(path.join(file, "package.json"), "utf8")
    );
    return result;
  } catch (e) {
    return {};
  }
}

function resolvePackageRoot(root, addonName, packagesFolder = "node_modules") {
  const roots = root.split(path.sep);
  while (roots.length) {
    const prefix = roots.join(path.sep);
    const maybePath = path.join(prefix, packagesFolder, addonName);
    const linkedPath = path.join(prefix, addonName);
    if (fs.existsSync(path.join(maybePath, "package.json"))) {
      return maybePath;
    } else if (fs.existsSync(path.join(linkedPath, "package.json"))) {
      return linkedPath;
    }
    roots.pop();
  }
  return false;
}

function isEmberAddon(info) {
  return info.keywords && info.keywords.includes("ember-addon");
}
