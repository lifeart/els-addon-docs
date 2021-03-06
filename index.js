const {
  isComponent,
  getComponentName,
  isComponentArgument,
  is,
  isScopedPathExpression
} = require("./lib/ast-helpers");
const memoize = require("memoizee");
const { mergeLeft } = require("./lib/normalizers");
const { URI } = require("vscode-uri");
const { getProjectAddonsInfo } = require("./lib/dependency-collector");
const { makeAddonUrl, loadCompletions } = require("./lib/doc-resolver");
const PLACEHOLDER = "ELSCompletionDummy";

async function findProjectAddonsWithDocs(projectRoot) {
  const items = getProjectAddonsInfo(projectRoot);

  return items.map(makeAddonUrl).filter(el => el !== null);
  /* 
        we need to get package.json, extract all names, 
        find related folders, check for ember-addon key in package.json
        check if `ember-addon.demoURL` exists for such project
        if exists - return the project name together with the value of `ember-addon.demoURL`.

        I beleve we can cache it for projectRoot
    */
  return [
    ["ember-flatpickr", "https://shipshapecode.github.io/ember-flatpickr"],
    ["ember-autoresize", "http://tim-evans.github.io/ember-autoresize"],
    [
      "ember-file-upload",
      "https://adopted-ember-addons.github.io/ember-file-upload"
    ],
    ["ember-yeti-table", "https://miguelcobain.github.io/ember-yeti-table"],
    // addons above are missing `ember-addon.demoURL` key, should fix upstream
    ["ember-table", "https://opensource.addepar.com/ember-table"],
    [
      "carbon-components-ember",
      "https://patricklx.github.io/carbon-components-ember"
    ]
  ];
}

async function loadAddonInfo(projectRoot) {
  const addons = await findProjectAddonsWithDocs(projectRoot);
  const components = await loadCompletions(addons);
  return components;
}

const addonInfo = memoize(loadAddonInfo);

function byLabel(results, name) {
  return results.find(({ label }) => label === name);
}

function normalizeArgumentName(name) {
  return '@' + name.replace('@', '');
}

function pathRoot(name) {
  return name.split('.')[0];
}

function replaceRoot(path, root) {
  const parts = path.split('.');
  parts[0] = root;
  return parts.join('.');
}

function onlyValidBlockNames(results) {
  return results.filter(({ label }) => /^[A-z0-9]+$/.test(label));
}

function isComponentCompletion({kind}) {
  return kind === 7;
}

async function onComplete(root, { results, focusPath, type }) {
  if (type !== "template") {
    return results;
  }
  const projectRoot = URI.parse(root).fsPath;
  const components = await addonInfo(projectRoot);
  const meta = focusPath.metaForType("handlebars");
  if (isComponentArgument(focusPath)) {
    const componentName = getComponentName(focusPath);
    if (componentName in components) {
      components[componentName].arguments.forEach(arg => {
        const argument = byLabel(results, arg.name);
        const argumentInfo = {
          label: normalizeArgumentName(arg.name),
          kind: 5,
          detail: arg.description,
          documentation: arg.description
        };
        if (!argument) {
          results.push(argumentInfo);
        } else {
          mergeLeft(argument, argumentInfo);
        }
      });
    }
  } else {
    const blockDefinition = meta.maybeBlockParamDefinition;
    if (blockDefinition) {
      if (is(blockDefinition.path, "ElementNode")) {
        const componentName = blockDefinition.path.node.tag;
        let localResult = [];
        if (componentName in components) {
          components[componentName].yields.forEach(el => {
            if (!el.label.includes(".") && blockDefinition.index === el.index) {
              localResult.push(el);
            }
          });
        }
        if (localResult.length) {
          results = localResult;
          if (results.length === 1) {
            results[0].preselect = true;
          }
        } else {
          results = onlyValidBlockNames(results);
        }
      }
    } else if (isScopedPathExpression(focusPath)) {
      meta.localScope.forEach(scopeItem => {
        const originalPathPrefix =
          focusPath.node.original.replace(PLACEHOLDER, "") || scopeItem.name;
        const shouldComplete = scopeItem.name.startsWith(
          pathRoot(originalPathPrefix)
        );
        if (shouldComplete && is(scopeItem.path, "ElementNode")) {
          const componentName = scopeItem.path.node.tag;
          if (componentName in components) {
            components[componentName].yields.forEach(el => {
              if (!isComponentCompletion(el)) {
                results.push({
                  label: replaceRoot(el.label, scopeItem.name),
                  kind: el.kind,
                  detail: el.detail
                });
              }
            });
          }
        }
      });
      ///
    } else if (isComponent(focusPath)) {
      Object.keys(components).forEach(name => {
        const component = byLabel(results, name)
        const info = {
          label: name,
          detail: components[name].description,
          documentation: components[name].description,
          kind: 7
        };
        if (!component) {
          results.push(info);
        } else {
          mergeLeft(component, info);
        }
      });

      meta.localScope.forEach(scopeItem => {
        if (is(scopeItem.path, "ElementNode")) {
          const componentName = scopeItem.path.node.tag;
          const originalPathPrefix =
            focusPath.node.tag.replace(PLACEHOLDER, "") || scopeItem.name;
          const shouldComplete = scopeItem.name.startsWith(
            pathRoot(originalPathPrefix)
          );
          if (shouldComplete && componentName in components) {
            components[componentName].yields.forEach(el => {
              if (isComponentCompletion(el)) {
                results.push({
                  label: replaceRoot(el.label, scopeItem.name),
                  kind: el.kind,
                  description: el.description,
                  detail: el.detail
                });
              }
            });
          }
        }
      });
    }
  }
  return results;
}

module.exports.onComplete = onComplete;
