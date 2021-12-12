const Crisp        = require("node-crisp-api");
const https        = require("https");
const path         = require("path");
const fs           = require("fs");


class ExportChat {
  constructor(pluginUrn, crispAPIIdentifier, crispAPIKey) {
    this.crispClient = new Crisp();
    this.websites    = new Map();
    this.buckets     = new Map();
    
    this.pluginUrn          = pluginUrn;
    this.crispAPIIdentifier = crispAPIIdentifier;
    this.crispAPIKey        = crispAPIKey;

    this._initPlugin();
  }

  // Display the config page. 
  getConfigPage(websiteId, token, res){
    this._validateTokens(websiteId, token)
      .then(() => {
        // fn = filename 
        let filename    = this.websites[websiteId].fileName;
        let fnWebsiteId = this.websites[websiteId].fnWebsiteId ? "checked" : "";
        let fnSessionId = this.websites[websiteId].fnSessionId ? "checked" : "";
        let fnNickname  = this.websites[websiteId].fnNickname ? "checked" : "";
        let fnExample   = filename;

        if(fnWebsiteId === "checked"){
          fnExample = `${fnExample}_${websiteId}`;
        }
        if(fnSessionId === "checked"){
          fnExample = `${fnExample}_session_bbf82712-2602-468e-9c51-af054aaee873`;
        }
        if(fnNickname === "checked"){
          fnExample = `${fnExample}_John Doe`;
        }
    
        return res.render("config/config", {
          pageTitle   : "Export Configuration", 
          filename    : filename,
          fnWebsiteId : fnWebsiteId,
          fnSessionId : fnSessionId,
          fnNickname  : fnNickname,
          fnExample   : fnExample
        });
      })
      .catch(err => console.log(err));
  }

  // Update the format of the filename when sending the transcript
  updateFilenameForTranscript(websiteId, token, data) {
    this._validateTokens(websiteId, token)
      .then(() => {
        const settings = {
          fileName   : data.fileName,
          fnWebsiteId  : data.fnWebsiteId,
          fnSessionId  : data.fnSessionId,
          fnNickname   : data.fnNickname,
        };
        this.crispClient.plugin.updateSubscriptionSettings(
          websiteId,
          this._pluginId,
          settings
        );
      })
      .then(() => {
        this.websites[websiteId] = { 
          token      : token,
          fileName   : data.fileName,
          fnWebsiteId  : data.fnWebsiteId,
          fnSessionId  : data.fnSessionId,
          fnNickname   : data.fnNickname,
        };

        console.log(
          `Successfully updated plugin config for website ID: ${websiteId}`
        );
      })
      .catch(error => {
        console.error(error);
      });
  }

  // Get conversation between two specified dates and/or time
  getConversationBetween(website_id, session_id, data){
    const token           = data.token;

    this._validateTokens(website_id, token)
      .then(() => {
        // valid start date and time when messages should be sent from
        if(!data.messagesFrom){
          const error = {
            reason: "Action requires a 'message from' date!",
            data  : { 
              "messagesFrom": data.messagesFrom
            }
          };
          const message = `
            Please insert a valid time and date of when you would like to export 
            messages from. \n\n If you would like to export all messages in this 
            Conversation, please select **"Send Entire Conversation"** . 
            `;
    
          return this._sendErrorNote(website_id, session_id, message, error);
        }
        if(new Date(data.messagesFrom).getTime() < Number(data.created_at)-60000){
          const error = {
            reason: "Date should be equal or after creation date"
          };

          const message = `The ** "Messages From" **  date should not be set before this
            conversation was created!\n\n Please enter a valid date!`;

          return this._sendErrorNote(website_id, session_id, message, error);
        }

        return this._validateDateAndTime(website_id, session_id, data.messagesFrom);
      })
      .then(message_from_timestamp => {
        data.messagesFrom = message_from_timestamp;
        // validate end date and time of when messages should be sent from
        if(data.messagesTo){
          if(new Date(data.messagesTo).getTime() > Number(data.updated_at)){
            const error = {
              reason: "Date should not be after conversation was last updated"
            };
            const message = `The ** "Messages To" ** date should not be set after the 
              last time this conversation was updated!\n\n Please enter a valid date!`;

            return this._sendErrorNote(website_id, session_id, message, error);
          }
          
          return this._validateDateAndTime(
            website_id, 
            session_id, 
            data.messagesTo
          );
        }
      })
      .then(message_to_timestamp => {
        data.messagesTo = message_to_timestamp;
        this._fetchMessagesInConversation(website_id, session_id, data);
      })
      .catch(err => console.log(err));
  }

  getFullConversation(website_id, session_id, data){
    const token           = data.token;

    this._validateTokens(website_id, token)
      .then(() => {
        this._fetchMessagesInConversation(website_id, session_id, data);
      })
      .catch(err => {
        console.log(err);
      });
  }

  // Covnert timestamp from Unix to Date string 
  convertTimestamp(website_id, data, res){
    this._validateTokens(website_id, data.token)
      .then(() => {
        /* eslint-disable indent */
        switch (data.item_id){
          case "session_created": {
            res.send({ 
              data: {
                value: `Created: ${new Date(Number(data.created_at))
                  .toISOString()
                  .slice(0, 16)
                  .replace(/T/, " ")}`
              }
            });

            break;
          }
          case "session_updated": {
            res.send({ 
              data: {
                value: `Updated: ${new Date(Number(data.updated_at))
                  .toISOString()
                  .slice(0, 16)
                  .replace(/T/, " ")}`
              }
            });
    
            break;
          }
          default: {
            res.send({});
          }
        }
        /* eslint-enable indent */
      })
      .catch( err => console.log(err));
  }

  _fetchMessagesInConversation(website_id, session_id, data){
    const visitor_nickname       = data.visitorNickname;
    const visitor_email          = data.visitorEmail;
    const message_to             = data.messagesTo;
    let message_from             = data.messagesFrom;

    let toDate                   = Date.now();      
    let self                     = this;
    let fullconversationMessages = "";

    message_from                  = new Date(message_from).getTime();
    
    // If a 'messages to' date is set, then use it as the first 
    // timestamp to get messages, otherwise use current time and date.
    if(message_to){
      toDate = new Date(message_to).getTime();
    }

    // Function to get messages by page, then append messages to the
    // 'fullConversationMessages' variable.
    (function getMessagePages(timestamp, lastMessageFrom){
      self.crispClient.website.getMessagesInConversation(
        website_id, 
        session_id, 
        timestamp
      )
        .then(messages => {
          let currentMessages = "";
  
          for(let message of messages){
            const msgTimestamp = Number(message.timestamp);
            const msgNickname  = message.user.nickname;
            const msgFrom      = message.from;
            const botName      = "Export Transcript Plugin";

            let messageTime = new Date(msgTimestamp)
              .toISOString()
              .slice(0, 16)
              .replace(/T/, " ");
  
            if(msgTimestamp < message_from || msgNickname === botName){
  
              continue;
            }
            if(!lastMessageFrom){
              let txt = `${msgNickname} (${lastMessageFrom}): `;

              lastMessageFrom = msgFrom;
              currentMessages = currentMessages.concat(txt);
            } 
            if(msgFrom !== lastMessageFrom){
              let txt = `${msgNickname} (${lastMessageFrom}): `;

              lastMessageFrom = msgFrom;
              currentMessages = currentMessages.concat("\n\n", txt);
            }
            switch(message.type) {
            /* eslint-disable indent */
              case "text": {
                let txt = `[${messageTime}] ${message.content}`;

                currentMessages = currentMessages.concat("\n", txt);
  
                break;
              }
              case "picker": {
                let txt;
                let selectedChoice = "Unselected answers:";
                
                for(let choice of message.content.choices){
                  if(choice.selected){
                    selectedChoice = choice.label;
                  }
                }
                if(selectedChoice === "Unselected answers:"){
                  for(let [i, choice] of message.content.choices.entries()){
                    selectedChoice = selectedChoice.concat(` ${i + 1}: `, `'${choice.label}'`);
                  }  
                }
                
                txt = `[${messageTime}] Q: "${message.content.text}" A: "${selectedChoice}"`;

                currentMessages = currentMessages.concat("\n", txt);
                
                break;
              }
              case "field": {
                let txt;
                let fieldAnswer = message.content.value;
  
                !fieldAnswer ? fieldAnswer = "[No input from user]": null;

                txt = `[${messageTime}] Field Input message - Q: 
                  "${message.content.text}" A: "${fieldAnswer}"`;
  
                currentMessages = currentMessages.concat("\n", txt);
  
                break;
              }
              case "note": {
                let txt = `[${messageTime}] PRIVATE NOTE: ${message.content}`;

                currentMessages = currentMessages.concat("\n", txt);
  
                break;
              }
              case "animation": {
                let txt = `[${messageTime}] Animation file: ${message.content.url}`;

                currentMessages = currentMessages.concat("\n", txt);
  
                break;
              }
              case "audio": {
                let txt = `[${messageTime}] Audio file: ${message.content.url}, 
                  Message length: ${message.content.duration} seconds`;

                currentMessages = currentMessages.concat("\n", txt);
  
                break;
              }
              case "file": {
                let txt = `[${messageTime}] File sent: ${message.content.url}, 
                  File name: "${message.content.name}"", File type: "${message.content.type}"`;

                currentMessages = currentMessages.concat("\n", txt);
  
                break;
              }
              case "event": {
                let txt = `[${messageTime}] Event occured: "${message.content.namespace}"`;
                currentMessages = currentMessages.concat("\n", txt);
              }
            /* eslint-enable indent */
            }
          }
  
          fullconversationMessages = currentMessages.concat(fullconversationMessages);

          if(messages.length !== 40){
            let pathParam1 = "";
            let pathParam2 = "";
            let pathParam3 = "";
            let fullPath   = "";
            let   txtFileTitle = `Conversation with ${visitor_nickname}`;
            const fileName = self.websites[website_id].fileName;
  
            if(visitor_email !== ""){
              txtFileTitle = txtFileTitle.concat(`\nEmail: ${visitor_email}`);
            } 
  
            fullconversationMessages = txtFileTitle.concat(
              "\n\n", 
              fullconversationMessages
            );
            

            if(self.websites[website_id].fnWebsiteId){
              pathParam1 = `_${website_id}`;
            } 
            if(self.websites[website_id].fnSessionId){
              pathParam2 = `_${session_id}`;
            } 
            if(self.websites[website_id].fnNickname){
              pathParam3 = `_${visitor_nickname}`;
            } 

            fullPath = `${fileName}${pathParam1}${pathParam2}${pathParam3}`;
  
            return fs.promises.writeFile(
              `${path.join(__dirname)}/tmp/${fullPath}.txt`, 
              fullconversationMessages, 
        
              (err) => {
                err ? console.log(err): null;
                
                return data;
              })
              .then(() => {
                self._createUploadBucket(website_id, session_id, fullPath);
              })
              .catch(err => console.log(err));
          }

          getMessagePages(messages[0].timestamp, lastMessageFrom);
          
        })
        .catch(err => console.log(err));
    })(toDate);
  }

  _validateTokens(website_id, token){
    return new Promise ((resolve, reject) => {
      if (token !== this.websites[website_id].token) { 
        return reject({
          error: true,
          reason: "Invalid token, please try again with a valid token!",
          data: {
            website : this.websites[website_id].token,
            token   : token
          }
        });
      }
      resolve();
    });
  }

  // Validate time and date sent by operator is
  // in a correct format. 
  _validateDateAndTime(website_id, session_id, time){
    time = time.trim();

    const message = `
    Please insert a valid time and date of when you would like to export
    messages from and/or to, such as;
      * **yyyy-mm-dd** eg. "2016-11-25"
      * **yyyy-mm-dd hh:mm** eg. "2016-11-25 12:10" \n\n
    `;

    /* eslint-disable indent */
    switch(time.length){
      case 10: {
        const dateRegYear = /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/;
  
        if(!time.match(dateRegYear)){
          const error = {
            reason: "Date format must be 'yyyy-mm-dd'"
          };

          return this._sendErrorNote(website_id, session_id, message, error);
        }
  
        break;
      }
      case 16: {
        const dateRegYearDate = /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1]) (2[0-3]|[01][0-9]):[0-5][0-9]/;
  
        if(!time.match(dateRegYearDate)){
          const error = {
            reason: "Date and time format must be 'yyyy-mm-dd hh:mm' "
          };

          return this._sendErrorNote(website_id, session_id, message, error);
        }
  
        break;
      }
      default: {
        const error = {
          reason: "Date format must be a length of 10 or 16 characters only!"
        };

        return this._sendErrorNote(website_id, session_id, message, error);
      }
      
    }
        /* eslint-enable indent */
  }

  _sendErrorNote(website_id, session_id, error_message, error){
    return new Promise((resolve, reject) => {
      const message = {
        "type"    : "note",
        "from"    : "operator",
        "origin"  : "chat",
        "content" : error_message,
        "user"    : {
          "type"    : "website",
          "nickname": "Export Transcript Plugin",
          "avatar"  : "https://storage.crisp.chat/users/avatar/website/754190078c1a2c00/crisp_64lksp.png"
        }
      };
  
      this.crispClient.website.sendMessageInConversation(website_id, session_id, message)
        .catch(err => console.log(err));
      
      reject({
        "error": true,
        "reason": error.reason,
        "data": error.data
      });
    });
  }

  _createUploadBucket(website_id, session_id, fileName){
    const bucket_id = `transcript_${website_id}_${session_id}`;

    this.buckets.set(bucket_id, fileName);

    let data = {
      "namespace" : "upload",
      "from"      : "plugin",
      "identifier": this._pluginId,
      "id"        : bucket_id,
  
      "file"      : {
        "name"      : `${fileName}.txt`,
        "type"      : "text/plain"
      }
    };

    this.crispClient.bucket.generateBucketURL(data)
      .catch(err => {
        console.log(err);
      });
  }

  _initPlugin(){
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
            const file_name    = website.settings.fileName || "transcript";
            const fnWebsite_id = website.settings.fnWebsiteId;
            const fnSession_id = website.settings.fnSessionId;
            const fnNickname   = website.settings.fnNickname;

          
            this.websites[website.website_id] = {
              token      : website.token,
              fileName   : file_name, 
              fnWebsiteId  : fnWebsite_id,
              fnSessionId  : fnSession_id,
              fnNickname   : fnNickname
            };
          }

          console.log(`Retrieved ${numWebsites} websites.`);
          console.log("Website configutations: ");
          console.log(this.websites);

          this._events();
        }
      })
      .catch(err => {
        console.error(err);
      });
  }

  _events() {
    const self = this;

    this.crispClient.on("bucket:url:upload:generated", (bucket) => {

      const file_name      = this.buckets.get(bucket.id);
      const website_id     = bucket.id.slice(11, 47 );
      const session_id     = bucket.id.slice(48, 92);
      const readableStream = fs.createReadStream(`${__dirname}/tmp/${file_name}.txt`);

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
                `${__dirname}/tmp/${file_name}.txt`, 
                
                (res) => {
                  if(res){
                    console.log(`Deleted: ${res} `);
                  }
                }
              );
              
              this.buckets.delete(bucket.id);

            })
            .catch(err => {
              console.log(err);
            });
        });
      });
    });

    console.log("Now listening for events...");
  }
}

module.exports = ExportChat;