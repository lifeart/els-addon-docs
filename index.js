const fetch = require('node-fetch');
const { isComponent, getComponentName, isComponentArgument } = require('./lib/ast-helpers');
const { normalizeComponents } = require('./lib/normalizers');
const { URI } = require('vscode-uri');

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
        check if `ember-addon.demoURL` exists for such project
        if exists - return the project name together with the value of `ember-addon.demoURL`.

        I beleve we can cache it for projectRoot
    */
    return [
        ['ember-flatpickr', 'https://shipshapecode.github.io/ember-flatpickr'],
        ['ember-autoresize', 'http://tim-evans.github.io/ember-autoresize/'],
        ['ember-file-upload', 'https://adopted-ember-addons.github.io/ember-file-upload/'],
        ['ember-yeti-table', 'https://miguelcobain.github.io/ember-yeti-table'],
        // addons above are missing `ember-addon.demoURL` key, should fix upstream
        ['ember-table', 'https://opensource.addepar.com/ember-table/'],
        ['carbon-components-ember', 'https://patricklx.github.io/carbon-components-ember/']
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
