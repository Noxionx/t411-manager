# T411 - Manager
Handles api calls to search torrents and other stuff...

## Creation
```javascript
var T411Manager = require('t411-manager'),
    t411client = new T411Manager({
        username : "username",
        password : "password"
        //or
        token : "token"
    });
```

## Methods
The module uses [q library](https://github.com/kriskowal/q) for promises.

### isConnected()
__Return__ _true_ if the user is connected

### getToken()
Example :
```javascript
t411client.getToken().then(function(token){
    console.log(token); //print your token
});
```

### getCategorySize(cid)
Example :
```javascript
t411client.getCategorySize(634).then(function(size){
    console.log(size); //print 26089
});
```

### getCategoryTree()
Example :
```javascript
t411client.getCategoryTree().then(function(tree){
    console.log(tree); //print category tree
});
```

### getCategoryList()
Example :
```javascript
t411client.getCategoryList().then(function(list){
    console.log(list); //print the list of all ids
});
```

### getTorrents(searchParams)
Example :
```javascript
var searchParams = {
    query: 'avatar',
    limit: 10
};
t411client.getTorrents(searchParams).then(function(torrents){
    torrents.forEach(function(torrent){
        console.log(torrent); //print each torrent (10) for the search query 'avatar'
    });
});
```

Another example :
```javascript
var searchParams = {
    cid: 634,
    limit: 10,
    offset: 30
};
t411client.getTorrents(searchParams).then(function(torrents){
    torrents.forEach(function(torrent){
        console.log(torrent); //print each torrent (10) of the third page of documentaries
    });
});
```