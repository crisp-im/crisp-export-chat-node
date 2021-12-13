const express     = require("express");
const bodyParser  = require("body-parser");
const path        = require("path");
const ExportChat  = require("./export_chat");

// Add plugin Urn, API_Identifier and API_Key here: 
const pluginUrn          = "urn:dinis.tavares:export-thread:0";
const crispAPIIdentifier = "9c4fe5fa-c381-48ab-b640-83bb5ddd485e";
const crispAPIKey        = "b7282735914f3f033cf4635294d5e18ae09231fd7b5c90fb218c33339c4eb5ff";

const app   = express();
const port  = 1234;

const plugin = new ExportChat(
  pluginUrn, 
  crispAPIIdentifier,
  crispAPIKey
);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));

app.set("view engine", "ejs");

const handleDataFetchAction = (body, res) => {
  const websiteId = body.origin.website_id;
  
  const data = {
    sessionId  : body.origin.session_id,
    token      : body.origin.token,
    item_id    : body.widget.item_id,
    created_at : body.payload.data.created_at,
    updated_at : body.payload.data.updated_at
  };

  plugin.convertTimestamp(websiteId, data, res);
};

const handleSubmitButtonAction = (body, res) => {

  const website_id = body.origin.website_id;
  const session_id = body.origin.session_id;
  const data       = {
    token           : body.origin.token,
    visitorNickname : body.payload.data.visitor_nickname,
    visitorEmail    : body.payload.data.visitor_email,
    messagesFrom    : body.payload.value.from,
    messagesTo      : body.payload.value.to,
    created_at      : body.payload.data.created_at,
    updated_at      : body.payload.data.updated_at,
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
  /* eslint-enable indent */
  }

};

app.use("/config/update", ((req, res) => {
  const websiteId = req.body.website_id;
  const token = req.body.token;
  const data = {
    fileName: req.body.fileName,
    fnWebsiteId : req.body.fnWebsiteId,
    fnSessionId : req.body.fnSessionId,
    fnNickname  : req.body.fnNickname
  };

  plugin.updateFilenameForTranscript(websiteId, token, data);

  res.send({});
}));

app.get("/config", (req, res) => {
  plugin.getConfigPage(req.query.website_id, req.query.token, res);
});

app.get("/profile", (req, res) => {
  res.render("admin/index", {
    pageTitle: "User Profile"
  });
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
  }
  /* eslint-enable indent */
});

app.get("/success", (req, res) => {
  res.render("config/success", {
    pageTitle: "Export plugin installed!"
  });
});

app.listen(port, () => {
  console.info(`Listening on Port: ${port}`);
});
