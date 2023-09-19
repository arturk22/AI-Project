require("dotenv").config();
const OpenAI = require("openai");
const express = require("express");
const bodyParser = require("body-parser");
const wppconnect = require("@wppconnect-team/wppconnect");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const usersData = readUsersData();

function readUsersData() {
  if (fs.existsSync("usersData.json")) {
    const data = fs.readFileSync("usersData.json", "utf8");
    return JSON.parse(data);
  } else {
    return {};
  }
}

function saveUsersData(data) {
  fs.writeFileSync("usersData.json", JSON.stringify(data, null, 2));
}

async function processWhatsAppMessage(message) {
  try {
    if (!usersData[message.from]) {
      client.sendText(message.from, "Olá! Por favor, forneça seu nome.");
      usersData[message.from] = { stage: "awaiting_name" };
      saveUsersData(usersData);
    } else if (usersData[message.from].stage === "awaiting_name") {
      usersData[message.from].name = message.body;
      usersData[message.from].stage = "awaiting_age";
      saveUsersData(usersData);
      client.sendText(
        message.from,
        "Obrigado! Agora, por favor, forneça sua idade."
      );
    } else if (usersData[message.from].stage === "awaiting_age") {
      usersData[message.from].age = parseInt(message.body);
      delete usersData[message.from].stage;
      saveUsersData(usersData);

      client.sendText(
        message.from,
        "Obrigado por fornecer seus detalhes. Pode tirar suas duvidas..."
      );
    } else {
      const analise = await gerarAnalise(
        message.body,
        usersData[message.from].lastBotMsg
      );
      usersData[message.from].lastBotMsg = analise;
      usersData[message.from].lastUserMsg = message.body;
      client.sendText(message.from, analise);
    }
    // Armazenar o horário atual da interação
    if (usersData[message.from]) {
      usersData[message.from].lastInteraction = new Date().toISOString();
      saveUsersData(usersData);
    }
  } catch (error) {
    console.error("Erro ao processar a mensagem do WhatsApp:", error);
  }
}

async function gerarAnalise(textoAnalise, lastBotMsg, lastUserMsg) {
  const promptText = `Você é um assistente virtual responsável por criar um fluxo de atendimento para resolver problemas comuns de computador. Ofereça opções numeradas aos clientes, oriente, proponha soluções e faça perguntas com respostas de sim ou não. Sempre inclua a opção de retornar ao menu de problemas quando necessário.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: promptText },
        { role: "assistant", content: lastBotMsg || "" },
        { role: "user", content: lastUserMsg || "" },
        { role: "user", content: textoAnalise }
      ],
    });
    const response = completion.choices[0].message.content.trim();
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

let client;
wppconnect.create().then((createdClient) => {
  client = createdClient;
  client.onMessage((message) => {
    try {
      if (isValidSender(message.sender.id) && message.body) {
        processWhatsAppMessage(message)
      };
    } catch (err) {
      console.log(err.message)
    }
  });
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

const isValidSender = (id = "") => {
  // aqui podemos listar os números que devem ser respondidos quando enviarmos uma mensagem
  const validSenders = ["8381637837", "8381914051"];
  let isValid = false

  for(phone of validSenders) {
    isValid = isValid || id.includes(phone)
    if(isValid) break;
  }

  return isValid
}