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
        usersData[message.from].name
      );
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

async function gerarAnalise(textoAnalise, userName) {
  const promptText = `Dê possivei soluções para o problema do usuario: "${textoAnalise}"`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: promptText }],
    });
    const response =
      `Soluções para você, ${userName}: ` +
      completion.choices[0].message.content.trim();
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
    if (message.body) {
      processWhatsAppMessage(message);
    }
  });
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});