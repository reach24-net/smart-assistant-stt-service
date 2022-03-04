const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const path = require("path");
const app = express();
const cors = require("cors");

// app.use(cors());

const sdk = require("microsoft-cognitiveservices-speech-sdk");

/* Config */
const audioConfig = require("./configuration/audioConfig.json");
const serviceAccount = require("./configuration/service-account.json");

const port = process.env.PORT || 5000;

app.use(bodyParser.json({ limit: "10mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "10mb",
    extended: true,
  })
);

app.use(morgan("dev"));

const wordsReplacer = require("./utils/wordsReplacer");

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);

  next();
});

/* Access static files */
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", function (req, res) {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const server = require("http").createServer(app);

var io = require("socket.io")(server);

server.listen(port, () => {
  console.log("Application running on", port);
});

// =========================== SOCKET.IO ================================ //

var subscriptionKey = serviceAccount.subscriptionKey;
var serviceRegion = serviceAccount.serviceRegion;

const speechConfig = sdk.SpeechConfig.fromSubscription(
  subscriptionKey,
  serviceRegion
);

io.on("connection", function (client) {
  console.log("Client Connected to server");

  let pushStream = sdk.AudioInputStream.createPushStream();
  let audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

  // speechConfig.speechRecognitionLanguage = "en-IN";

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  const phraseList = sdk.PhraseListGrammar.fromRecognizer(recognizer);
  phraseList.addPhrase("chassis");
  phraseList.addPhrase("container");

  speechConfig.setServiceProperty(
    "punctuation",
    "explicit",
    sdk.ServicePropertyChannel.UriQueryParameter
  );

  client.on("messages", function (data) {
    client.emit("broad", data);
  });

  client.on("startGoogleCloudStream", function () {
    startRecognitionStream(this);
    recognizer.startContinuousRecognitionAsync();
  });

  client.on("endGoogleCloudStream", function () {
    stopRecognitionStream();
  });

  client.on("binaryAudioData", function (data) {
    if (pushStream !== null) {
      pushStream.write(data);
    }
  });

  function startRecognitionStream(client) {
    recognizer.recognizing = (s, e) => {
      let json = JSON.parse(JSON.stringify(e));

      json.privResult.privText = wordsReplacer.wordsReplacer(
        json.privResult.privText
      );

      console.log(`RECOGNIZING: Text=${json.privResult.privText}`);
      client.emit("speechDataInterim", json);
    };

    recognizer.recognized = (s, e) => {
      if (e.result.reason == sdk.ResultReason.RecognizedSpeech) {
        let json = JSON.parse(JSON.stringify(e));

        json.privResult.privText = wordsReplacer.wordsReplacer(
          json.privResult.privText
        );

        client.emit("speechData", json.privResult);
        console.log(`RECOGNIZED: Text=${json.privResult.privText}`);
      } else if (e.result.reason == sdk.ResultReason.NoMatch) {
        console.log("NOMATCH: Speech could not be recognized.");
      }
    };

    recognizer.canceled = (s, e) => {
      console.log(`CANCELED: Reason=${e.reason}`);

      if (e.reason == sdk.CancellationReason.Error) {
        console.log(`"CANCELED: ErrorCode=${e.errorCode}`);
        console.log(`"CANCELED: ErrorDetails=${e.errorDetails}`);
        console.log(
          "CANCELED: Did you update the key and location/region info?"
        );
      }

      recognizer.stopContinuousRecognitionAsync();
    };

    recognizer.sessionStopped = (s, e) => {
      console.log("\n    Session stopped event.");
      recognizer.stopContinuousRecognitionAsync();
    };
  }

  function stopRecognitionStream() {
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync();
    }
    recognizeStream = null;
  }
});
