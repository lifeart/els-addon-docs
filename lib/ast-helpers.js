export function isComponent(focusPath) {
    return focusPath.node.type === 'ElementNode';
}

export function getComponentName(focusPath) {
    return focusPath.node.tag;
}

export function isComponentArgument(focusPath) {
    if (focusPath.node.type === "AttrNode") {
      return focusPath.node.name.startsWith("@");
    }
}