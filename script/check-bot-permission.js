/**
 * MediaWiki 机器人权限检查模块
 * 
 * 使用方法：
 * const { allowBots } = require('./check-bot-permission');
 * 
 * // 检查页面是否允许指定机器人编辑
 * if (allowBots(pageText, 'BotUsername')) {
 *   console.log('允许编辑');
 * } else {
 *   console.log('禁止编辑，跳过');
 * }
 * 
 * 支持的模板语法：
 * - {{nobots}} - 禁止所有机器人
 * - {{bots}} - 允许所有机器人
 * - {{bots|allow=username}} - 仅允许指定机器人
 * - {{bots|deny=username}} - 禁止指定机器人
 * - {{bots|allow=all}} - 允许所有机器人
 * - {{bots|deny=all}} - 禁止所有机器人
 */

/**
 * 检查页面是否允许指定机器人编辑
 * @param {string} text - 页面文本内容
 * @param {string} user - 机器人用户名
 * @returns {boolean} - true 表示允许编辑，false 表示禁止编辑
 */
function allowBots(text, user="FDtool") {
  // 如果页面中没有 bots/nobots 模板，默认允许编辑
  if (!new RegExp("\\{\\{\\s*(nobots|bots[^}]*)\\s*\\}\\}", "i").test(text)) return true;
  
  // 检查是否有明确的 deny 规则禁止该用户
  return (new RegExp("\\{\\{\\s*bots\\s*\\|\\s*deny\\s*=\\s*([^}]*,\\s*)*" + user + "\\s*(?=[,\\}])[^}]*\\s*\\}\\}", "i").test(text)) 
    ? false 
    : new RegExp("\\{\\{\\s*((?!nobots)|bots(\\s*\\|\\s*allow\\s*=\\s*((?!none)|([^}]*,\\s*)*" + user + "\\s*(?=[,\\}])[^}]*|all))?|bots\\s*\\|\\s*deny\\s*=\\s*(?!all)[^}]*|bots\\s*\\|\\s*optout=(?!all)[^}]*)\\s*\\}\\}", "i").test(text);
}

module.exports = { allowBots };
