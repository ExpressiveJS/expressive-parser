'use strict'

const parserName = 'esprima'
const parser = require(parserName)

module.exports = function parseRoutes(routerObj, cfg, routePath) {
  if (!cfg || cfg.verbs)
    cfg = { verbs: { create: 'create', read: 'read', update: 'update', delete: 'delete', list: 'list' } }

  let parsedRoutes = []

  for (let routerProp of Object.keys(routerObj)) {
    const routeObj = routerObj[routerProp]

    // Recurse into route object if needed (for nested routes)
    if (typeof routeObj == 'object' && !Array.isArray(routeObj)) {
      let recursePath = routerProp
      if (routePath)
        recursePath = `${routePath}.${routerProp}`

      parsedRoutes = parsedRoutes.concat(parseRoutes(routeObj, cfg, recursePath))
      continue
    }

    // Parse route function
    if (typeof routeObj == 'function') {
      const route = parseRoute(routePath, routerObj, routerProp, routeObj, cfg)
      parsedRoutes.push(route)
    }
  }

  return parsedRoutes
}

function parseRoute(routePath, routeObj, routeName, routeFunc, cfg) {

  let route = {
    path: routePath,
    params: paramsForFunction(routeFunc),
    type: routeName,
  }

  // Destructure function params from an object.
  route.fn = routeFunction(route, routeFunc)

  switch (route.type) {
    case cfg.verbs.create: break
    case cfg.verbs.read: break
    case cfg.verbs.update: break
    case cfg.verbs.delete: break
    case cfg.verbs.list: break

    default:
      route.type = 'all'

      // Handle route path names that are only a function
      if (!routeObj.fn)
        if (!route.path)
          route.path = routeName
        else
          route.path += `.${routeName}`

  }

  return route
}

function paramsForFunction(func) {
  try {
    const ast = parser.parse(`(\n ${func.toString()} \n)`)
    const program = parserName == 'babylon' ? ast.program : ast

    return program
      .body[0]
      .expression
      .params
      .map(paramsForNode)
      .filter(param => param !== 'callback')
  } catch (e) {
    console.log(e)
    return []
  }
}

function paramsForNode(node) {
  const maybe = function (x) {
    return x || {} // optionals support
  }

  if (node.right && node.right.type == 'Literal') {
    // Destructure only if string begins with '...' otherwise, it's likely an intentional default.
    if (typeof node.right.value == 'string' && node.right.value.startsWith('...'))
      return node.right.value
  }

  return node.name || maybe(node.left).name || '...' + maybe(node.argument).name
}

function getPropertyFromObject(propertyName, object) {
  const parts = propertyName.split('.')
  const length = parts.length
  let property = object

  for (let i = 0; i < length; i++ ) {
    property = property[parts[i]]
  }

  return property
}

function routeFunction(route, routeObj) {
  return function(context, paramsObj, callback) {
    let params = []

    for (let param of route.params) {
      // Destructure only if string begins with '...' otherwise, it's likely an intentional default. Also, set the default value to null to keep Params order.
      if (param.startsWith('...')) {

        param = param.substring(3)

        const paramValue = getPropertyFromObject(param, paramsObj)
        if (!paramValue)
          params.push(null)
        else
          params.push(paramValue)

      } else {

        const paramValue = getPropertyFromObject(param, paramsObj)
        if (!paramValue)
          params.push(undefined)
        else
          params.push(paramValue)

      }
    }

    params.push(callback)
    routeObj.apply(context, params)
  }
}
