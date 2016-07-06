var request = require("request");
var Q = require('q');
var fs = require('fs');

var API_HOST = "https://api.t411.ch";


function T411Manager(options){
    var that = this;

    var deferred = Q.defer();
    that._tokenPromise = deferred.promise;

    options = options || {}
    if(!options.username && !options.token){
        throw new Error('Missing t411 username !');
    }
    if(!options.password && !options.token){
        throw new Error('Missing t411 password !');
    }
    if(options.token){
        that._token = options.token;
        deferred.resolve();
    }
    else{
        _getUserToken(options.username, options.password).then(function(token){
            that._token = token;
            deferred.resolve();
        }, function(e){
            deferred.reject(e);
        });
    }
}

function Torrent(data){
    this.id = data.id;
    this.name = data.name;
    this.category = !isNaN(parseInt(data.category))? parseInt(data.category):0;
    this.seeders = !isNaN(parseInt(data.seeders))? parseInt(data.seeders):0;
    this.leechers = !isNaN(parseInt(data.leechers))? parseInt(data.leechers):0;
    this.comments = !isNaN(parseInt(data.comments))? parseInt(data.comments):0;
    this.isVerified = !!data.isVerified;
    this.added = new Date(data.added);
    this.size = !isNaN(parseInt(data.size))? parseInt(data.size):0;
    this.times_completed = !isNaN(parseInt(data.times_completed))? parseInt(data.times_completed):0;
    this.owner = data.owner;
    this.categoryname = data.categoryname;
    this.categoryimage = data.categoryimage;
    this.username = data.username;
    this.privacy = data.privacy;
}

/**
 * Get the user token
 * @param username {String} T411 username
 * @param password {String} T411 password
 * @returns {Q.Promise<String>} The user token
 * @private
 */
function _getUserToken(username, password){
    var deferred = Q.defer();

    var postData = {
        "username" : username,
        "password" : password
    };
    request.post({url: (API_HOST+'/auth'), form: postData}, function(err,httpResponse,body){
        if(err){
            deferred.reject('Api error : '+ err);
        }
        else{
            try{
                var jsonBody = JSON.parse(body);
                if(jsonBody['token']){
                    deferred.resolve(jsonBody['token']);
                }
                else{
                    deferred.reject('Wrong credentials');
                }
            }
            catch(e){
                deferred.reject('Api error : '+ (body || httpResponse.statusCode + ' - ' + httpResponse['statusMessage']));
            }
        }
    });

    return deferred.promise;
}

T411Manager.prototype = {
    /**
     * Indicate if the user is connected
     * @returns {boolean} True if connected
     */
    isConnected: function(){
        return !!this._token;
    },
    /**
     * Get the saved token (if connected)
     * @returns {Q.Promise<String>} The token
     */
    getToken : function(){
        var that = this;
        return that._tokenPromise.then(function(){
            return that._token;
        });
    },
    /**
     * Get the size of a category
     * @param cid {Number} The category id
     * @returns {Q.Promise<Number>} The amount of torrents in the category
     */
    getCategorySize: function(cid){
        var deferred = Q.defer(),
            that = this;

        that._tokenPromise.then(function(){
            if(!cid){
                deferred.reject(new Error('Missing category id parameter'));
            }
            else{
                var url = API_HOST+
                    '/torrents/search/'+
                    "&cid="+cid+
                    "&limit=1";
                request.get({url: url, headers: {'Authorization':that._token}}, function(err,httpResponse,body){
                    if(err){
                        deferred.reject(err);
                    }
                    else{
                        try{
                            var bodyLines   = body.split('\n');
                            var reqResult   = JSON.parse((bodyLines.length>0)?bodyLines[3]:bodyLines[0]);
                            var nbTorrents  = reqResult.total?parseInt(reqResult.total):0;
                            deferred.resolve(nbTorrents);
                        }
                        catch(e){
                            deferred.reject('Error while parsing body');
                        }
                    }
                });
            }
        }, deferred.reject);

        return deferred.promise;
    },
    /**
     * Get the category tree from the original api
     * @returns {Q.Promise<Object>} The category tree
     */
    getCategoryTree: function(){
        var deferred = Q.defer(),
            that = this;

        that._tokenPromise.then(function() {
            request.get({
                url: (API_HOST + '/categories/tree'),
                headers: {'Authorization': that._token}
            }, function (err, httpResponse, body) {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    try{
                        var jsonBody = JSON.parse(body);
                        deferred.resolve(jsonBody);
                    }
                    catch (e){
                        deferred.reject('Error while parsing body');
                    }
                }
            });
        }, deferred.reject);

        return deferred.promise;
    },
    /**
     * Get the list of all category ids
     * @returns {Q.Promise<Array>} The list of category ids
     */
    getCategoryList: function(){
        return this.getCategoryTree().then(function(tree){
            var cids = [];
            for (var pid in tree) {
                if (tree.hasOwnProperty(pid) && tree[pid].hasOwnProperty("cats")) {
                    for (var cid in tree[pid]['cats']) {
                        if(tree[pid]['cats'].hasOwnProperty(cid)){
                            cids.push(cid);
                        }
                    }
                }
            }
            return cids;
        });
    },
    /**
     * Get the list of torrents
     * @param searchParams {Object} The list of params
     * @param searchParams.query {String} The search query
     * @param searchParams.cid {Number | Number[]} The category(s) to search in
     * @param searchParams.limit {Number} The number of torrents to fetch
     * @param searchParams.offset {Number} The offset
     * @returns {Q.Promise<Array>} The list of found torrents
     */
    getTorrents: function(searchParams){
        var deferred = Q.defer(),
            that = this;

        that._tokenPromise.then(function() {
            var url = API_HOST+
                '/torrents/search/'+
                (!!searchParams && searchParams.query?searchParams.query:'')+
                (!!searchParams && searchParams.cid?"&cid="+searchParams.cid:'')+
                (!!searchParams && searchParams.limit?"&limit="+searchParams.limit:"&limit=100")+
                (!!searchParams && searchParams.offset?"&offset="+searchParams.offset:'');
            request.get({url: url, headers: {'Authorization':that._token}}, function(err,httpResponse,body){
                if(err){
                    deferred.reject(err);
                }
                else{
                    try{
                        var processedTorrents = [];
                        var bodyLines = body.split('\n');
                        var strResult = (bodyLines.length>1)?bodyLines[3]:bodyLines[0];
                        if(!(/[^,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]/.test(strResult.replace(/"(\\.|[^"\\])*"/g,'')))){
                            var reqResult   = JSON.parse(strResult);
                            var torrents = reqResult['torrents']?reqResult['torrents']:[];
                            torrents.forEach(function(elt){
                                if(isNaN(elt)){
                                    processedTorrents.push(new Torrent(elt));
                                }
                            })
                        }
                        deferred.resolve(processedTorrents);
                    }
                    catch (e){
                        deferred.reject('Error while parsing body');
                    }
                }
            })
        }, deferred.reject);

        return deferred.promise;
    },

    saveTorrent: function(id, filename){
        var deferred = Q.defer(),
            that = this;

        that._tokenPromise.then(function() {
            var url = API_HOST + '/torrents/download/' + id;
            request.get({url: url, headers: {'Authorization':that._token}})
                .on('response', function(response) {
                    deferred.resolve(response.statusCode);
                })
                .on('error', function(err){
                    deferred.reject(err);
                })
                .pipe(fs.createWriteStream(filename));
        });
    }
};

T411Manager.prototype.Torrent = Torrent

module.exports = T411Manager;