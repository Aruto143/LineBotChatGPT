function myFunction() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('bot_memory_content', JSON.stringify([]));
}

// スクリプトプロパティの値をリセットした場合、このスクリプトファイルを再実行