const fetch = require("node-fetch");
const {
  isComponent,
  getComponentName,
  isComponentArgument,
  isScopedPathExpression
} = require("./lib/ast-helpers");
const memoize = require("memoizee");
const { normalizeComponents } = require("./lib/normalizers");
const { URI } = require("vscode-uri");
const { getProjectAddonsInfo } = require("./lib/dependency-collector");
const PLACEHOLDER = 'ELSCompletionDummy';

async function getAddonDocs(packageName, demoURL) {
  const result = await fetch(`${demoURL}/docs/${packageName}.json`);
  const data = await result.json();
  return data;
}

async function loadCompletions(addons) {
  /* 
        this implementation just draft,
        we should cache it
    */
  const mapper = async ([org, repo]) => {
    let result = {
      included: []
    };
    try {
      result = await getAddonDocs(org, repo);
    } catch (e) {
      console.error(e.stack);
    }
    return result;
  };
  const queries = addons.map(mapper);
  const data = await Promise.all(queries);
  const addonsResults = data.map(info => normalizeComponents(info));
  const results = [].concat(addonsResults);
  return Object.assign.apply({}, results);
}

function demoUrl(pack) {
  return pack["ember-addon"].demoURL;
}
function addonName(pack) {
  return pack["name"];
}

function hasDemoUrl(pack) {
  return (
    pack["ember-addon"] &&
    typeof pack["ember-addon"].demoUrl === "string" &&
    pack["ember-addon"].demoUrl.length
  );
}

async function findProjectAddonsWithDocs(projectRoot) {
  const items = getProjectAddonsInfo(projectRoot);

  return items
    .map(el => {
      if (hasDemoUrl(el)) {
        return [addonName(el), demoUrl(el)];
      } else if (el.homepage) {
        return [addonName(el), el.homepage];
      } else {
        return null;
      }
    })
    .filter(el => el !== null);
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

function mergeLeft(to, from) {
  Object.keys(from).forEach(key => {
    if (!to[key]) {
      to[key] = from[key];
    }
  });
}

async function loadAddonInfo(projectRoot) {
  const addons = await findProjectAddonsWithDocs(projectRoot);
  const components = await loadCompletions(addons);
  return components;
}

const addonInfo = memoize(loadAddonInfo);

async function onComplete(root, { results, focusPath, type }) {
  if (type !== "template") {
    return results;
  }
  const projectRoot = URI.parse(root).fsPath;
  const components = await addonInfo(projectRoot);
  const meta = focusPath.metaForType('handlebars');
  if (isComponentArgument(focusPath)) {
    const componentName = getComponentName(focusPath);
    if (componentName in components) {
      components[componentName].arguments.forEach(arg => {
        const argument = results.find(({ label }) => label === arg.name);
        const argumentInfo = {
          label: "@" + arg.name,
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
      if (blockDefinition.path.node.type === 'ElementNode') {
        const componentName = blockDefinition.path.node.tag;
        let localResult = [];
        if (componentName in components) {
          components[componentName].yields.forEach((el)=>{
            if (!el.label.includes('.') && blockDefinition.index === el.index) {
              localResult.push(el);
            }
          })
        }
        if (localResult.length) {
          results = localResult;
          if (results.length === 1) {
            results[0].preselect = true;
          }
        } else {
          results = results.filter(({label})=>/^[A-z0-9]+$/.test(label));
        }
      }
    } else if (isScopedPathExpression(focusPath)) {
      meta.localScope.forEach((scopeItem)=>{
        const originalPathPrefix = focusPath.node.original.replace(PLACEHOLDER, '') || scopeItem.name;
        const shouldComplete = scopeItem.name.startsWith(originalPathPrefix.split('.')[0]);
        if (shouldComplete && scopeItem.path.node.type === 'ElementNode') {
          const componentName = scopeItem.path.node.tag;
          if (componentName in components) {
            components[componentName].yields.forEach((el)=>{
              let fixedName = el.label.split('.');
              fixedName[0] = scopeItem.name;
              if (el.kind !== 7) {
                results.push({
                  label: fixedName.join('.'),
                  kind: el.kind,
                  detail: el.detail
                });
              }
            })
          }
        }
      })
      /// 
    } else if (isComponent(focusPath)) {
      Object.keys(components).forEach(name => {
        const component = results.find(({ label }) => label === name);
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

      meta.localScope.forEach((scopeItem)=>{
        if (scopeItem.path.node.type === 'ElementNode') {
          const componentName = scopeItem.path.node.tag;
          const originalPathPrefix = focusPath.node.tag.replace(PLACEHOLDER, '') || scopeItem.name;
          const shouldComplete = scopeItem.name.startsWith(originalPathPrefix.split('.')[0]);
          if (shouldComplete && componentName in components) {
            components[componentName].yields.forEach((el)=>{
              if (el.kind === 7) {
                let fixedName = el.label.split('.');
                fixedName[0] = scopeItem.name;
                results.push({
                  label: fixedName.join('.'),
                  kind: el.kind,
                  description: el.description,
                  detail: el.detail
                });
              }
            })
          }
        }
      })
    } 
  }
  return results;
}

module.exports.onComplete = onComplete;
