const fs    = require("fs");
const path  = require("path");
const Store = require("../store");
 
/**
 * @class
 * @classdesc This is the controller to export messages
 */
function ExportMessages(controller, crisp) {

  /**
   * 
   * @memberof exportMessages
   * @method exportFullConversation
   * @param {string} websiteId 
   * @param {string} sessionId 
   * @param {object} data 
   */
  controller.exportFullConversation = function(websiteId, sessionId, data) {

    _getAllMessages(websiteId, sessionId, data.timestamp)
      .then(messages => {
        return _formatAllMessages(messages);
      })
      .then(formattedMessages => {
        return _formatFileConent(formattedMessages, data);
      })
      .then(transcript => {
        return _writeTranscriptToFile(
          transcript, 
          websiteId, 
          sessionId, 
          data.visitorNickname
        );
      })
      .catch(err => console.log(err));
  };

  /**
   * 
   * @memberof ExportMessages
   * @method exportConversationBetween
   * @param {string} websiteId 
   * @param {string} sessionId 
   * @param {object} data 
   */
  controller.exportConversationBetween = function(websiteId, sessionId, data){
    _validateTimeAndDate(websiteId, sessionId, data)
      .then(() => {
        data.messagesFrom = new Date(data.messagesFrom.trim()).getTime();
        data.messagesTo   = new Date(data.messagesTo.trim()).getTime();

        return _getAllMessages(
          websiteId,
          sessionId,
          data.messagesTo,
          data.messagesFrom
        );
      })
      .then(messages => {
        let filteredMessages = messages.filter(message => {
          return message.timestamp > data.messagesFrom;
        }); 
        return filteredMessages;
      })
      .then(messages => {
        return _formatAllMessages(messages);
      })
      .then(formattedMessages => {
        return _formatFileConent(formattedMessages, data);
      })
      .then(transcript => {
        return _writeTranscriptToFile(
          transcript, 
          websiteId, 
          sessionId, 
          data.visitorNickname
        );
      })
      .catch(err => console.log(err));
  };

  /**
   * @memberof ExportMessages
   * @method _validateTimeAndDate
   * @param {string} websiteId 
   * @param {string} sessionId 
   * @param {object} data 
   * @private
   * @returns Error
   */
  async function _validateTimeAndDate(websiteId, sessionId, data){
  
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

      return _sendErrorNote(websiteId, sessionId, message, error);
    }

    await _validateDateAndTimeFormat(websiteId, sessionId, data.messagesFrom);
    if (data.messagesTo) {
      return _validateDateAndTimeFormat(websiteId, sessionId, data.messagesTo);
    }
  }

  /**
   * @memberof ExportMessages
   * @method _validateDateAndTimeFormat
   * @param {string} website_id 
   * @param {strign} session_id 
   * @param {string} time 
   * @private
   * @returns Promise
   */
  function _validateDateAndTimeFormat(website_id, session_id, time){
    time = time.trim();

    const message = `
    Please insert a valid time and date of when you would like to export
    messages from and/or to, such as;
      * **yyyy-mm-dd** eg. "2016-11-25"
      * **yyyy-mm-dd hh:mm** eg. "2016-11-25 12:10" \n\n
    `;

    switch(time.length){
      case 10: {
        const dateRegYear = /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/;
  
        if(!time.match(dateRegYear)){
          const error = {
            reason: "Date format must be 'yyyy-mm-dd'"
          };

          return this._sendErrorNote(website_id, session_id, message, error);
        }
  
        return Promise.resolve();
      }
      case 16: {
        const dateRegYearDate = /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1]) (2[0-3]|[01][0-9]):[0-5][0-9]/;
  
        if(!time.match(dateRegYearDate)){
          const error = {
            reason: "Date and time format must be 'yyyy-mm-dd hh:mm' "
          };

          return _sendErrorNote(website_id, session_id, message, error);
        }
        
        return Promise.resolve();
      }
      default: {
        const error = {
          reason: "Date format must be a length of 10 or 16 characters only!"
        };

        return _sendErrorNote(website_id, session_id, message, error);
      }
      
    }
  }

  /**
   * 
   * @memberof exportMessages
   * @method _getAllMessages
   * @private
   * @param {string} websiteId 
   * @param {string} sessionId 
   * @param {int} messagesTo 
   * @param {int} messagesFrom 
   * @returns Promise
   */
  function _getAllMessages(websiteId, sessionId, messagesTo, messagesFrom){
    let allMessages = [];
    messagesFrom    = messagesFrom ? messagesFrom : 0;

    return (function getMessages(timestamp){
      return crisp.crispClient.website.getMessagesInConversation(
        websiteId,
        sessionId, 
        timestamp
      ).then((messages) => {
        let lastMessage = messages[0];
        allMessages     = messages.concat(allMessages);
        
        if(messages.length === 40 && lastMessage.timestamp > messagesFrom){
          return getMessages(messages[0].timestamp);
        }
        return Promise.resolve(allMessages);
      });
    } )(messagesTo);
  }

  /**
   * 
   * @memberof exportMessages
   * @method _formatAllMessages
   * @private
   * @param {array} messages
   * @return array
   */
  function _formatAllMessages(messages){
    return messages.map((message, index, array) => {
      let formattedMessage = _formatMessage(message);

      let previousFrom     = array[index - 1] ? array[index - 1].from : "not set";
      let previousNickName = array[index - 1] ? array[index - 1].user.nickname : "not set";

      if(message.from !== previousFrom || message.user.nickname !== previousNickName){
        return `\n${message.user.nickname} (${message.from}): \n${formattedMessage}`;
      }
      return formattedMessage;
    });
  }

  /**
   * 
   * @memberof exportMessages
   * @method _formatAllMessages 
   * @private
   * @param {object} message
   * @return string
   */
  function _formatMessage(message){ 
    const msgTimestamp  = Number(message.timestamp);
    const messageTime   = new Date(msgTimestamp)
      .toISOString()
      .slice(0, 16)
      .replace(/T/, " ");

    switch(message.type) {
      case "text": {
        return `[${messageTime}] ${message.content}`;
      }
      case "picker": {
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
        
        return `[${messageTime}] Q: "${message.content.text}" A: "${selectedChoice}"`;
      }
      case "field": {
        let fieldAnswer = message.content.value;

        !fieldAnswer ? fieldAnswer = "[No input from user]": null;

        return `[${messageTime}] Field Input message - Q: 
          "${message.content.text}" A: "${fieldAnswer}"`;
      }
      case "event": {
        return `[${messageTime}] Event occured: "${message.content.namespace}"`;
      }
      case "animation": {
        return `[${messageTime}] Animation file: ${message.content.url}`;
      }
      case "audio": {
        return `[${messageTime}] Audio file: ${message.content.url}, 
        Message length: ${message.content.duration} seconds`;
      }
      case "file": {
        return `[${messageTime}] File sent: ${message.content.url}, 
        File name: "${message.content.name}"", File type: "${message.content.type}"`;
      }
      case "note": {
        // Commented out to not send prive notes to the Customer.
        // If you would like to include private note, uncomment this
        // code.
        
        // return `[${messageTime}] PRIVATE NOTE: ${message.content}`;
        break;
      }
    }
  }

  /**
   * 
   * @memberof exportMessages
   * @method _formatFileConent
   * @param {array} messages 
   * @param {object} data 
   * @returns string
   */
  function _formatFileConent(messages, data){
    let fullconversation = "";

    for(let message of messages){
      fullconversation = fullconversation.concat("\n", message);
    }

    if(data.visitorEmail !== ""){
      let userDetails = `Conversation with: ${data.visitorNickname} \nEmail: ${data.visitorEmail}`;

      fullconversation = userDetails.concat("\n", fullconversation);
    } else {
      fullconversation = `Conversation with: ${data.visitorNickname}`.concat(
        "\n",
        fullconversation
      );
    }

    return fullconversation;
  }

  /**
   * 
   * @memberof exportMessages
   * @method _writeTranscriptToFile
   * @param {string} transcript 
   * @param {string} websiteId 
   * @param {string} sessionId 
   * @param {string} visitorNickname 
   */
  function _writeTranscriptToFile(transcript, websiteId, sessionId, visitorNickname){
    let pathParam1 = "";
    let pathParam2 = "";
    let pathParam3 = "";
    let fullPath   = "";
    const fileName = Store.websites[websiteId].fileName;
    
    if(Store.websites[websiteId].selectedWebsiteId){
      pathParam1 = `_${websiteId}`;
    } 
    if(Store.websites[websiteId].selectedSessionId){
      pathParam2 = `_${sessionId}`;
    } 
    if(Store.websites[websiteId].selectedNickname){
      pathParam3 = `_${visitorNickname}`;
    } 

    fullPath = `${fileName}${pathParam1}${pathParam2}${pathParam3}`;

    fs.promises.writeFile(
      `${path.join(__dirname)}/../../tmp/${fullPath}.txt`,
      transcript,

      (err) => {
        err ? console.error(err) : null;
      });
    _createUploadBucket(websiteId, sessionId, fullPath);
  }

  /**
   * 
   * @memberof exportMessages
   * @method _createUploadBucket
   * @param {string} website_id 
   * @param {string} session_id 
   * @param {string} fileName 
   */
  function _createUploadBucket(website_id, session_id, fileName){
    const bucket_id = `transcript_${website_id}_${session_id}`;

    Store.buckets.set(bucket_id, fileName);

    let data = {
      "namespace" : "upload",
      "from"      : "plugin",
      "identifier": crisp._pluginId,
      "id"        : bucket_id,
  
      "file"      : {
        "name"      : `${fileName}.txt`,
        "type"      : "text/plain"
      }
    };

    crisp.crispClient.bucket.generateBucketURL(data)
      .catch(err => {
        console.log("\n\nPrint me");
        console.error(err);
      });
  }

  /**
   * @memberof ExportMessages
   * @method _sendErrorNote
   * @param {string} website_id 
   * @param {string} session_id 
   * @param {string} error_message 
   * @param {object} error 
   * @returns 
   */
  function _sendErrorNote(website_id, session_id, error_message, error){
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

    crisp.crispClient.website.sendMessageInConversation(website_id, session_id, message)
      .catch(err => console.error(err));
    
    return Promise.reject({
      "error" : true,
      "reason": error.reason,
      "data"  : error.data || {}
    });
  }

}

module.exports = ExportMessages;
