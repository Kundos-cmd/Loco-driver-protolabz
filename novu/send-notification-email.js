const { Novu } = require("@novu/node");
const dotenv = require("dotenv");
dotenv.config();


const novu = new Novu(process.env.NOVU_SECRET_KEY);

function sendNotificationEmail(email,heading,text,link,sId) {
  if(!email || !link){
    throw new Error('Not enough parameters for sending email')
  }
  console.log('email', email, sId);
  novu.trigger(
    'email-notification',
    {
      to: {
        subscriberId: sId,
        email:email
      },
      payload: {
        link:link,
        heading:heading,
        text:text
      },
    },
  ).then((res)=>{
    console.log("notification sent",res.data,email, sId);
  });
}




module.exports = sendNotificationEmail;
