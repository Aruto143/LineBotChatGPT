// プロパティサービスでハードコーディングを防ぐ
const LineTokenProperties = PropertiesService.getUserProperties();
const OpenaiApiKeyProperties = PropertiesService.getUserProperties();

const LINE_ACCESS_TOKEN = LineTokenProperties.getProperty('LINE_ACCESS_TOKEN');
const OPENAI_APIKEY = OpenaiApiKeyProperties.getProperty('OPENAI_APIKEY');
let replyFlag = false;

function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];

  const replyToken = event.replyToken;
  let userMessage = event.message.text;
  const url = 'https://api.line.me/v2/bot/message/reply';

  // やんすorヤンスの文字列が入ってるメッセージにのみ返答する
  if(0 < userMessage.indexOf('やんす') || 0 < userMessage.indexOf('ヤンス')){
    replyFlag = true;
  }

  if(replyFlag){
    const prompt = userMessage;

    // スクリプトプロパティからbotの記憶情報を読み取る
    const props = PropertiesService.getScriptProperties();
    const currentMemoryContent = JSON.parse(props.getProperty('bot_memory_content'));

    // ChatGPT APIに送信する過去の会話履歴数
    const memorySize = 3;
    let slicedMemoryContent;
    if(currentMemoryContent.length > memorySize){
      slicedMemoryContent = currentMemoryContent.slice(0, memorySize)
    } else {
      slicedMemoryContent = currentMemoryContent.slice()
    }

    // botにキャラ付け
    const botRoleContent = `
      あなたはChatbotとして、語尾にヤンスを付けて返事をしてください。
    `;

    // ChatGPTに渡す会話情報
    let conversations = [
      {"role": "system", "content": botRoleContent}
    ]

    // botに記憶を持たせるためメッセージに過去の会話履歴を付与
    slicedMemoryContent.forEach(element => {
      conversations.push({"role": "user", "content": element.userMessage})
      conversations.push({"role": "assistant", "content": element.botMessage})
    })

    // ユーザから送信された最新の会話文を追加
    conversations.push({"role": "user", "content": prompt})
    Logger.log(conversations)

    const requestOptions = {
      "method": "post",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer "+ OPENAI_APIKEY
      },
      "payload": JSON.stringify({
        "model": "gpt-3.5-turbo",
        "messages": conversations
      })
    }


    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", requestOptions);

    const responseText = response.getContentText();
    const json = JSON.parse(responseText);
    const botReply = json['choices'][0]['message']['content'].trim();

    UrlFetchApp.fetch(url, {
      'method': 'post',
      'headers': {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN,
      },
      'payload': JSON.stringify({
        'replyToken': replyToken,
        'messages': [{
          'type': 'text',
          'text': botReply,
        }]
      })
    });

    // botの会話履歴をアップデートしてスクリプトプロパティへ保存
    newMemoryContent = currentMemoryContent;
    newMemoryContent.unshift({
      userMessage: userMessage,
      botMessage: botReply
    })
    props.setProperty('bot_memory_content', JSON.stringify(newMemoryContent));

    return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
  }
}
