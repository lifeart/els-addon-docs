import fetch from 'node-fetch';
import { isComponent, getComponentName, isComponentArgument } from './lib/ast-helpers';
import { normalizeComponents } from './lib/normalizers';

async function getAddonDocs(org, repo) {
    const result = await fetch(`https://${org}.github.io/${repo}/docs/${repo}.json`);
    const data = await result.toJSON();
    return data;
}

async function loadCompletions() {
    const data = await getAddonDocs('miguelcobain', 'ember-yeti-table');
    return normalizeComponents(data);
}

async function onComplete(_,{ results, focusPath, type }) {
    if (type !== 'template') {
        return results;
    }
    const components = await loadCompletions();
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