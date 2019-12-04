const fetch = require('node-fetch');
const { isComponent, getComponentName, isComponentArgument } = require('./lib/ast-helpers');
const { normalizeComponents } = require('./lib/normalizers');
const { URI } = require('vscode-uri');

async function getAddonDocs(org, repo) {
    const result = await fetch(`https://${org}.github.io/${repo}/docs/${repo}.json`);
    const data = await result.json();
    return data;
}

async function loadCompletions(addons) {
    /* 
        this implementation just draft,
        we should cache it
    */
    const mapper = async ([org, repo])=> await getAddonDocs(org, repo);
    const queries = addons.map(mapper);
    const data = await Promise.all(queries);
    const addonsResults = data.map((info)=>normalizeComponents(info));
    const results = [].concat(addonsResults);
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
        ['shipshapecode', 'ember-flatpickr'],
        ['adopted-ember-addons', 'ember-autoresize'],
        ['adopted-ember-addons', 'ember-file-upload'],
        ['addepar', 'ember-table'],
        ['miguelcobain', 'ember-yeti-table'],
        ['patricklx', 'carbon-components-ember']
    ];
}

async function onComplete(root,{ results, focusPath, type }) {
	console.log('onComplete', root);
    if (type !== 'template') {
        return results;
    }
    const projectRoot = URI.parse(root).fsPath;
	const addons = await findProjectAddonsWithDocs(projectRoot);
	const components = await loadCompletions(addons);
    if (isComponent(focusPath)) {
        Object.keys(components).forEach((name) => {
            if (!results.find(({label})=>label === name)) {
                results.push({
                    label: name, 
					detail: components[name].description,
					documentation: components[name].description,
                    kind: 7
                })
            }
        })
    } else if (isComponentArgument(focusPath)) {
		const componentName = getComponentName(focusPath);
        if (componentName in components) {
            components[componentName].arguments.forEach(arg => {
                if (!results.find(({label})=>label === arg.name)) {
                    results.push({
                        label: '@' + arg.name,
                        kind: 5,
                        detail: arg.description,
                        documentation: arg.documentation
                    });
                }
            });
        }

	}
	
	console.log('results', results);

    return results;
}

module.exports.onComplete = onComplete;