
const html2md = require('html-to-md');
const TurndownService = require('turndown')
const turndownService = new TurndownService();

function normalizeDescription(str) {
	let result = str;
	try {
		result = html2md(str).trim();
	} catch(e) {
        try {
            result = turndownService.turndown(str).trim();
        } catch(e) {

        }
	}
    return result;
}

function normalizeFields(fields) {
	if (!Array.isArray(fields)) {
		return [];
	}
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

function normalizeYield(yieldItem) {
    // 6 - variable
    // 7 - class
    // object, boolean, array, number
    const kindForType = {
        Component: 7,
        object: 9,
        array: 9,
        number: 9,
        boolean: 14,
    }
    return {
        label: yieldItem.name,
        detail: normalizeDescription(yieldItem.description),
        kind: kindForType[yieldItem.type] || 6
    }
}

function normalizeComponentInfo({attributes}) {
    const { name, description, fields, methods } = attributes;
    const result = {
        name,
        yields: (attributes.yields || []).map(el=>normalizeYield(el)),
        description: normalizeDescription(description),
        arguments: [...normalizeFields(fields), ...normalizeFields(methods), ...normalizeFields(attributes.arguments)]
    }
    return result;
}

function extractComponentInfo(raw) {
    if (!raw || !raw.included) {
        return [];
    }
    return raw.included.filter((item)=>item.type === 'component' && item.attributes && item.attributes.access === 'public');
}

module.exports.normalizeComponents = function normalizeComponents(rawItems) {
    let items = extractComponentInfo(rawItems);
    return items.reduce((result, item)=>{
        let data = normalizeComponentInfo(item);
        result[data.name] = data;
        return result;
    }, {});
}
