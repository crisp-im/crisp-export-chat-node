const express     = require("express");
const ExportChat  = require("./export_chat");
const bodyParser  = require("body-parser");
const fs          = require("fs");
const path        = require("path");

const pluginUrn          = "";
const crispAPIIdentifier = "";
const crispAPIKey        = "";


const app   = express();
const port  = 1234;

const plugin = new ExportChat(
  pluginUrn, 
  crispAPIIdentifier,
  crispAPIKey
);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const handleDataFetchAction = (body, res) => {
  const websiteId = body.origin.website_id;
  const sessionId = body.origin.session_id;
  const token     = body.origin.token;
  const item_id   = body.widget.item_id;


  plugin.getConversationMetas(websiteId, sessionId, token, item_id, res);

};

const handleSubmitButtonAction = (body, res) => {

  const website_id = body.origin.website_id;
  const session_id = body.origin.session_id;
  const data       = {
    token           : body.origin.token,
    visitorNickname : body.payload.data.visitor_nickname,
    visitorEmail    : body.payload.data.visitor_email,
    messagesFrom    : body.payload.value.from,
    messagesTo      : body.payload.value.to
  };
  
  plugin.getConversationBetween(website_id, session_id, data);
  
  return res.send({});
};

const handleHookButtonAction = (body, res) => {

  const website_id = body.origin.website_id;
  const session_id = body.origin.session_id;
  const data       = {
    token           : body.origin.token,
    visitorNickname : body.payload.data.visitor_nickname,
    visitorEmail    : body.payload.data.visitor_email
  };
  
  plugin.getFullConversation(website_id, session_id, data);
  return res.send({});
};

const handleButtonAction = (body, res) => {

  switch (body.widget.item_id){
  /* eslint-disable indent */
    case "submit-get-messages": {
      handleSubmitButtonAction(body, res);

      break;
    }
    case "export-now": {
     handleHookButtonAction(body, res);

     break;
    }
    default: {
      res.send({});
    }
  // eslint-disable-next-line indent
  }

};

app.get("/profile", (req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  fs.createReadStream("public/index.htm").pipe(res);
});

app.post("/export", (req, res) => {
  const action = req.body.action;

  switch (action.type){
  /* eslint-disable indent */
   case "data": {
     handleDataFetchAction(req.body, res);

     break;
   }
    case "button": {
      handleButtonAction(req.body, res);

     break;
   }
   default: {
     res.send({});
   }
   /* eslint-enable indent */
  }
});



app.listen(port, () => {
  console.info(`Listening on Port: ${port}`);
});
