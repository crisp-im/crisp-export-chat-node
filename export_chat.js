const Crisp = require("node-crisp-api");
const fs    = require("fs");
const https = require("https");
const path  = require("path");

class ExportChat {
  constructor(pluginUrn, crispAPIIdentifier, crispAPIKey) {
    this.crispClient = new Crisp();
    this.websites    = new Map();
    
    this.pluginUrn          = pluginUrn;
    this.crispAPIIdentifier = crispAPIIdentifier;
    this.crispAPIKey        = crispAPIKey;

    this._initPlugin();
  }

  getConversationBetween(website_id, session_id, data){
    const token           = data.token;
    const vistor_nickname = data.visitorNickname;
    const visitor_email   = data.visitorEmail;
    const messages_to     = data.messagesTo;
    let messages_from   = data.messagesFrom;

    if (token !== this.websites[website_id].token) {
      console.log(this.websites);
      console.log(token);
      console.error("Invalid token, pleaes try again with a valid token!");

      return;
    }
    if(!messages_from){
      const message = `
        Please insert a valid time and date of when you would like to export 
        messages from. \n\n If you would like to export all messages in this 
        Conversation, please select **"Send Entire Conversation"** . 
        `;

      this._sendErrorNote(website_id, session_id, message);

      return console.log("Action requires a 'message from' date!");
    }

    this._validateDateAndTime(website_id, session_id, messages_from)
      .then(message_from_timestamp => {
        messages_from = message_from_timestamp;

        if(messages_to){
          return this._validateDateAndTime(website_id, session_id, messages_to);
        }
      })
      .then(message_to_timestamp => {
        return this._fetchMessagesInConversation(
          website_id, 
          session_id, 
          vistor_nickname, 
          visitor_email, 
          messages_from, 
          message_to_timestamp
        );
      })
      .then(data => {
        fs.writeFile(
          `./tmp/transcript_${website_id}_${session_id}.txt`, 
          data.fullconversationMessages, 

          (err) =>{
            err ? console.log(err): null;

            return data;
          });

      })
      .then(() => {
        this._createUploadBucket(website_id, session_id);
      })
      .catch(err => console.log(err));
  }

  getFullConversation(website_id, session_id, data){
    const token           = data.token;
    const vistor_nickname = data.visitorNickname;
    const visitor_email   = data.visitorEmail;

    if (token !== this.websites[website_id].token) {
      console.log(this.websites);
      console.log(token);
      console.error("Invalid token, pleaes try again with a valid token!");

      return;
    }

    this._fetchMessagesInConversation(
      website_id, 
      session_id, 
      vistor_nickname, 
      visitor_email
    )
      .then(data => {
        fs.writeFile(
          `${path.join(__dirname)}/tmp/transcript_${website_id}_${session_id}.txt`, 
          data.fullconversationMessages, 

          (err) => {
            err ? console.log(err): null;
            
            return data;
          });

      })
      .then(() => {
        this._createUploadBucket(website_id, session_id);
      })
      .catch(err => console.log(err));
  }

  getConversationMetas(website_id, session_id, token, item_id, res){
    if (token !== this.websites[website_id].token) {
      console.log(this.websites);
      console.log(token);
      console.error("Invalid token, pleaes try again with a valid token!");

      return;
    }

    this.crispClient.website.getConversation(website_id, session_id)
      .then(conversation => {
        /* eslint-disable indent */
        switch (item_id){
          case "session_created": {
            res.send({ data: {value: `Created: ${new Date(conversation.created_at).toISOString().slice(0, 16).replace(/T/, " ")}`}});
    
            break;
          }
          case "session_updated": {
            res.send({ data: {value: `Updated: ${new Date(conversation.updated_at).toISOString().slice(0, 16).replace(/T/, " ")}`}});
    
            break;
          }
          default: {
            res.send({});
          }
        }
        /* eslint-enable indent */
      });
  }

  _fetchMessagesInConversation(website_id, session_id, vistor_nickname, visitor_email, message_from, message_to){
    let toDate                   = Date.now();      
    let self                     = this;
    let fullconversationMessages = "";

    message_from                  = new Date(message_from).getTime();
    
    if(message_to){
      toDate = new Date(message_to).getTime();
    }

    return new Promise((resolve) => {
      (function getMessagePages(timestamp, lastMessageFrom){
        self.crispClient.website.getMessagesInConversation(
          website_id, 
          session_id, 
          timestamp
        )
          .then(messages => {
            let currentMessages = "";

            if (messages.length === 0) {
              let txtFileTitle = `Conversation with ${vistor_nickname}`;

              if(visitor_email !== ""){
                txtFileTitle = txtFileTitle.concat(`\nEmail: ${visitor_email}`);
              } 

              fullconversationMessages = txtFileTitle.concat(
                "\n\n", 
                fullconversationMessages
              );

              let data = {
                fullconversationMessages: fullconversationMessages,
                website_id: website_id,
                session_id: session_id
              };

              return resolve(data);
            }
            for(let message of messages){
              let messageTime = new Date(message.timestamp)
                .toISOString()
                .slice(0, 16)
                .replace(/T/, " ");

              if(message.timestamp < message_from || message.user.nickname === "Export Transcript Plugin"){

                continue;
              }
              if(!lastMessageFrom){
                lastMessageFrom = message.from;
                currentMessages = currentMessages.concat(`${message.user.nickname} (${lastMessageFrom}): `);
              } 
              if(message.from !== lastMessageFrom){
                lastMessageFrom = message.from;
                currentMessages = currentMessages.concat("\n\n", `${message.user.nickname} (${lastMessageFrom}): `);
              }
              if (message.type === "text"){
                let messageToAppend = `[${messageTime}] ${message.content}`;
                currentMessages = currentMessages.concat("\n", messageToAppend);
              }
              if(message.type === "picker"){
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
                currentMessages = currentMessages.concat("\n", `[${messageTime}] Q: "${message.content.text}" A: "${selectedChoice}"`);
              }
              if(message.type === "field"){
                let fieldAnswer = message.content.value;

                !fieldAnswer ? fieldAnswer = "[No input from user]": null;

                currentMessages = currentMessages.concat("\n", `[${messageTime}] Field Input message - Q: "${message.content.text}" A: "${fieldAnswer}"`);
              }
              if(message.type === "note"){
                currentMessages = currentMessages.concat("\n", `[${messageTime}] PRIVATE NOTE: ${message.content}`);
              }
              if(message.type === "animation"){
                currentMessages = currentMessages.concat("\n", `[${messageTime}] Animation file: ${message.content.url}`);
              }
              if(message.type === "audio"){
                currentMessages = currentMessages.concat("\n", `[${messageTime}] Audio file: ${message.content.url}, Message length: ${message.content.duration} seconds`);
              }
              if(message.type === "file"){
                currentMessages = currentMessages.concat("\n", `[${messageTime}] File sent: ${message.content.url}, File name: "${message.content.name}"", File type: "${message.content.type}"`);
              }
              if(message.type === "event"){
                currentMessages = currentMessages.concat("\n", `[${messageTime}] Event occured: "${message.content.namespace}"`);
              }
            }

            fullconversationMessages = currentMessages.concat(fullconversationMessages);


            getMessagePages(messages[0].timestamp, lastMessageFrom);
            
          })
          .catch(err => console.log(err));
      })(toDate);
    });
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
        
        if(time.length === 10){
          const dateRegYear = /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/;
    
          if(!time.match(dateRegYear)){
            this._sendErrorNote(website_id, session_id, message);
    
            return reject("Date format must be 'yyyy-mm-dd'");
          }
    
          return resolve(time);
        }
        if(time.length === 16){
          const dateRegYearDate = /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1]) (2[0-3]|[01][0-9]):[0-5][0-9]/;
    
          if(!time.match(dateRegYearDate)){
            this._sendErrorNote(website_id, session_id, message);
    
            return reject("Date and time format must be 'yyyy-mm-dd hh:mm' ");
          }
    
          return resolve(time);
        }

        this._sendErrorNote(website_id, session_id, message);

        return reject("Date format must be a length of 10 or 16 characters only!");
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

  _createUploadBucket(website_id, session_id){
    let data = {
      "namespace" : "upload",
      "from"      : "plugin",
      "identifier": this._pluginId,
      "id"        : `transcript_${website_id}_${session_id}`,
  
      "file"      : {
        "name"      : `transcript_${website_id}_${session_id}.txt`,
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
            this.websites[website.website_id] = {
              token: website.token,
            };

            numWebsites++;
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

      const website_id     = bucket.id.slice(11, 47 );
      const session_id     = bucket.id.slice(48, 92);
      const readableStream = fs.createReadStream(`${__dirname}/tmp/${bucket.id}.txt`);

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
              "name"    : `${session_id}.txt`,
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
                `${__dirname}/tmp/${bucket.id}.txt`, 
                
                (res) => {
                  console.log(`Deleted: ${res}`);
                });

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