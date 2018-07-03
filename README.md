# expressive-parser
Parse a raw javascript Object into a formatted routes object. (Used in Expressive and tools)

### Example: ###
      
    const routes = {
      root: {
        read: function(callback) {
          callback(null, 'index page')
        },
      },
    
      users: {
        create: function(user, callback) {},
        read: function(userId = '...user.id', callback) {},
      },
    }

    const parser = require('expressive-parser')
    const router = parser(routes)

### Output: ###
    [ { path: 'root', params: [], type: 'read', fn: [Function] },
      { path: 'users',
        params: [ 'user' ],
        type: 'create',
        fn: [Function] },
      { path: 'users',
        params: [ '...user.id' ],
        type: 'read',
        fn: [Function] } ]
    
<br>

### Custom terms: ###

    const terms = {
      verbs: {
        create: 'post',
        read: 'get',
        update: 'put',
        delete: 'delete',
        list: 'options',
      }
    }

    const routes = {
      root: {
        get: function(callback) {
          callback(null, 'index page')
        },
      },
    
      users: {
        post: function(user, callback) {},
        get: function(userId = '...user.id', callback) {},
      },
    }

    const router = parser(routes, terms)

### Output: ###

    [ { path: 'root', params: [], type: 'get', fn: [Function] },
      { path: 'users',
        params: [ 'user' ],
        type: 'post',
        fn: [Function] },
      { path: 'users',
        params: [ '...user.id' ],
        type: 'get',
        fn: [Function] } ]
