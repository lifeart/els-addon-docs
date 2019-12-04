import fetch from 'node-fetch';

async function getAddonDocs(org, repo) {
    const result = await fetch(`https://${org}.github.io/${repo}/docs/${repo}.json`);
    const data = await result.toJSON();
    return data;
}

function normalizeDescription(str) {
    return str;
}

function normalizeFields(fields) {
    return fields.reduce((result, field)=>{
        if (field.access !== 'public') {
            return result;
        }
        let data = Object.assign({}, field);
        data.description = normalizeDescription(data.description);
        result.push(data);
        return result;
    }, []);
}

function normalizeComponentInfo({attributes}) {
    const { name, description, fields, methods } = attributes;
    const result = {
        name,
        description: normalizeDescription(description),
        arguments: Object.assign({}, normalizeFields(fields), normalizeFields(methods))
    }
    return result;
}

function extractComponentInfo(raw) {
    return raw.included.filter((item)=>item.type === 'component' && item.attributes.access === 'public');
}

function normalizeComponents(items) {
    return items.reduce((result, item)=>{
        let data = normalizeComponentInfo(item);
        result[data.name] = data;
        return result;
    }, {});
}

function isComponent(focusPath) {
    return focusPath.node.type === 'ElementNode';
}

function getComponentName(focusPath) {
    return focusPath.node.tag;
}

async function loadCompletions() {
    const data = await getAddonDocs('miguelcobain', 'ember-yeti-table');
    const components = normalizeComponents(extractComponentInfo(data));
    return components;
}

function isComponentArgument(focusPath) {
    if (focusPath.node.type === "AttrNode") {
      return focusPath.node.name.startsWith("@");
    }
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