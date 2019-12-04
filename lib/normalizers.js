
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

export function normalizeComponents(rawItems) {
    let items = extractComponentInfo(rawItems);
    return items.reduce((result, item)=>{
        let data = normalizeComponentInfo(item);
        result[data.name] = data;
        return result;
    }, {});
}
