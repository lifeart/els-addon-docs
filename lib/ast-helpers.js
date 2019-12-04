module.exports.isComponent = function isComponent(focusPath) {
    return focusPath.node.type === 'ElementNode';
}

module.exports.getComponentName = function getComponentName(focusPath) {
    return focusPath.parent.tag;
}

module.exports.isComponentArgument = function isComponentArgument(focusPath) {
    if (focusPath.node.type === "AttrNode") {
      return focusPath.node.name.startsWith("@");
    }
}