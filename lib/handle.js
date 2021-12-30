const CONFIG  = require("../config/production-1.json");
const CrispManager = require("./crisp");

const plugin = new CrispManager(
  CONFIG.PLUGIN_URN,
  CONFIG.CRISP_IDENTIFIER,
  CONFIG.CRISP_KEY
); 

exports.getProfile = (request, response) => {
  response.render("admin/index", {
    pageTitle: "User Profile"
  });
};

exports.postExport = (request, response) => {
  const action = request.body.action;

  switch (action.type){
    case "data": {
      handleDataFetchAction(request.body, response);

      break;
    }
    case "button": {
      handleButtonAction(request.body, response);

      break;
    }
    default: {
      response.send({});
    }
  }
};

exports.getConfiguration = (request, response) => {
  plugin.Config.getConfiguration(request, response);
};

exports.putConfigurationUpdate = (request, response) => {
  plugin.Config.putConfigurationUpdate(request, response);
};

exports.getConfigSuccess = (request, response) => {
  plugin.Config.getConfigSuccess(request, response);
};


const handleButtonAction = (body, res) => {
  switch (body.widget.item_id){
    case "submit-get-messages": {
      _handleSubmitButtonAction(body, res);

      break;
    }
    case "export-now": {
      _handleHookButtonAction(body, res);

      break;
    }
    default: {
      res.send({});
    }
  }
};

const handleDataFetchAction = (body, response) => {
  const websiteId = body.origin.website_id;
  
  const data = {
    sessionId  : body.origin.session_id,
    token      : body.origin.token,
    item_id    : body.widget.item_id,
    created_at : body.payload.data.created_at,
    updated_at : body.payload.data.updated_at
  };

  plugin.Data.convertTimestamp(websiteId, data, response);
};

const _handleSubmitButtonAction = (body, res) => {

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
  
  plugin.Export.exportConversationBetween(website_id, session_id, data);
  
  return res.send({});
};

const _handleHookButtonAction = (body, res) => {

  const website_id = body.origin.website_id;
  const session_id = body.origin.session_id;
  const data       = {
    token           : body.origin.token,
    timestamp       : Date.now(),
    visitorNickname : body.payload.data.visitor_nickname,
    visitorEmail    : body.payload.data.visitor_email
  };
  
  plugin.Export.exportFullConversation(website_id, session_id, data);
  return res.send({});
};


