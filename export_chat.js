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

  getConfigPage(websiteId, token, res){
    if (token !== this.websites[websiteId].token) {
      console.log(this.websites);
      console.log(token);
      console.error("Tokens does not match! Retry with a valid token.");

      return;
    }

    return res.render("config/config", {
      pageTitle : "Export Configuration", 
      filename  : this.websites[websiteId].fileName,
      websiteId : this.websites[websiteId].websiteId ? "checked" : "",
      sessionId : this.websites[websiteId].sessionId ? "checked" : "",
      nickname  : this.websites[websiteId].nickname ? "checked" : "",
    });

  }

  updateFilenameForTranscript(websiteId, token, data) {
    if (token !== this.websites[websiteId].token) {
      console.log(this.websites);
      console.log(token);
      console.error("Tokens does not match! Retry with a valid token.");

      return;
    }

    const settings = {
      fileName   : data.fileName,
      websiteId  : data.websiteId,
      sessionId  : data.sessionId,
      nickname   : data.nickname,
      email      : data.email
    };

    this.crispClient.plugin.updateSubscriptionSettings(
      websiteId,
      this._pluginId,
      settings
    )
      .then((res) => {
        console.log(res);
        this.websites[websiteId] = { 
          token      : token,
          fileName   : data.fileName,
          websiteId  : data.websiteId,
          sessionId  : data.sessionId,
          nickname   : data.nickname,
          email      : data.email,
        };

        console.log(
          `Successfully updated plugin config for website ID: ${websiteId}`
        );
      })
      .catch(error => {
        console.error(error);
      });
  }

  getConversationBetween(website_id, session_id, data){
    const token           = data.token;

    if (token !== this.websites[website_id].token) {
      console.log(this.websites);
      console.log(token);
      console.error("Invalid token, pleaes try again with a valid token!");
      return {
        "error": true,
        "reason": "Invalid token, pleaes try again with a valid token!",
        "data": {}
      };

    }
    if(!data.messagesFrom){
      const message = `
        Please insert a valid time and date of when you would like to export 
        messages from. \n\n If you would like to export all messages in this 
        Conversation, please select **"Send Entire Conversation"** . 
        `;

      this._sendErrorNote(website_id, session_id, message);

      return {
        "error": true,
        "reason": "Action requires a 'message from' date!",
        "data": {
          "messageFrom": data.messagesFrom
        }
      };
    }

    if(new Date(data.messagesFrom).getTime() < Number(data.created_at)-60000){
      const message = `The ** "Messages From" **  date should not be set before this
        conversation was created!\n\n Please enter a valid date!`;
      return this._sendErrorNote(website_id, session_id, message);
    }

    this._validateDateAndTime(website_id, session_id, data.messagesFrom)
      .then(message_from_timestamp => {
        data.messagesFrom = message_from_timestamp;

        if(data.messagesTo){
          if(new Date(data.messagesTo).getTime() > Number(data.updated_at)){
            const message = `The ** "Messages To" ** date should not be set after the 
              last time this conversation was updated!\n\n Please enter a valid date!`;
            return  this._sendErrorNote(website_id, session_id, message);
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

    if (token !== this.websites[website_id].token) {
      console.log(this.websites);
      console.log(token);
      console.error("Invalid token, pleaes try again with a valid token!");

      return;
    }

    this._fetchMessagesInConversation(website_id, session_id, data);


  }

  convertTimestamp(website_id, data, res){
    if (data.token !== this.websites[website_id].token) {
      console.log(this.websites);
      console.log(data.token);
      console.error("Invalid token, pleaes try again with a valid token!");

      return;
    }

    /* eslint-disable indent */
    switch (data.item_id){
      case "session_created": {
        res.send({ data: {value: `Created: ${new Date(Number(data.created_at)).toISOString().slice(0, 16).replace(/T/, " ")}`}});

        break;
      }
      case "session_updated": {
        res.send({ data: {value: `Updated: ${new Date(Number(data.updated_at)).toISOString().slice(0, 16).replace(/T/, " ")}`}});

        break;
      }
      default: {
        res.send({});
      }
    }
    /* eslint-enable indent */
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
    
    if(message_to){
      toDate = new Date(message_to).getTime();
    }

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
            let pathParam4 = "";
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
            

            if(self.websites[website_id].websiteId){
              pathParam1 = `_${website_id}`;
            } 
            if(self.websites[website_id].sessionId){
              pathParam2 = `_${session_id}`;
            } 
            if(self.websites[website_id].nickname){
              pathParam3 = `_${visitor_nickname}`;
            } 
            if(self.websites[website_id].email && visitor_email){
              pathParam4 = `_${visitor_email}`;
            } 

            fullPath = `${fileName}${pathParam1}${pathParam2}${pathParam3}${pathParam4}`;
  
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

  _validateDateAndTime(website_id, session_id, time){
    time = time.trim();

    return new Promise(
      (resolve, reject) => {
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
              this._sendErrorNote(website_id, session_id, message);
      
              return reject("Date format must be 'yyyy-mm-dd'");
            }
      
            return resolve(time);
          }
          case 16: {
            const dateRegYearDate = /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1]) (2[0-3]|[01][0-9]):[0-5][0-9]/;
      
            if(!time.match(dateRegYearDate)){
              this._sendErrorNote(website_id, session_id, message);
      
              return reject("Date and time format must be 'yyyy-mm-dd hh:mm' ");
            }
      
            return resolve(time);
          }
          default: {
            this._sendErrorNote(website_id, session_id, message);
    
            return reject("Date format must be a length of 10 or 16 characters only!");
          }
          
        }
        /* eslint-enable indent */
      }
    );
  }

  _sendErrorNote(website_id, session_id, error_message){
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

    this.crispClient.plugin.getConnectAccount()
      .then(response => {
        this._pluginId = response.plugin_id;

        console.log(`Successfully retrieved plugin ID: ${this._pluginId}`);
      })
      .catch(err => {
        console.error(err);
      });

    this.crispClient.plugin.listAllConnectWebsites(1, false)
      .then(websites => {
        let numWebsites = (websites || []).length;

        if(numWebsites === 0 ){
          console.error(
            "No websites connected to this plugin."
          );
        } else {
          for(const website of websites){
            const file_name = website.settings.fileName || "transcript";
            const website_id = website.settings.websiteId;
            const session_id = website.settings.sessionId;
            const nickname = website.settings.nickname;
            const email = website.settings.email;

          
            this.websites[website.website_id] = {
              token      : website.token,
              fileName   : file_name, 
              websiteId  : website_id,
              sessionId  : session_id,
              nickname   : nickname,
              email      : email
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