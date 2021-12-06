const express     = require("express");
const ExportChat  = require("./export_chat");
const bodyParser  = require("body-parser");
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
  // eslint-disable-next-line indent
  }

};

app.use("/config/update", ((req, res) => {
  const websiteId = req.body.website_id;
  const token = req.body.token;
  const data = {
    fileName: req.body.fileName,
    websiteId : req.body.websiteId,
    sessionId : req.body.sessionId,
    nickname  : req.body.nickname,
    email     : req.body.email,
  };

  plugin.updateFilenameForTranscript(websiteId, token, data);

  res.send({});
}));

// need to complete to fetch setting config first! 
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
   /* eslint-enable indent */
  }
});



app.listen(port, () => {
  console.info(`Listening on Port: ${port}`);
});
