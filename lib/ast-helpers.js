module.exports.isComponent = function isComponent(focusPath) {
  return focusPath.node.type === "ElementNode";
};

module.exports.getComponentName = function getComponentName(focusPath) {
  return focusPath.parent.tag;
};

module.exports.isComponentArgument = function isComponentArgument(focusPath) {
  if (focusPath.node.type === "AttrNode") {
    return focusPath.node.name.startsWith("@");
  }
};

function hasNodeType(node, type) {
  if (!node) {
    return false;
  }
  return node.type === type;
}

function isPathExpression(node) {
  return hasNodeType(node, "PathExpression");
}

module.exports.isScopedPathExpression = function isScopedPathExpression(path) {
  return (
    isPathExpression(path.node) &&
    path.node.this === false &&
    path.node.data === false
  );
};
