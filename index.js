var express = require('express');
var DirectLine = require('./lib/direct-line');

const LineClient = require('@line/bot-sdk').Client;
const middleware = require('@line/bot-sdk').middleware

var directLine = new DirectLine(process.env.DIRECT_LINE_TOKEN);

const config = {
    channelSecret: process.env.CHANNEL_SECRET,
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
}

const lineClient = new LineClient(config);

const app = express();

// Line Middleware
app.use(middleware(config))
app.use((err, req, res, next) => {
    if (err instanceof SignatureValidationFailed) {
      res.status(401).send(err.signature)
      return
    } else if (err instanceof JSONParseError) {
      res.status(400).send(err.raw)
      return
    }
    next(err) // will throw default 500
  })

// API proxy
app.post('/line', async function (req, res) {
    console.log(req.body.events);
    const event = req.body.events[0];

    switch (event.type) {
        case 'message':
            directLine.postActivity({
                type: 'message',
                text: event.message.text,
                from: {
                    id: event.source.userId,
                    name: 'user', // TODO:figure out the user's name.
                    token: event.replyToken // Needed to send a response to the message from theb user.
                }
            }).then(() => {
                res.sendStatus(200);
            });
            break;
        case 'follow':
            // todo: figure out how we can keep this websocket around……… it only gets created on FOLLOW events.
            try {
                await directLine.startConversation((activity) => {
                    // callback for new messages from bot framework. When a message appears on the WebSocket,
                    // we parse the activity, and send it to the line client. We need to add the ability to
                    // create custom line cards, if necessary.
                    console.log('sending activity from bot');
                    console.log(activity);
                    // need to handle other types of activity here.

                    return new Promise(function (resolve, reject) {
                        // Send the message from Bot Framework to Line.
                        lineClient.replyMessage(activity.from.token, {
                            type: 'text',
                            text: activity.text,
                        }).then((value) => resolve(value));
                    });
                });
            } catch (err) {
                console.error(err)
            }
        case 'unfollow':
            break;
        default:
            res.sendStatus(200);
            break;
    }
});

// Server
app.listen(3000, function () {
    console.log("app started on port 3000");
});