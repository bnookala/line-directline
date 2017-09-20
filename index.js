var express = require('express');
var DirectLine = require('./lib/direct-line');
var ActivityHandler = require('./lib/activity-handler');

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
                    name: 'user',
                    token: event.replyToken
                }
            }).then(() => {
                res.sendStatus(200);
            });
            break;
        case 'follow':
            // todo: figure out how we can keep this websocket around……… it only gets created on FOLLOW events.
            try {
                await directLine.startConversation((activity) => {
                    // callback for new messages from bot framework.
                    console.log('sending activity from bot');
                    console.log(activity);
                    // need to handle activity here.

                    return new Promise(function (resolve, reject) {
                        lineClient.replyMessage(activity.from.token, {
                            type: 'text',
                            text: activity.text,
                        }).then((value) => resolve(value)).reject()
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