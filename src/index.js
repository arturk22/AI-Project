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
    } else if (!usersData[message.from].problemStage) {
      client.sendText(
        message.from,
        "Por favor, escolha uma das opções numeradas abaixo para começar:\n" +
        "1. Meu computador não liga.\n" +
        "2. Meu computador está lento.\n" +
        "3. Não consigo me conectar à internet.\n" +
        "4. Tenho problemas com vírus ou malware.\n" +
        "5. O som no meu computador não está funcionando.\n" +
        "6. Meu monitor está sem sinal.\n" +
        "7. Outro problema não listado.\n" +
        "Por favor, selecione a opção que melhor descreve o seu problema ou escolha a opção 7 se estiver enfrentando um problema diferente. Estou aqui para ajudar!"
      );
      usersData[message.from].problemStage = "awaiting_problem_choice";
      saveUsersData(usersData);
    } else if (usersData[message.from].problemStage === "awaiting_problem_choice") {
      const choice = parseInt(message.body);
      if (choice >= 1 && choice <= 7) {
        usersData[message.from].problemType = choice;
        usersData[message.from].problemStage = "awaiting_problem_details";
        saveUsersData(usersData);
        client.sendText(message.from, "Por favor, forneça mais detalhes sobre o seu problema.");
      } else {
        client.sendText(message.from, "Escolha inválida. Por favor, selecione uma opção entre 1 e 7.");
      }
    } else if (usersData[message.from].problemStage === "awaiting_problem_details") {
      const detailedDescription = message.body;
      const choice = usersData[message.from].problemType;
      const analise = await gerarAnalise(choice, detailedDescription, usersData[message.from].name);
      client.sendText(message.from, analise);
      delete usersData[message.from].problemStage;
      delete usersData[message.from].problemType;
      saveUsersData(usersData);
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

async function gerarAnalise(choice, detailedDescription, userName) {
  const problemTypeDescription = gerarPrompt(choice);
  const promptText = `${problemTypeDescription}. O usuário relatou: "${detailedDescription}". Forneça possíveis soluções.`;

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

function gerarPrompt(choice) {
  switch (choice) {
    case 1:
      return "Dê soluções para um computador que não liga.";
    case 2:
      return "Dê soluções para um computador que está lento.";
    case 3:
      return "Dê soluções para alguém que não consegue se conectar à internet.";
    case 4:
      return "Dê soluções para alguém com problemas de vírus ou malware.";
    case 5:
      return "Dê soluções para um computador cujo som não está funcionando.";
    case 6:
      return "Dê soluções para um monitor que está sem sinal.";
    case 7:
      return "Dê soluções gerais para problemas de computador não listados anteriormente.";
    default:
      return "Dê soluções gerais para problemas de computador.";
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