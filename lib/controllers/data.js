/**
 * @class
 * @classdesc This is the Export Thread plugin
 */
function ChatData(controller) {
  
  /**
   * 
   * @param {string} website_id 
   * @param {string} data 
   * @param {object} response 
   */
  controller.convertTimestamp = function (website_id, data, res){
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
  };

}

module.exports = ChatData;