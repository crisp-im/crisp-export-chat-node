const Store   = require("../store");

/**
 * @class
 * @classdesc This is the configuration Controller
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
    let websiteId         = request.query.website_id || request.body.origin.website_id;
    let filename          = Store.websites[websiteId].fileName;
    let selectedWebsiteId = Store.websites[websiteId].selectedWebsiteId ? "checked" : "";
    let selectedSessionId = Store.websites[websiteId].selectedSessionId ? "checked" : "";
    let selectedNickname  = Store.websites[websiteId].selectedNickname  ? "checked" : "";
    let selectedExample   = filename;
  
    if(selectedWebsiteId  === "checked"){
      selectedExample = `${selectedExample}_${websiteId}`;
    }
    if(selectedSessionId  === "checked"){
      selectedExample = `${selectedExample}_session_bbf82712-2602-468e-9c51-af054aaee873`;
    }
    if(selectedNickname   === "checked"){
      selectedExample = `${selectedExample}_John Doe`;
    }
  
    return response.render("config/config", {
      pageTitle         : "Export Configuration", 
      filename          : filename,
      selectedWebsiteId : selectedWebsiteId,
      selectedSessionId : selectedSessionId,
      selectedNickname  : selectedNickname,
      selectedExample   : selectedExample
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
      fileName          : request.body.fileName,
      selectedWebsiteId : request.body.selectedWebsiteId,
      selectedSessionId : request.body.selectedSessionId,
      selectedNickname  : request.body.selectedNickname
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
          selectedWebsiteId  : settings.selectedWebsiteId,
          selectedSessionId  : settings.selectedSessionId,
          selectedNickname   : settings.selectedNickname,
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