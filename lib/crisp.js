const Crisp   = require("node-crisp-api");
const fs      = require("fs");
const https   = require("https");

const Store   = require("./store");

// Plugin Controller constructors
const Controllers = {
  Export  : function(){ this._controller = "export"; }, 
  Data    : function(){ this._controller = "data"; }, 
  Config  : function(){ this._controller = "config";}
};

/**
 * 
 * @class
 * @classdesc This is the Export plugin class
 * @param {string} pluginUrn 
 * @param {string} crispAPIIdentifier 
 * @param {string} crispAPIKey 
 */
function CrispManager(pluginUrn, crispAPIIdentifier, crispAPIKey){
  this.crispClient        = new Crisp();
  Store.buckets           = new Map();
  
  this.pluginUrn          = pluginUrn;
  this.crispAPIIdentifier = crispAPIIdentifier;
  this.crispAPIKey        = crispAPIKey;

  this._initPlugin();
}

CrispManager.prototype = {

  /**
   * 
   * @memberof ExportTranscript
   * @method _initPlugin
   * @private
   */
  _initPlugin : function(){
    this.crispClient.authenticateTier(
      "plugin", this.crispAPIIdentifier, this.crispAPIKey
    );

    // get pluginId for later use.
    this.crispClient.plugin.getConnectAccount()
      .then(response => {
        this._pluginId = response.plugin_id;

        console.log(`Successfully retrieved plugin ID: ${this._pluginId}`);
      })
      .catch(err => {
        console.error(err);
      });
    // Retrieve all websites connected to this plugin.
    // Notice #1: we only retrieve the first page there, you should implement \
    //   paging to the end, in a real-world situation.
    // Notice #2: return configured + non-configured plugins altogether.
    this.crispClient.plugin.listAllConnectWebsites(1, false)
      .then(websites => {
        let numWebsites = (websites || []).length;

        if(numWebsites === 0 ){
          console.error(
            "No websites connected to this plugin."
          );
        } else {
          for(const website of websites){
            const file_name         = website.settings.fileName || "transcript";
            const _selectedWebsiteId = website.settings.selectedWebsiteId;
            const _selectedSessionId = website.settings.selectedSessionId;
            const _selectedNickname  = website.settings.selectedNickname;

          
            // console.log(Store.websites);
            Store.websites[website.website_id] = {
              token              : website.token,
              fileName           : file_name, 
              selectedWebsiteId  : _selectedWebsiteId,
              selectedSessionId  : _selectedSessionId,
              selectedNickname   : _selectedNickname
            };
          }

          console.log(`Retrieved ${numWebsites} websites.`);
          console.log("Website configutations: ");
          console.log(Store.websites);

          this._events();
        }
      })
      .catch(err => {
        console.error(err);
      });

    this._prepareControllers("export");

  },

  /**
   * @memberof ExportTranscript
   * @method _events
   * @private
   */
  _events : function() {
    const self = this;

    this.crispClient.on("bucket:url:upload:generated", (bucket) => {

      const file_name      = Store.buckets.get(bucket.id);
      const website_id     = bucket.id.slice(11, 47 );
      const session_id     = bucket.id.slice(48, 92);
      const readableStream = fs.createReadStream(`${__dirname}/../tmp/${file_name}.txt`);

      readableStream.on("data", (chunk) => {
        const options = {
          host    : "storage.crisp.chat",
          path    : bucket.url.signed,
          method  : "PUT",
          headers : {
            "Content-Type"  : "text/plain",
            "Content-Length": chunk.length
          }
        };
        
        const req = https.request(options, res => {
          res.on("data", d => {
            process.stdout.write(d);
          });
        });
  
        req.on("error", error => {
          console.error(error);
        });
  
        req.write(chunk);
        req.end(() => {
          const message = {
            "type"    : "file",
            "from"    : "operator",
            "origin"  : "chat",
            "content" : {
              "name"    : `${file_name}.txt`,
              "url"     : bucket.url.resource,
              "type"    : "text/plain"
            },
            "user"    : {
              "type"    : "website",
              "nickname": "Transcript Plugin",
              "avatar"  : "https://storage.crisp.chat/users/avatar/website/754190078c1a2c00/crisp_64lksp.png"
            }
          };

          self.crispClient.website.sendMessageInConversation(
            website_id, 
            session_id, 
            message
          )
            .then(() => {
              fs.unlink(
                `${__dirname}/../tmp/${file_name}.txt`, 
                
                (res) => {
                  if(res){
                    console.log(`Deleted: ${res} `);
                  }
                }
              );
              
              Store.buckets.delete(bucket.id);

            })
            .catch(err => {
              console.error(err);
            });
        });
      });
    });

    console.info("Now listening for events...");
  },


  /**
   * @memberof ExportTranscript
   * @method _prepareControllers
   * @private
   */
  _prepareControllers : function(){
    for (let controller in Controllers){
      let controllerInstant = new Controllers[controller]();

      this[controller] = controllerInstant;
       
      const controllerConstructor = require(`./controllers/${controllerInstant._controller}`);
  
      new controllerConstructor(controllerInstant ,this);
    }

  }

};

module.exports = CrispManager;