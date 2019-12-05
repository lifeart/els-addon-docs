const fetch = require("node-fetch");

const { normalizeComponents } = require("./normalizers");

function demoUrl(pack) {
  return pack["ember-addon"].demoURL;
}
function addonName(pack) {
  return pack["name"];
}

function hasDemoUrl(pack) {
  return (
    pack["ember-addon"] &&
    typeof pack["ember-addon"].demoUrl === "string" &&
    pack["ember-addon"].demoUrl.length
  );
}

module.exports.makeAddonUrl = function makeAddonUrl(el) {
  if (hasDemoUrl(el)) {
    return [addonName(el), demoUrl(el)];
  } else if (el.homepage) {
    return [addonName(el), el.homepage];
  } else {
    return null;
  }
};

async function getAddonDocs(packageName, demoURL) {
  const result = await fetch(`${demoURL}/docs/${packageName}.json`);
  const data = await result.json();
  return data;
}

module.exports.loadCompletions = async function loadCompletions(addons) {
  /* 
          this implementation just draft,
          we should cache it
      */
  const mapper = async ([org, repo]) => {
    let result = {
      included: []
    };
    try {
      result = await getAddonDocs(org, repo);
    } catch (e) {
      console.error(e.stack);
    }
    return result;
  };
  const queries = addons.map(mapper);
  const data = await Promise.all(queries);
  const addonsResults = data.map(info => normalizeComponents(info));
  const results = [].concat(addonsResults);
  return Object.assign.apply({}, results);
};
