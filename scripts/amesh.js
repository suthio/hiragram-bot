const momentTz = require("moment-timezone");
const sharp = require("sharp");
const request = require("request");
const fs = require("fs");
const { WebClient } = require("@slack/web-api");

const sleep = (time) => {
  const d1 = new Date();
  while(true) {
    const d2 = new Date();
    if (d2 - d1 > time) {
      return;
    }
  }
}

module.exports = ( robot => {
  robot.hear(/アメッシュ/, msg => {
    const ameshFilename = () => {
      const now = momentTz().tz("Asia/Tokyo").format("YYYYMMDDHHmm");
      return (now) - (now % 5);
    };

    const backgroundMapURL = "https://tokyo-ame.jwa.or.jp/map/map050.jpg";
    const rainfallImageURL = "http://tokyo-ame.jwa.or.jp/mesh/100/" + ameshFilename() + ".gif";
    const foregroundBorderLineURL = "https://tokyo-ame.jwa.or.jp/map/msk050.png";

    const downloadImage = (url, filename) => {
      request(
        {method: "GET", url: url, encoding: null},
        function (error, response, body) {
          if (!error && response.statusCode === 200) {
            fs.writeFileSync(filename, body, "binary");
          }
        }
      )
    };

    var backgroundMapFilename = "backgroundMap.jpg";
    var rainfallImageFilename = "rainfallImage.gif";
    var foregroundBorderLineFilename = "foregroundBorderLine.png";

    console.log("downloading: " + rainfallImageURL);

    downloadImage(backgroundMapURL, backgroundMapFilename);
    downloadImage(rainfallImageURL, rainfallImageFilename);
    downloadImage(foregroundBorderLineURL, foregroundBorderLineFilename);

    setTimeout(function() {
      sharp(rainfallImageFilename)
        .png()
        .resize({width: 1540, height: 960})
        .toFile("resizedRainfallImage.png", (err, info) => {
          if(!err) {
            sharp(backgroundMapFilename).png()
              .composite([{input: "resizedRainfallImage.png"}])
              .toFile("tmp.png", (err, info) => {
                if (!err) {
                  sharp("tmp.png").composite([{input: foregroundBorderLineFilename}]).toFile("result.png", (err, info) => {
                    if (err) {
                      console.log("ボーダーライン画像との合成失敗");
                      console.log(err);
                    } else {
                      // console.log("できた");
                      const token = process.env.HUBOT_SLACK_TOKEN;
                      const web = new WebClient(token);

                      if (!fs.existsSync("result.png")) {
                        console.log("画像無いよ");
                      }

                      var fileStream = fs.createReadStream("result.png");
                      console.log(fileStream);
                      web.files.upload({
                        file: fileStream,
                        channels: msg.envelope.room
                      });

                      console.log("FileUploaded");
                    }
                  });
                } else {
                  console.log("マップ画像との合成失敗");
                  console.log(err);
                }
              });
          } else {
            console.log("雨画像のリサイズ失敗");
            console.log(err);
          }
        })
    }, 3000);
  });
});
