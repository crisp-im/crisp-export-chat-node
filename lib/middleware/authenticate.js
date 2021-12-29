const Store = require("../store");

module.exports = (request, response, next) => {
  let websiteId = request.query.website_id || request.body.origin.website_id;
  let tokenId = request.query.token || request.body.origin.token;

  if (tokenId !== Store.websites[websiteId].token) { 
    const error = {
      error: true,
      reason: "Invalid token, please try again with a valid token!",
      data: {
        websiteToken : Store.websites[websiteId].token,
        token        : tokenId
      }
    };

    console.error(error);
    
    return response.status(401).send((error));
  }

  next();
};