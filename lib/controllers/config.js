const Store   = require("../store");

/**
 * @class
 * @classdesc This is the Export Thread plugin
 */
function Config(controller, crisp) {
  
  /**
   * 
   * @memberof Config
   * @method getConfiguration
   * @param {object} request 
   * @param {object} response 
   * @returns 
   */
  controller.getConfiguration = function (request, response){
    let websiteId   = request.query.website_id || request.body.origin.website_id;
    let filename    = Store.websites[websiteId].fileName;
    let fnWebsiteId = Store.websites[websiteId].fnWebsiteId ? "checked" : "";
    let fnSessionId = Store.websites[websiteId].fnSessionId ? "checked" : "";
    let fnNickname  = Store.websites[websiteId].fnNickname ? "checked" : "";
    let fnExample   = filename;
  
    if(fnWebsiteId  === "checked"){
      fnExample = `${fnExample}_${websiteId}`;
    }
    if(fnSessionId  === "checked"){
      fnExample = `${fnExample}_session_bbf82712-2602-468e-9c51-af054aaee873`;
    }
    if(fnNickname   === "checked"){
      fnExample = `${fnExample}_John Doe`;
    }
  
    return response.render("config/config", {
      pageTitle   : "Export Configuration", 
      filename    : filename,
      fnWebsiteId : fnWebsiteId,
      fnSessionId : fnSessionId,
      fnNickname  : fnNickname,
      fnExample   : fnExample
    });
  };

  /**
   * 
   * @memberof Config
   * @method putConfigurationUpdate
   * @param {object} request 
   * @param {object} response 
   */
  controller.putConfigurationUpdate = function (request, response){
    const websiteId = request.body.origin.website_id;
    const token = request.body.origin.token;
  
    const settings = {
      fileName    : request.body.fileName,
      fnWebsiteId : request.body.fnWebsiteId,
      fnSessionId : request.body.fnSessionId,
      fnNickname  : request.body.fnNickname
    };
  
    crisp.crispClient.plugin.updateSubscriptionSettings(
      websiteId,
      crisp._pluginId,
      settings
    )
      .then(() => {
        Store.websites[websiteId] = { 
          token        : token,
          fileName     : settings.fileName,
          fnWebsiteId  : settings.fnWebsiteId,
          fnSessionId  : settings.fnSessionId,
          fnNickname   : settings.fnNickname,
        };
        
        console.log(
          `Successfully updated plugin config for website ID: ${websiteId}`
        );
      })
      .catch(error => {
        console.error(error);
      });
  
    response.send({});
  };

  /**
   * 
   * @memberof Config
   * @method getConfigSuccess
   * @param {object} request 
   * @param {object} response 
   */
  controller.getConfigSuccess = function (request, response){
    response.render("config/success", {
      pageTitle: "Export plugin installed!"
    });
  };
}
  
module.exports = Config;