const { Novu } = require("@novu/node");
const dotenv = require("dotenv");
const generateUniqueUserId = require("../utils/generateUniqueId");
dotenv.config();

const novu = new Novu(process.env.NOVU_SECRET_KEY);

async function createNovuSucbscriber(name, email, phone, avatar) {
  const subscriberId = generateUniqueUserId();

  const firstName = name.split(" ")[0];
  const lastName = name.split(" ")[1];
  await novu.subscribers.identify(subscriberId, {
    firstName: firstName,
    lastName: lastName,
    email: email,
    phone: phone,
    avatar: avatar,
  });

  return subscriberId;
}
const x = async()=>{
    const id = await createNovuSucbscriber('junaid amir', 'junaidamir227@gmail.com', '+92308-4109453', 'https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390')
    console.log(id);

}

// x();

module.exports = createNovuSucbscriber;
