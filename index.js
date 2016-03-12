var request = require("request")
var Q = require('q')

var API_HOST = "https://api.t411.ch"

function T411Manager(options){
    var that = this

    var deferred = Q.defer()
    that._tokenPromise = deferred.promise

    if(!options.username && !options.token){
        throw new Error('Missing t411 username !')
    }
    if(!options.password && !options.token){
        throw new Error('Missing t411 password !')
    }
    if(options.token){
        that._token = options.token
        deferred.resolve()
    }
    else{
        that.getUserToken(options.username, options.password).then(function(token){
            that._token = token
            deferred.resolve()
        }, function(e){
            deferred.reject(e)
        })
    }
}

T411Manager.prototype = {
    getUserToken: function(username, password){
        var deferred = Q.defer()

        var postData = {
            "username" : username,
            "password" : password
        }
        request.post({url: (API_HOST+'/auth'), form: postData}, function(err,httpResponse,body){
            if(err){
                deferred.reject('Api error : '+ err)
            }
            else{
                try{
                    var jsonBody = JSON.parse(body)
                    if(jsonBody['token']){
                        deferred.resolve(jsonBody['token'])
                    }
                    else{
                        deferred.reject('Wrong credentials')
                    }
                }
                catch(e){
                    deferred.reject('Api error : '+ (body || httpResponse.statusCode + ' - ' + httpResponse.statusMessage))
                }
            }
        })

        return deferred.promise
    },
    isConnected: function(){
        return !!this._token
    },
    getCategorySize: function(cid){
        var deferred = Q.defer(),
            that = this

        that._tokenPromise.then(function(){
            if(!cid){
                deferred.reject(new Error('Missing category id parameter'))
            }
            else{
                var url = API_HOST+
                    '/torrents/search/'+
                    "&cid="+cid+
                    "&limit=1"
                request.get({url: url, headers: {'Authorization':that._token}}, function(err,httpResponse,body){
                    if(err){
                        deferred.reject(err)
                    }
                    else{
                        try{
                            var bodyLines   = body.split('\n')
                            var reqResult   = JSON.parse((bodyLines.length>0)?bodyLines[3]:bodyLines[0])
                            var nbTorrents  = reqResult.total?parseInt(reqResult.total):0;
                            deferred.resolve(nbTorrents)
                        }
                        catch(e){
                            deferred.reject('Error while parsing body')
                        }
                    }
                })
            }
        }, deferred.reject)

        return deferred.promise
    },
    getCategoryTree: function(){
        var deferred = Q.defer(),
            that = this

        that._tokenPromise.then(function() {
            request.get({
                url: (API_HOST + '/categories/tree'),
                headers: {'Authorization': that._token}
            }, function (err, httpResponse, body) {
                if (err) {
                    deferred.reject(err)
                }
                else {
                    try{
                        var jsonBody = JSON.parse(body)
                        deferred.resolve(jsonBody)
                    }
                    catch (e){
                        deferred.reject('Error while parsing body')
                    }
                }
            })
        }, deferred.reject)

        return deferred.promise
    },
    getCategoryList: function(){
        return this.getCategoryTree().then(function(tree){
            var cids = []
            for (var pid in tree) {
                if (tree[pid].hasOwnProperty("cats")) {
                    for (var cid in tree[pid].cats) {
                        cids.push(cid)
                    }
                }
            }
            return cids
        })
    },
    getTorrents: function(searchParams){
        var deferred = Q.defer(),
            that = this

        that._tokenPromise.then(function() {
            var url = API_HOST+
                '/torrents/search/'+
                (!!searchParams && searchParams.query?searchParams.query:'')+
                (!!searchParams && searchParams.cid?"&cid="+searchParams.cid:'')+
                (!!searchParams && searchParams.limit?"&limit="+searchParams.limit:"&limit=100")+
                (!!searchParams && searchParams.offset?"&offset="+searchParams.offset:'')
            request.get({url: url, headers: {'Authorization':that._token}}, function(err,httpResponse,body){
                if(err){
                    deferred.reject(err)
                }
                else{
                    try{
                        var processedTorrents = []
                        var bodyLines   = body.split('\n')
                        var strResult = (bodyLines.length>0)?bodyLines[3]:bodyLines[0]
                        if(!(/[^,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]/.test(strResult.replace(/"(\\.|[^"\\])*"/g,'')))){
                            var reqResult   = JSON.parse(strResult)
                            var torrents = reqResult.torrents?reqResult.torrents:[]
                            torrents.forEach(function(elt){
                                if(isNaN(elt)){
                                    processedTorrents.push(elt)
                                }
                            })
                        }
                        deferred.resolve(processedTorrents)
                    }
                    catch (e){
                        deferred.reject('Error while parsing body')
                    }
                }
            })
        }, deferred.reject)

        return deferred.promise
    }
}

module.exports = T411Manager