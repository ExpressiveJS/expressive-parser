'use strict'

const parserName = 'esprima'
const parser = require(parserName)

let authRoutes = {}

module.exports = function parseRoutes(routerObj, cfg, routePath) {
  if (!cfg || !cfg.verbs)
    cfg = { verbs: { create: 'create', read: 'read', update: 'update', delete: 'delete', list: 'list', auth: 'auth' } }

  // FIXME: cfg = configFromObj() // Currently it's an all or nothing.
  cfg.verbs.auth = 'auth'

  let parsedRoutes = []

  for (let routerProp of Object.keys(routerObj)) {
    const routeObj = routerObj[routerProp]

    // Parse auth object
    if (routerProp && routerProp == cfg.verbs.auth) {
      const route = parseAuthRoute(routePath, routeObj, cfg)
      if (!route)
        continue

      authRoutes[route.path] = route

      // NOTE: Protocol might want to do some special processing, feedback requested.
      parsedRoutes.push(route)
      continue
    }

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
      if (route)
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

  return node.name || maybe(node.left).name || `...${maybe(node.argument).name}`
}

function getPropertyFromObject(propertyName, object) {
  const parts = propertyName.split('.')
  let property = object

  for (let part of parts ) {
    if (!property[part])
      return null

    property = property[part]
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

    // No auth function available, so run route function
    if (!authRoutes[route.path] || !authRoutes[route.path].fn) {
      params.push(callback)
      routeObj.apply(context, params)
      return
    }

    // Filter specified but does not contain this route, skip auth function
    if (authRoutes[route.path].filter && !authRoutes[route.path].filter.includes(routeObj.name)) {
      params.push(callback)
      routeObj.apply(context, params)
      return
    }

    // Run auth function
    authRoutes[route.path].fn.apply(context, [(err) => {
      if (err)
        return callback(err)

      params.push(callback)
      routeObj.apply(context, params)
    }])
  }
}

function parseAuthRoute(routePath, routeObj, cfg) {
  if (typeof routeObj == 'function') {

    const route = { path: routePath, fn: routeObj, type: cfg.verbs.auth }
    return route

  } else if (typeof routeObj == 'object' && !Array.isArray(routeObj)) {

    if (!routeObj.filter || !Array.isArray(routeObj.filter) || !routeObj.fn) {
      console.log('[WARN]: Improper Auth function structure')
      return undefined
    }

    Object.defineProperty(routeObj.fn, 'name', { value: 'auth' })
    const route = { path: routePath, fn: routeObj.fn, filter: [], type: cfg.verbs.auth }

    for (let filterFn of routeObj.filter) {
      if (typeof filterFn === 'function') {
        route.filter.push(filterFn.name)
      } else if (typeof filterFn === 'string') {
        route.filter.push(filterFn)
      }
    }

    return route
  }

  console.log('[WARN]: Improper Auth function structure')
  return undefined
}
