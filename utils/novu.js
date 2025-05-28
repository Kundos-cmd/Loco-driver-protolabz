// import { Novu } from "@novu/node";
const {Novu} = require("@novu/node");

const notify = async () => {
  const novu = new Novu("e61fef49383cc798f4ae67ff4b1aabd6");

  const res = await novu.trigger("demo-apartment-review", {
    to: { 
      subscriberId: "2",
      email: "junaidamir227@gmail.com" 
    }, 
    payload: {
      organization: {
        logo: "https://react-email-demo-48zvx380u-resend.vercel.app/static/airbnb-review-user.jpg",
      },
    },
  });
  console.log(res.data);
};

exports.notify = notify;