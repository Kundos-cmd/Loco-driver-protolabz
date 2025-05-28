const { Novu } = require("@novu/node");
const dotenv = require("dotenv");
dotenv.config();

const novu = new Novu(process.env.NOVU_SECRET_KEY);

async function notify (sId, url, body) {
  if (!sId || !body || !url) {
    throw new Error("Not enough parameters for sending notification");
  }
  console.log("notifying", sId);
  novu
    .trigger("in-app-activity", {
      to: {
        subscriberId: sId,
      },
      payload: {
        actionUrl: url,
        body: body,
      },
    })
    .then((res) => {
      console.log("notification sent", res.data, sId);
    })
    .catch((err) => {
      console.error(err);
    });
}

module.exports = notify;
