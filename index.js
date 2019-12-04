import fetch from 'node-fetch';
import { isComponent, getComponentName, isComponentArgument } from './lib/ast-helpers';
import { normalizeComponents } from './lib/normalizers';
import { URI } from 'vscode-uri';

async function getAddonDocs(org, repo) {
    const result = await fetch(`https://${org}.github.io/${repo}/docs/${repo}.json`);
    const data = await result.toJSON();
    return data;
}

async function loadCompletions(addons) {
    /* 
        this implementation just draft,
        we should cache it
    */
    const data = await Promise.all(addons.map(([org, repo])=> await getAddonDocs(org, repo)));
    const addons = data.map((info)=>normalizeComponents(info));
    const results = [].concat(data);
    return Object.assign.apply({}, results);
}

async function findProjectAddonsWithDocs(projectRoot) {
    /* 
        we need to get package.json, extract all names, 
        find related folders, check for ember-addon key in package.json
        check if addon-docs exists for such project
        if exists - return github org name and repo name (for now)

        I beleve we can cache it for projectRoot
    */
    return [
        ['miguelcobain', 'ember-yeti-table']
    ];
}

async function onComplete(root,{ results, focusPath, type }) {
    if (type !== 'template') {
        return results;
    }
    const projectRoot = URI.parse(root).fsPath;
    const addons = await findProjectAddonsWithDocs(projectRoot);
    const components = await loadCompletions(addons);
    if (isComponent(focusPath)) {
        Object.keys(components).forEach((name) => {
            if (!results.filter(({label})=>label === name)) {
                results.push({
                    label: name, 
                    detail: components[name].description,
                    kind: 7
                })
            }
        })
    } else if (isComponentArgument(focusPath)) {
        const componentName = getComponentName(focusPath);
        if (componentName in components) {
            components[componentName].arguments.forEach(arg => {
                if (!results.filter(({label})=>label === arg.name)) {
                    results.push({
                        label: arg.name,
                        kind: 5,
                        detail: arg.description
                    });
                }
            });
        }

    }

    return results;
}

module.exports.onComplete = onComplete;