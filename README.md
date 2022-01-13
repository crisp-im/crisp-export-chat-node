# Crisp Plugin Generic Widget (Node.js)

This is an example plugin using the Crisp Widgets. 

The purpose of this plugin is to export a conversation session and send it to the user in a plain text file. The operator will also be able specify a date range of messages that should be sent in the text file. 

In order to use widgets, you will need to publish your plugin, and you will need to have this approved. We will use the production tokens for this example too.

## Plugin Setup

1. Create an account on the [Crisp Marketplace](https://marketplace.crisp.chat)
2. Create a plugin in the Marketplace. (Add the plugin URN in `./config/production.json` > `pluginUrn` URN example: `"urn:my.account:pluginname:0"`)
3. Give your plugin a name and description.
4. In the Marketplace go to the **Tokens** tab of your plugin.
5. Select **Ask a Production Token** and define the scopes you will need. Please add a description as to why you need these scopes or they will be rejected. The scopes you will need for the project are:
    * **Namespace**: `bucket:url`                     **Description**: You will need this to create upload links to upload and send the chat transcript files in Crisp.
    * **Namespace**: `website:conversation:sessions`  **Description**: To use the session `created_at` and `updated_at` dates, along with the user's nickname and email.
    * **Namespace**: `website:conversation:messages`  **Description**: To retrieve all messages from a conversation, and send the transcript text file to the conversation. 
  Please note: you can see all required scopes for each individual API route. Please refer to the [REST API Documentation](https://docs.crisp.chat/references/rest-api/v1/) and view the right panel of each route.
6. Add your plugin production tokens in the correct fields (Located in `./config/production.json`: 
     * crispAPIIdentifier: `(ex: ac5a9650-903e-4xc4-90cf-87a954fz275d)` ,
     * crispAPIKey: `(ex: az7492b632087682715e5f8r0359052714e52f5cbf3152f58be4580cdb40e3e)`)
7. In the **Listing** tab of your plugin, please add:
     * A plugin icon
     * A URL to your website under **Support** in the **Features & Links** section. (These are required inorder to publish your plugin.)
  If you do not have a website yet, you can add `mailto:email@email.com` using your email so that users can contact you if they have any issues.
8. Go to the **Settings** tab of your plugin:
    * Add plugin URLS. For this example we use [ngrok](https://ngrok.com), it will help you bind public HTTPS addresses to your local server.
      * Callback example URL : `https://698e-79-168-37-128.ngrok.io/success`
      * Settings example URL : `https://698e-79-168-37-128.ngrok.io/config`
      * Action example URL   : `https://698e-79-168-37-128.ngrok.io/export`

    * Add your custom settings Schema. In this example you will use the schema provided at `./docs/schema.json`, please change the URN to match your plugin. 
    * Add your custom Widget Schema. In this example you will use the schema provided at `./docs/widget.json`.
        * Edit your widget urls for `widget.sections[0].items[3].value.url` && `widget.sections[0].items[4].value.url` with the correct ngrok endpoint, leaving the same routes.
            * eg. `https://698e-79-168-37-128.ngrok.io/profile`

    * Scroll to the **Danger Zone**. Click **publish plugin**. Note: even Private plugins must be published to use widgets, they will not be visible to the public.
    * Login to [Crisp](https://app.crisp.chat) and follow the link Installation link to install your plugin to your Crisp account. (Do this after Starting the plugin)

## Start the plugin example

1. In the project root, run: `npm install && node ./lib/index.js`
2. You should now see in your terminal: `Now listening for events...`. 
3. Configure the file name: Go in [Crisp](https://app.crisp.chat) > Plugins > Installed Plugins > Export Thread (or plugin name if changed) > Configure the Plugin. You will be redirected to a new page, where you can save the file name configuration. Edit the configureation and click "Save configuration".
3. In your Crisp inbox, open an existing conversation. In the wigets panel on the right hand side, go to Export Thread (or new plugin name):
    * Click send entrie conversation to send all messages in that session. ([Hook button](https://docs.crisp.chat/guides/plugins/widgets/generic-widget/#hook-button-item) item example.)
    * Enter a "Messages from" date to specify the from which date messages should be included, click "Send Messages from selected dates". ([Data Item](https://docs.crisp.chat/guides/plugins/widgets/generic-widget/#data-item) and [Submit button](https://docs.crisp.chat/guides/plugins/widgets/generic-widget/#submit-button-item) item examples.)
    * Enter a "Messages From" and a "Messages to" date to specify an exact date range when messages should be included. ([Data Item](https://docs.crisp.chat/guides/plugins/widgets/generic-widget/#data-item) and [Submit button](https://docs.crisp.chat/guides/plugins/widgets/generic-widget/#submit-button-item) item examples.)
    * Click "Open Profile" to demo opening an internal CRM profile directly in Crisp. ([Modal button](https://docs.crisp.chat/guides/plugins/widgets/generic-widget/#modal-button-item) item example.)
    * Click "Open Link to Profile" to demo opening an interanl CRM profile in a seperate tab. ([Link button](https://docs.crisp.chat/guides/plugins/widgets/generic-widget/#link-button-item) item example.)

